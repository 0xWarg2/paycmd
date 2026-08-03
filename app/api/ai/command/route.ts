import { NextRequest, NextResponse } from "next/server";

import { cctpBridgeChainConfigs, normalizeCctpBridgeChain } from "@/lib/paycmd/cctp-bridge";
import { chainAliases, supportedChains } from "@/lib/paycmd/chains";
import { askDeepSeek } from "@/lib/paycmd/ai/deepseek";
import { AiAccessError, runDeepSeekWithQuota } from "@/lib/paycmd/ai/access";
import { commandRouterModel, commandRouterModelProfile } from "@/lib/paycmd/ai/models";
import { aiCommandResponseSchema } from "@/lib/paycmd/ai/schema";
import { requestLocale, tr, type PayCmdLocale } from "@/lib/i18n/server";
import { commandRegistry, parsePayCmd, type CommandName } from "@/lib/paycmd/commands";
import { createClient } from "@/lib/supabase/server";

type AiCommandRequest = {
  input?: string;
  recentMessages?: { role: string; text: string }[];
};

// Comfortably above the 25s transport timeout below. Without this the platform default applied,
// which is shorter than the budget this route asks for — and because the deterministic fallback runs
// *inside* the handler, being killed mid-request produced a bare 504 with no fallback at all.
export const maxDuration = 60;

const evmAddressPattern = /0x[a-fA-F0-9]{40}/;

// Derived from the alias table `normalizeChain` actually uses, so the router is told about
// every Gateway chain instead of the three that used to be hardcoded here. Capped at the
// three shortest aliases per chain to keep the prompt tight.
function gatewayChainPromptHints() {
  return supportedChains
    .map((chain) => {
      const aliases = Object.entries(chainAliases)
        .filter(([, key]) => key === chain)
        .map(([alias]) => alias)
        .sort((left, right) => left.length - right.length)
        .slice(0, 3);
      return `${aliases.join("/")} -> ${chain}`;
    })
    .join(", ");
}

function isContactIntent(value: string) {
  return /\bcontact\b|danh\s*bạ|thêm\s+(?:người\s+)?liên\s+hệ|add\s+(?:a\s+)?contact|lưu\s+(?:người\s+)?nhận/i.test(
    value,
  );
}

function wantsProfileDisplayName(value: string) {
  return /(?:lấy|lay|dùng|dung|tự động|tu dong|auto).*(?:display|profile|tên|ten)/i.test(value);
}

function cleanContactName(value: string) {
  return value
    .replace(/[.?!]+$/g, "")
    .replace(/\s+(?:đi|di|nhé|nhe|nha|giúp tôi|giup toi)$/i, "")
    .trim()
    .slice(0, 60);
}

function contactNameFromReply(value: string) {
  const patterns = [
    /(?:đặt|dat|set|lưu|luu).{0,24}(?:tên|ten).{0,12}(?:là|la)\s+(.+)$/i,
    /(?:tên|ten)(?:\s+display)?\s+(?:là|la)\s+(.+)$/i,
    /(?:gọi|goi)\s+(?:là|la)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const name = cleanContactName(value.match(pattern)?.[1] ?? "");
    if (name) return name;
  }

  return "";
}

