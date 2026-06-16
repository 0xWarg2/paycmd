import { NextRequest, NextResponse } from "next/server";

import { getAiModelOption } from "@/lib/paycmd/ai/models";
import { aiCommandJsonSchema, aiCommandResponseSchema } from "@/lib/paycmd/ai/schema";
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
        ? `Lưu contact ${displayName}.`
        : "Đang lấy display name từ PayCMD profile của địa chỉ này.",
    };
  }

  const recentAddress = latestContactAddress(recentMessages);
  if (!recentAddress) return null;

  if (wantsProfileDisplayName(input)) {
    return {
      canonicalCommand: `/contacts add ${recentAddress}`,
      assistantText: "Đang lấy display name từ PayCMD profile của địa chỉ này.",
    };
  }

  const displayName = contactNameFromReply(input);
  if (!displayName) return null;

  return {
    canonicalCommand: `/contacts add ${displayName} ${recentAddress}`,
    assistantText: `Lưu contact ${displayName}.`,
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

function deterministicPaymentCommand(input: string) {
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
  const recipient = cleanRecipientName(
    value.match(/\b(?:cho|to)\s+(.+?)(?:\s+(?:trên|tren|on|từ|tu|from|sang|đến|den|to)\s+|$)/i)?.[1] ?? "",
  );

  if (recipient && destinationChain) {
    const canonicalCommand = `/pay ${amount} to ${recipient} on ${destinationChain}${sourceChain ? ` from ${sourceChain}` : ""}`;
    const parsedCommand = parsePayCmd(canonicalCommand);

    return {
      canonicalCommand,
      assistantText: parsedCommand.summary,
      suggestions: [parsedCommand.sample],
      parsedCommand,
    };
  }

  if (sourceChain && destinationChain) {
    const canonicalCommand = `/transfer ${amount} from ${sourceChain} to ${destinationChain}`;
    const parsedCommand = parsePayCmd(canonicalCommand);

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

function openAiResponsesUrl() {
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return `${baseUrl}/responses`;
}

function promptCacheRetention() {
  const retention = process.env.OPENAI_PROMPT_CACHE_RETENTION;
  return retention === "24h" || retention === "in_memory" ? retention : null;
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

function fallbackClarify(input: string) {
  const parsed = parsePayCmd(input);

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
    assistantText: "Mình chưa chắc nên dùng command nào. Gõ / để xem command hoặc nói rõ số tiền, người nhận và chain.",
    missingFields: parsed.missingFields,
    suggestions: ["/balance", "/link metamask", "/fund 10 from metamask on base"],
    parsedCommand: null,
  };
}

export async function POST(req: NextRequest) {
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

    if (!input) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const recentMessages = (body.recentMessages ?? []).slice(-8);
    const deterministicContact = deterministicContactCommand(input, recentMessages);
    if (deterministicContact) {
      const parsedCommand = parsePayCmd(deterministicContact.canonicalCommand);

      return NextResponse.json({
        intent: "command",
        ...deterministicContact,
        missingFields: [],
        suggestions: [parsedCommand.sample],
        parsedCommand,
        modelProfile: "paycmd-rules",
      });
    }

    const deterministicPayment = deterministicPaymentCommand(input);
    if (deterministicPayment && !deterministicPayment.parsedCommand.missingFields.length) {
      return NextResponse.json({
        intent: "command",
        ...deterministicPayment,
        missingFields: [],
        modelProfile: "paycmd-rules",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const modelOption = getAiModelOption(body.modelProfile);
    const appContext = await getAppContext(user.id);
    const prompt = [
      "You are PayCMD's AI command router for a stablecoin payment dapp.",
      "Return only JSON matching the schema.",
      "Do not execute commands. Convert natural language into one canonical slash command when safe.",
      "If the user asks crypto research, market, token, chain, protocol, news, or conceptual questions that are not PayCMD actions, intent must be crypto_research.",
      "If the user asks general product/help questions, intent must be answer.",
      "If required information is missing, intent must be clarify and assistantText must ask one concise question.",
      "If the message could be a PayCMD action such as pay, transfer, fund, deposit, withdraw, balance, wallet, contact, gas, payroll, or payment request, prefer command or clarify over crypto_research.",
      "All payment/fund/deposit/withdraw/transfer/payroll commands will be previewed and confirmed by the user later.",
      "Supported chains: arc -> arcTestnet, base -> baseSepolia, avalanche/avax/fuji -> avalancheFuji.",
      "Supported commands:",
      JSON.stringify(commandCatalog()),
      "Current app context:",
      JSON.stringify(appContext),
      "Recent chat:",
      JSON.stringify(recentMessages),
      `User input: ${input}`,
    ].join("\n\n");

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
      return NextResponse.json(
        { error: data?.error?.message ?? "OpenAI request failed" },
        { status: response.status },
      );
    }

    const outputText = extractOutputText(data);
    const parsedOutput = aiCommandResponseSchema.safeParse(JSON.parse(outputText || "{}"));

    if (!parsedOutput.success) {
      return NextResponse.json(fallbackClarify(input));
    }

    const aiResult = parsedOutput.data;

    if (aiResult.intent !== "command") {
      return NextResponse.json({
        ...aiResult,
        parsedCommand: null,
        modelProfile: modelOption.id,
      });
    }

    const parsedCommand = parsePayCmd(aiResult.canonicalCommand);

    if (parsedCommand.missingFields.length || parsedCommand.status !== "draft_ready") {
      return NextResponse.json({
        intent: "clarify",
        canonicalCommand: aiResult.canonicalCommand,
        assistantText:
          aiResult.assistantText ||
          `Mình cần thêm: ${parsedCommand.missingFields.join(", ")}.`,
        missingFields: parsedCommand.missingFields,
        suggestions: aiResult.suggestions,
        parsedCommand,
        modelProfile: modelOption.id,
      });
    }

    return NextResponse.json({
      ...aiResult,
      parsedCommand,
      modelProfile: modelOption.id,
    });
  } catch (error: any) {
    console.error("AI command route failed:", error);
    if (error?.name === "TimeoutError") {
      return NextResponse.json(
        { error: "OpenAI proxy timed out" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to parse AI command" },
      { status: 500 },
    );
  }
}
