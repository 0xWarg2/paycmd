import { NextRequest, NextResponse } from "next/server";

import { cctpBridgeChainConfigs, normalizeCctpBridgeChain } from "@/lib/paycmd/cctp-bridge";
import { getAiModelOption } from "@/lib/paycmd/ai/models";
import { aiCommandJsonSchema, aiCommandResponseSchema } from "@/lib/paycmd/ai/schema";
import { requestLocale, tr, type PayCmdLocale } from "@/lib/i18n/server";
import { commandRegistry, parsePayCmd } from "@/lib/paycmd/commands";
import { createClient } from "@/lib/supabase/server";

type AiCommandRequest = {
  input?: string;
  modelProfile?: string;
  recentMessages?: { role: string; text: string }[];
};

const evmAddressPattern = /0x[a-fA-F0-9]{40}/;

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

function extractOutputText(response: any) {
  if (typeof response.output_text === "string") return response.output_text;

  const parts = (response.output ?? [])
    .flatMap((item: any) => item.content ?? [])
    .map((content: any) => content.text ?? "")
    .filter(Boolean);

  return parts.join("\n").trim();
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

function openAiResponsesUrl() {
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return `${baseUrl}/responses`;
}

function promptCacheRetention() {
  const retention = process.env.OPENAI_PROMPT_CACHE_RETENTION;
  return retention === "24h" || retention === "in_memory" ? retention : null;
}

function surfBaseUrl() {
  return (process.env.SURF_API_BASE_URL ?? "https://api.asksurf.ai/gateway/v1").replace(/\/+$/, "");
}

function surfChatCompletionUrls() {
  const configured = surfBaseUrl();
  const urls = [`${configured}/chat/completions`];

  if (/^https:\/\/api\.asksurf\.ai\/v1$/i.test(configured)) {
    urls.push("https://api.asksurf.ai/gateway/v1/chat/completions");
  }

  return [...new Set(urls)];
}

function extractSurfOutputText(response: any) {
  if (typeof response.output_text === "string") return response.output_text.trim();

  const choices = Array.isArray(response.choices) ? response.choices : [];
  const chatText = choices
    .map((choice: any) => choice.message?.content ?? choice.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();

  if (chatText) return chatText;

  return extractOutputText(response).trim();
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

  return {
    intent: "clarify" as const,
    canonicalCommand: "",
    assistantText: tr(locale, "ai.unknownCommand"),
    missingFields: parsed.missingFields,
    suggestions: ["/balance", "/link metamask", "/fund 10 from metamask on base"],
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

function commandRouterResult(aiResult: any, modelProfile: string, locale: PayCmdLocale) {
  if (aiResult.intent !== "command") {
    return {
      ...aiResult,
      parsedCommand: null,
      modelProfile,
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
    };
  }

  return {
    ...aiResult,
    parsedCommand,
    modelProfile,
  };
}

async function askSurfCommandRouter(prompt: string) {
  if (!process.env.SURF_API_KEY) {
    throw Object.assign(new Error("SURF_API_KEY is not configured"), { status: 500 });
  }

  const messages = [
    {
      role: "system",
      content: [
        "You are Payna's fallback command router.",
        "Return JSON only. No Markdown. No commentary.",
        "Your JSON must match this exact TypeScript shape:",
        '{ "intent": "command" | "answer" | "clarify" | "crypto_research", "canonicalCommand": string, "assistantText": string, "missingFields": string[], "suggestions": string[] }',
      ].join("\n"),
    },
    { role: "user", content: prompt },
  ];
  const requestBody = JSON.stringify({
    model: process.env.SURF_COMMAND_ROUTER_MODEL ?? "surf-1.5-instant",
    messages,
    stream: false,
    reasoning_effort: "low",
    max_tokens: 900,
  });

  let response: Response | null = null;
  let data: any = {};

  for (const url of surfChatCompletionUrls()) {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SURF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
      signal: AbortSignal.timeout(30_000),
    });

    data = await response.json().catch(() => ({}));

    if (response.ok || response.status !== 404) {
      break;
    }
  }

  if (!response?.ok) {
    throw Object.assign(
      new Error(data?.error?.message ?? data?.message ?? "AskSurf command router failed"),
      { status: response?.status ?? 502 },
    );
  }

  const parsedOutput = aiCommandResponseSchema.safeParse(parseJsonObject(extractSurfOutputText(data)));

  if (!parsedOutput.success) {
    throw Object.assign(new Error("AskSurf command router returned invalid JSON"), { status: 502 });
  }

  return parsedOutput.data;
}

async function commandRouterFallback(
  input: string,
  recentMessages: { role: string; text: string }[],
  prompt: string,
  locale: PayCmdLocale,
) {
  try {
    const surfResult = await askSurfCommandRouter(prompt);
    return commandRouterResult(
      surfResult,
      process.env.SURF_COMMAND_ROUTER_MODEL ?? "surf-1.5-instant",
      locale,
    );
  } catch (error) {
    console.error("AskSurf command router fallback failed:", error);
    return deterministicCommandFallback(input, locale, recentMessages);
  }
}

export async function POST(req: NextRequest) {
  const locale = requestLocale(req);
  let fallbackInput = "";
  let fallbackRecentMessages: { role: string; text: string }[] = [];
  let fallbackPrompt = "";

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
    const modelOption = getAiModelOption(body.modelProfile);
    const appContext = await getAppContext(user.id);
    const prompt = [
      "You are Payna's AI command router for a stablecoin payment dapp.",
      "Return only JSON matching the schema.",
      "Do not execute commands. Convert natural language into one canonical slash command when safe.",
      "The user may write in Vietnamese, English, Chinese, or mixed-language shorthand. Infer the intended Payna command from meaning, not exact keywords.",
      "If the user asks crypto research, market, token, chain, protocol, news, or conceptual questions that are not Payna actions, intent must be crypto_research.",
      "If the user asks general product/help questions, intent must be answer.",
      "If required information is missing, intent must be clarify and assistantText must ask one concise question.",
      "If the message could be a Payna action such as pay, transfer, swap, fund, deposit, withdraw, balance, wallet, contact, gas, payroll, or payment request, prefer command or clarify over crypto_research.",
      "All payment/fund/deposit/withdraw/transfer/payroll commands will be previewed and confirmed by the user later.",
      `Gateway chains: arc -> arcTestnet, base -> baseSepolia, avalanche/avax/fuji -> avalancheFuji.`,
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
    fallbackPrompt = prompt;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(await commandRouterFallback(input, recentMessages, prompt, locale));
    }

    const payload: Record<string, unknown> = {
      model: modelOption.model,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          ...aiCommandJsonSchema,
        },
      },
      max_output_tokens: 900,
    };

    payload.prompt_cache_key = process.env.OPENAI_PROMPT_CACHE_KEY ?? "paycmd-ai-command-router-v1";

    const cacheRetention = promptCacheRetention();
    if (cacheRetention) {
      payload.prompt_cache_retention = cacheRetention;
    }

    if (modelOption.reasoningEffort) {
      payload.reasoning = { effort: modelOption.reasoningEffort };
    }

    const response = await fetch(openAiResponsesUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("OpenAI command router failed:", data?.error?.message ?? data?.error ?? response.status);
      return NextResponse.json(await commandRouterFallback(input, recentMessages, prompt, locale));
    }

    const outputText = extractOutputText(data);
    const parsedOutput = aiCommandResponseSchema.safeParse(parseJsonObject(outputText));

    if (!parsedOutput.success) {
      return NextResponse.json(await commandRouterFallback(input, recentMessages, prompt, locale));
    }

    return NextResponse.json(commandRouterResult(parsedOutput.data, modelOption.id, locale));
  } catch (error: any) {
    console.error("AI command route failed:", error);
    if (fallbackInput && fallbackPrompt) {
      return NextResponse.json(await commandRouterFallback(fallbackInput, fallbackRecentMessages, fallbackPrompt, locale));
    }

    return NextResponse.json(
      { error: error.message || "Failed to parse AI command" },
      { status: 500 },
    );
  }
}