function contactNameBeforeAddress(value: string, address: string) {
  const beforeAddress = value.slice(0, value.toLowerCase().indexOf(address.toLowerCase()));
  const name = beforeAddress
    .replace(/\b(?:add|thêm|them|lưu|luu)\b/gi, " ")
    .replace(/\bcontact\b/gi, " ")
    .replace(/\b(?:cho|giúp|giup)\s+(?:tôi|toi|mình|minh)\b/gi, " ")
    .replace(/\b(?:vào|vao)\s+danh\s*bạ\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanContactName(name);
}

function latestContactAddress(messages: { role: string; text: string }[]) {
  for (const message of [...messages].reverse()) {
    const address = message.text.match(evmAddressPattern)?.[0];
    if (address && isContactIntent(message.text)) return address;
  }

  return "";
}

function deterministicContactCommand(
  input: string,
  recentMessages: { role: string; text: string }[],
  locale: PayCmdLocale,
) {
  const directAddress = input.match(evmAddressPattern)?.[0] ?? "";

  if (directAddress && isContactIntent(input)) {
    const displayName = contactNameBeforeAddress(input, directAddress);
    const canonicalCommand = displayName
      ? `/contacts add ${displayName} ${directAddress}`
      : `/contacts add ${directAddress}`;

    return {
      canonicalCommand,
      assistantText: displayName
        ? tr(locale, "ai.saveContact", { name: displayName })
        : tr(locale, "ai.fetchProfileName"),
    };
  }

  const recentAddress = latestContactAddress(recentMessages);
  if (!recentAddress) return null;

  if (wantsProfileDisplayName(input)) {
    return {
      canonicalCommand: `/contacts add ${recentAddress}`,
      assistantText: tr(locale, "ai.fetchProfileName"),
    };
  }

  const displayName = contactNameFromReply(input);
  if (!displayName) return null;

  return {
    canonicalCommand: `/contacts add ${displayName} ${recentAddress}`,
    assistantText: tr(locale, "ai.saveContact", { name: displayName }),
  };
}

function normalizeChainToken(value: string) {
  const normalized = value.toLowerCase().replace(/[-_\s]/g, "");
  if (normalized === "arc" || normalized === "arctestnet") return "arc";
  if (normalized === "base" || normalized === "basesepolia") return "base";
  if (
    normalized === "avalanche" ||
    normalized === "avax" ||
    normalized === "fuji" ||
    normalized === "avalanchefuji"
  ) {
    return "avalanche";
  }
  return "";
}

function cleanRecipientName(value: string) {
  return value
    .replace(/[.?!]+$/g, "")
    .replace(/\s+(?:đi|di|nhé|nhe|nha|giúp tôi|giup toi|với|voi)$/i, "")
    .trim()
    .slice(0, 60);
}

function isSelfRecipient(value: string) {
  return /^(?:tôi|toi|mình|minh|me|myself|my wallet|ví tôi|vi toi)$/i.test(value.trim());
}

function deterministicBridgeCommand(input: string, locale: PayCmdLocale) {
  const value = input.trim();
  if (!/\b(bridge|cctp)\b/i.test(value)) return null;

  const amount = value.match(/\b\d+(?:\.\d{1,6})?\b/)?.[0] ?? "";
  if (!amount) return null;

  const sourceChain = normalizeCctpBridgeChain(
    value.match(/\b(?:từ|tu|from)\s+(.+?)(?=\s+(?:sang|đến|den|to)\b)/i)?.[1] ?? "",
  );
  const destinationChain = normalizeCctpBridgeChain(
    value.match(
      /\b(?:sang|đến|den|to)\s+(.+?)(?=\s+(?:\d+(?:\.\d{1,6})?|USDC|EURC|USYC|to\s+0x[a-fA-F0-9]{40}|on\s+my\s+metamask|metamask|manual|no forwarding|without forwarding|slow|standard|fast)\b|$)/i,
    )?.[1] ?? "",
  );
  const recipientAddress = value.match(/\bto\s+(0x[a-fA-F0-9]{40})\b/i)?.[1] ?? "";
  const mode = /\b(manual|no forwarding|without forwarding)\b/i.test(value) ? " manual" : "";
  const speed = /\b(slow|standard)\b/i.test(value) ? " standard" : "";

  if (!sourceChain || !destinationChain) return null;

  const canonicalCommand = `/bridge ${amount} USDC from ${sourceChain} to ${destinationChain}${recipientAddress ? ` to ${recipientAddress}` : ""}${mode}${speed}`;
  const parsedCommand = parsePayCmd(canonicalCommand, locale);

  return {
    canonicalCommand,
    assistantText: parsedCommand.summary,
    suggestions: [parsedCommand.sample],
    parsedCommand,
  };
}

function deterministicSwapCommand(input: string, locale: PayCmdLocale) {
  const value = input.trim();
  if (!/\b(swap|đổi|doi|convert)\b/i.test(value)) return null;

  const amount = value.match(/\b\d+(?:\.\d{1,8})?\b/)?.[0] ?? "";
  if (!amount) return null;

  const direct = value.match(
    /\b(?:swap|đổi|doi|convert)\s+\d+(?:\.\d{1,8})?\s+([a-zA-Z][a-zA-Z0-9]*)\s+(?:to|sang|ra|for|lấy|lay)\s+([a-zA-Z][a-zA-Z0-9]*)\b/i,
  );
  const tokenIn = direct?.[1] ?? value.match(/\b\d+(?:\.\d{1,8})?\s+([a-zA-Z][a-zA-Z0-9]*)\b/i)?.[1] ?? "";
  const tokenOut = direct?.[2] ?? value.match(/\b(?:to|sang|ra|for|lấy|lay)\s+([a-zA-Z][a-zA-Z0-9]*)\b/i)?.[1] ?? "";

  if (!tokenIn || !tokenOut) return null;

  const canonicalCommand = `/swap ${amount} ${tokenIn} to ${tokenOut}`;
  const parsedCommand = parsePayCmd(canonicalCommand, locale);

  return {
    canonicalCommand,
    assistantText: parsedCommand.summary,
    suggestions: [parsedCommand.sample],
    parsedCommand,
  };
}

function deterministicPaymentCommand(input: string, locale: PayCmdLocale) {
  const value = input.trim();
  if (!/\b(chuyển|chuyen|gửi|gui|trả|tra|pay|send|transfer)\b/i.test(value)) return null;

  const amount = value.match(/\b\d+(?:\.\d{1,6})?\b/)?.[0] ?? "";
  if (!amount) return null;

  const sourceChain = normalizeChainToken(
    value.match(/\b(?:từ|tu|from)\s+(arc(?:-?testnet)?|base(?:-?sepolia)?|avalanche(?:-?fuji)?|avax|fuji)\b/i)?.[1] ?? "",
  );
  const destinationChain = normalizeChainToken(
    value.match(/\b(?:sang|đến|den|to|on)\s+(arc(?:-?testnet)?|base(?:-?sepolia)?|avalanche(?:-?fuji)?|avax|fuji)\b/i)?.[1] ?? "",
  );
  const recipientAfterDestination = value.match(
    /\b(?:sang|đến|den|to|on)\s+(?:arc(?:-?testnet)?|base(?:-?sepolia)?|avalanche(?:-?fuji)?|avax|fuji)\s+(?:cho|sang|to)\s+(.+)$/i,
  )?.[1] ?? "";
  const recipient = cleanRecipientName(
    value.match(/\b(?:cho|to)\s+(.+?)(?:\s+(?:trên|tren|on|từ|tu|from|sang|đến|den|to)\s+|$)/i)?.[1] ??
      recipientAfterDestination,
  );

  if (recipient && !isSelfRecipient(recipient) && destinationChain) {
    const canonicalCommand = `/pay ${amount} to ${recipient} on ${destinationChain}${sourceChain ? ` from ${sourceChain}` : ""}`;
    const parsedCommand = parsePayCmd(canonicalCommand, locale);

    return {
      canonicalCommand,
      assistantText: parsedCommand.summary,
      suggestions: [parsedCommand.sample],
      parsedCommand,
    };
  }

  if (sourceChain && destinationChain) {
    const canonicalCommand = `/transfer ${amount} from ${sourceChain} to ${destinationChain}`;
    const parsedCommand = parsePayCmd(canonicalCommand, locale);

    return {
      canonicalCommand,
      assistantText: parsedCommand.summary,
      suggestions: [parsedCommand.sample],
      parsedCommand,
    };
  }

  return null;
}

function parseJsonObject(value: string) {
  const trimmed = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(trimmed || "{}");
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return {};
      }
    }

    return {};
  }
}


function commandCatalog() {
  return commandRegistry.map((command) => ({
    name: command.name,
    title: command.title,
    sample: command.sample,
    requiredFields: command.requiredFields,
  }));
}

async function getAppContext(userId: string) {
  const supabase = await createClient();
  const [wallets, externalWallets, contacts, transactions] = await Promise.all([
    supabase
      .from("wallets")
      .select("wallet_address, address, blockchain, type, name")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("user_external_wallets")
      .select("wallet_type, chain_type, wallet_address, is_primary")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("contacts")
      .select("display_name, wallet_address, preferred_chain, status")
      .eq("user_id", userId)
      .limit(20),
    supabase
      .from("transaction_history")
      .select("tx_type, chain, destination_chain, amount, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return {
    circleWallets: wallets.data ?? [],
    externalWallets: externalWallets.data ?? [],
    contacts: contacts.data ?? [],
    recentTransactions: transactions.data ?? [],
  };
}

/**
 * Lowercases and strips Vietnamese diacritics so one keyword entry covers "chuyển", "chuyen", and
 * "CHUYỂN". `đ` needs its own replace: it is U+0111, a distinct letter rather than `d` + combining
 * mark, so NFD leaves it untouched.
 */
function normalizeForMatch(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d");
}

// Keyword hints for every command in `commandRegistry`, used only when the model path is down.
// Deliberately *not* a second router: a match here never becomes an executable command, because the
// samples carry placeholder values (`/payroll run team 25 from base` would pay the wrong amount to
// the wrong group). It only picks which command to name in the clarify text and suggestion chips,
// so the user gets pointed at the right one of 16 instead of a fixed list of 3.
//
// Ambiguous single words are omitted on purpose: bare "đổi" collides with `request` ("đòi tiền"),
// and "gửi" alone spans pay/deposit/transfer. Scoring below prefers the longest matched phrase, so
// "gửi vào gateway" beats "gửi cho" without either needing to be removed.
// Not `Partial<...>`: a full Record means adding a 17th command to `commandRegistry` fails the
// typecheck until it gets keywords here, so "every feature is reachable" cannot silently regress.
const commandKeywordHints: Record<CommandName, string[]> = {
  wallet: ["wallet", "vi circle", "circle wallet", "tao vi", "trang thai vi", "create wallet"],
  link: ["link", "ket noi", "lien ket", "metamask", "connect wallet", "external wallet"],
  fund: ["fund", "nap tien vao", "nap tu", "nap vi", "top up", "add funds", "chuyen tien vao"],
  balance: ["balance", "so du", "con bao nhieu", "bao nhieu tien", "how much", "xem tien"],
  deposit: ["deposit", "nap vao gateway", "gui vao gateway", "nap gateway", "deposit gateway"],
  withdraw: ["withdraw", "rut", "rut tien", "rut ve", "rut khoi gateway", "cash out"],
  transfer: ["transfer", "chuyen noi bo", "chuyen giua", "move between", "chuyen qua lai"],
  bridge: ["bridge", "cctp", "chuyen chain", "sang chain", "cross chain", "qua chain", "bac cau"],
  swap: ["swap", "hoan doi", "doi sang", "doi token", "exchange", "convert", "eurc", "cirbtc"],
  pay: ["pay", "tra tien", "thanh toan", "gui cho", "chuyen cho", "send to", "gui tien cho", "tra cho"],
  request: ["request", "yeu cau", "doi tien", "xin tien", "invoice", "hoa don", "de nghi"],
  payroll: ["payroll", "tra luong", "luong", "salary", "tra nhieu nguoi", "bulk pay", "chi luong"],
  contacts: ["contact", "danh ba", "luu dia chi", "them nguoi nhan", "address book", "luu contact"],
  gas: ["gas", "phi mang", "phi gas", "native token", "gas fee", "het phi"],
  gateway: ["gateway", "unified balance", "so du gateway", "gateway info"],
  history: ["history", "lich su", "giao dich cu", "transactions", "xem lai giao dich"],
};

/**
 * Picks the command whose longest keyword phrase matches the input. Returns its registry `sample`
 * so the suggested text always matches a command that really exists — hardcoding samples here would
 * drift the moment one is edited in commands.ts.
 */
function guessCommandFromKeywords(input: string) {
  const haystack = normalizeForMatch(input);
  let best: { name: CommandName; score: number } | null = null;

  for (const [name, keywords] of Object.entries(commandKeywordHints) as [CommandName, string[]][]) {
    for (const keyword of keywords) {
      // Word-boundary matched rather than plain `includes`, so "gas" does not fire on "gasoline"
      // and short entries cannot match mid-word.
      const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (pattern.test(haystack) && keyword.length > (best?.score ?? 0)) {
        best = { name, score: keyword.length };
      }
    }
  }

  if (!best) return null;
  const command = commandRegistry.find((item) => item.name === best!.name);
  return command ? { name: command.name, sample: command.sample } : null;
}

/**
 * Reached only when the model path already failed, so the copy says so. It used to return
 * `ai.unknownCommand` ("I am not sure which command to use"), which blamed the user for a vague
 * message in the one situation where the router had not read it at all.
 */
function fallbackClarify(input: string, locale: PayCmdLocale) {
  const parsed = parsePayCmd(input, locale);

  if (!parsed.missingFields.length && parsed.status === "draft_ready") {
    return {
      intent: "command" as const,
      canonicalCommand: parsed.raw.startsWith("/") ? parsed.raw : `/${parsed.raw}`,
      assistantText: parsed.summary,
      missingFields: [],
      suggestions: [parsed.sample],
      parsedCommand: parsed,
    };
  }

  const guess = guessCommandFromKeywords(input);

  return {
    intent: "clarify" as const,
    canonicalCommand: "",
    // Stays `clarify` with `parsedCommand: null` even when a keyword matched: the sample carries
    // placeholder values, so it is something to offer, never something to execute.
    assistantText: guess
      ? tr(locale, "ai.routerUnavailableGuess", { sample: guess.sample })
      : tr(locale, "ai.routerUnavailable"),
    missingFields: parsed.missingFields,
    suggestions: guess
      ? [guess.sample, "/balance", "/history"]
      : ["/balance", "/link metamask", "/fund 10 from metamask on base"],
    parsedCommand: null,
  };
}

function deterministicCommandFallback(
  input: string,
  locale: PayCmdLocale,
  recentMessages: { role: string; text: string }[] = [],
) {
  const deterministicContact = deterministicContactCommand(input, recentMessages, locale);
  if (deterministicContact) {
    const parsedCommand = parsePayCmd(deterministicContact.canonicalCommand, locale);

    return {
      intent: "command" as const,
      ...deterministicContact,
      missingFields: [],
      suggestions: [parsedCommand.sample],
      parsedCommand,
      modelProfile: "paycmd-rules-fallback",
    };
  }

  const deterministicPayment = deterministicPaymentCommand(input, locale);
  if (deterministicPayment && !deterministicPayment.parsedCommand.missingFields.length) {
    return {
      intent: "command" as const,
      ...deterministicPayment,
      missingFields: [],
      modelProfile: "paycmd-rules-fallback",
    };
  }

  const deterministicBridge = deterministicBridgeCommand(input, locale);
  if (deterministicBridge && !deterministicBridge.parsedCommand.missingFields.length) {
    return {
      intent: "command" as const,
      ...deterministicBridge,
      missingFields: [],
      modelProfile: "paycmd-rules-fallback",
    };
  }

  const deterministicSwap = deterministicSwapCommand(input, locale);
  if (deterministicSwap && !deterministicSwap.parsedCommand.missingFields.length) {
    return {
      intent: "command" as const,
      ...deterministicSwap,
      missingFields: [],
      modelProfile: "paycmd-rules-fallback",
    };
  }

  return {
    ...fallbackClarify(input, locale),
    modelProfile: "paycmd-rules-fallback",
  };
}

// `reasoning` is passed separately rather than read off `aiResult`: every return below spreads the
// zod-validated output, and the schema has no reasoning field, so it would be stripped on the way
// through. Empty in practice while the router runs with thinking off.
function commandRouterResult(
  aiResult: any,
  modelProfile: string,
  locale: PayCmdLocale,
  reasoning?: string,
) {
  if (aiResult.intent !== "command") {
    return {
      ...aiResult,
      parsedCommand: null,
      modelProfile,
      reasoning: reasoning || undefined,
    };
  }

  const parsedCommand = parsePayCmd(aiResult.canonicalCommand, locale);

  if (parsedCommand.missingFields.length || parsedCommand.status !== "draft_ready") {
    return {
      intent: "clarify",
      canonicalCommand: aiResult.canonicalCommand,
      assistantText:
        aiResult.assistantText ||
        tr(locale, "ai.missingFields", { fields: parsedCommand.missingFields.join(", ") }),
      missingFields: parsedCommand.missingFields,
      suggestions: aiResult.suggestions,
      parsedCommand,
      modelProfile,
      reasoning: reasoning || undefined,
    };
  }

  return {
    ...aiResult,
    parsedCommand,
    modelProfile,
    reasoning: reasoning || undefined,
  };
}

export async function POST(req: NextRequest) {
  const locale = requestLocale(req);
  let fallbackInput = "";
  let fallbackRecentMessages: { role: string; text: string }[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as AiCommandRequest;
    const input = body.input?.trim() ?? "";
    fallbackInput = input;

    if (!input) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const recentMessages = (body.recentMessages ?? []).slice(-8);
    fallbackRecentMessages = recentMessages;
    const appContext = await getAppContext(user.id);
    const responseLanguageInstruction =
      locale === "en"
        ? "Write every value in assistantText, suggestions, and any human-readable JSON field in English."
        : "Write every value in assistantText, suggestions, and any human-readable JSON field in Vietnamese.";
    const prompt = [
      "You are Payna's AI command router for a stablecoin payment dapp.",
      // The field names have to live here now. DeepSeek has no `json_schema` mode, so nothing on the
      // provider side tells the model what shape to emit — and `canonicalCommand` has a zod
      // `.default("")`, meaning a response that omits it still validates and then silently parses as
      // an unknown command. Describing the keys in the prompt is the only thing preventing that.
      "Output exactly this json object and no other keys:",
      '{"intent":"command"|"clarify"|"answer"|"crypto_research","canonicalCommand":string,"assistantText":string,"missingFields":string[],"suggestions":string[]}',
      'canonicalCommand: one slash command from the supported command list with every value filled in, for example "/pay 25 to Minh on arc from base". Use "" for any intent other than "command".',
      'missingFields: the requiredFields names you could not fill. Empty array unless intent is "clarify".',
      "suggestions: up to 3 slash commands the user may want next.",
      "The supported command list below uses the keys name/title/sample/requiredFields. That describes the available commands; it is not the shape of your output.",
      responseLanguageInstruction,
      "Do not execute commands. Convert natural language into one canonical slash command when safe.",
      "The user may write in Vietnamese, English, Chinese, or mixed-language shorthand. Infer the intended Payna command from meaning, not exact keywords.",
      "If the user asks crypto research, market, token, chain, protocol, news, or conceptual questions that are not Payna actions, intent must be crypto_research.",
      "If the user asks general product/help questions, intent must be answer.",
      "If required information is missing, intent must be clarify and assistantText must ask one concise question.",
      "If the message could be a Payna action such as pay, transfer, swap, fund, deposit, withdraw, balance, wallet, contact, gas, payroll, or payment request, prefer command or clarify over crypto_research.",
      "All payment/fund/deposit/withdraw/transfer/payroll commands will be previewed and confirmed by the user later.",
      `Gateway chains: ${gatewayChainPromptHints()}.`,
      `Bridge chains (testnet MetaMask rail): ${cctpBridgeChainConfigs.map((chain) => `${chain.aliases[0]} -> ${chain.key}`).join(", ")}.`,
      "Swap is Arc Testnet only and supports USDC, EURC, and cirBTC. Canonical swap format: /swap <amount> <tokenIn> to <tokenOut>.",
      "Supported commands:",
      JSON.stringify(commandCatalog()),
      "Current app context:",
      JSON.stringify(appContext),
      "Recent chat:",
      JSON.stringify(recentMessages),
      `User input: ${input}`,
    ].join("\n\n");
    const { result: response, quota } = await runDeepSeekWithQuota(supabase, () =>
      askDeepSeek({
        model: commandRouterModel(),
        messages: [
          { role: "system", content: "You are Payna's AI command router. Return JSON only; no Markdown or commentary. Follow the user's supplied output schema exactly." },
          { role: "user", content: prompt },
        ],
        maxTokens: 900,
        timeoutMs: 25_000,
      // Both settings exist to protect the parse below.
      //
      // Chain-of-thought is on by default and spends the same `max_tokens` as the answer, so at this
      // budget it could consume the whole allowance and leave the JSON truncated. That failure is
      // near-invisible: the parse fails, the deterministic fallback answers with regex results, and
      // the response is still a 200 with no error logged — the router just quietly gets dumber.
        thinking: false,
      // Constrains the output to valid JSON, but not to a shape: DeepSeek has no `json_schema` mode,
      // so `aiCommandResponseSchema` below is still the only thing checking the fields.
        jsonObject: true,
      }),
    );
    const parsedOutput = aiCommandResponseSchema.safeParse(parseJsonObject(response.text));
    if (!parsedOutput.success) {
      // The fallback below answers with a 200, so without this line a dead model path reads exactly
      // like a healthy one in the logs. The raw tail matters too: a body that stops mid-token means
      // `max_tokens` ran out (raise the budget), which is a different fix from well-formed JSON
      // carrying the wrong fields (fix the prompt).
      console.error("DeepSeek command router returned unusable JSON; falling back to rules.", {
        issues: parsedOutput.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        rawLength: response.text.length,
        rawTail: response.text.slice(-120),
      });
      return NextResponse.json({
        ...deterministicCommandFallback(input, locale, recentMessages),
        // Empty while `thinking` is off above, but this is the most valuable place to have a trace if
        // it is ever turned back on — it is the branch where the model answered and we could not use
        // what it said.
        reasoning: response.reasoning || undefined,
        quota,
      });
    }
    // Valid JSON, wrong contract. `canonicalCommand` carries a zod `.default("")`, which the other
    // intents legitimately need, so an `intent: "command"` with no command still passes safeParse.
    // Left alone it reaches `parsePayCmd("")`, comes back as an unknown command, and gets rewritten
    // into a clarify below — a plausible-looking question that the model never asked. Catching it
    // here is what separates "the model ignored the output contract" from "the user was vague".
    if (parsedOutput.data.intent === "command" && !parsedOutput.data.canonicalCommand.trim()) {
      console.error("DeepSeek command router returned intent=command with no canonicalCommand; falling back to rules.", {
        assistantTextLength: parsedOutput.data.assistantText.length,
        missingFields: parsedOutput.data.missingFields,
      });
      return NextResponse.json({
        ...deterministicCommandFallback(input, locale, recentMessages),
        reasoning: response.reasoning || undefined,
        quota,
      });
    }
    return NextResponse.json(
      { ...commandRouterResult(parsedOutput.data, commandRouterModelProfile, locale, response.reasoning), quota },
    );
  } catch (error: any) {
    if (error instanceof AiAccessError) {
      return NextResponse.json(
        { error: error.code, message: error.message, quota: error.quota },
        { status: error.status },
      );
    }
    console.error("DeepSeek command router failed:", error);
    if (fallbackInput) return NextResponse.json(deterministicCommandFallback(fallbackInput, locale, fallbackRecentMessages));
    return NextResponse.json({ error: error.message || "Failed to parse AI command" }, { status: 500 });
  }
}
