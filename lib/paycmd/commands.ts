import { z } from "zod";

import {
  bridgeModeFrom,
  bridgeSpeedFrom,
  normalizeCctpBridgeChain,
} from "./cctp-bridge.ts";
import { chainAliases } from "./chains.ts";
import { normalizeSwapToken } from "./swap.ts";

export const commandNames = [
  "wallet",
  "link",
  "fund",
  "balance",
  "deposit",
  "withdraw",
  "transfer",
  "bridge",
  "swap",
  "pay",
  "request",
  "payroll",
  "contacts",
  "gas",
  "gateway",
  "history",
] as const;

export type CommandName = (typeof commandNames)[number];
export type CommandLocale = "vi" | "en";

export type CommandStatus =
  | "needs_input"
  | "draft_ready"
  | "queued"
  | "running"
  | "waiting_gateway"
  | "success"
  | "failed";

export type ParsedCommand = {
  command: CommandName;
  raw: string;
  fields: Record<string, string>;
  missingFields: string[];
  sample: string;
  summary: string;
  status: CommandStatus;
};

export type PayCmdCommand = {
  name: CommandName;
  aliases: string[];
  title: string;
  sample: string;
  requiredFields: string[];
  parse(input: string, locale?: CommandLocale): ParsedCommand;
};

const amountSchema = z.string().regex(/^\d+(\.\d{1,6})?$/);
const swapAmountSchema = z.string().regex(/^\d+(\.\d{1,8})?$/);
const commandMessages: Record<CommandLocale, Record<string, string>> = {
  vi: {
    "wallet.title": "Quản lý ví Circle",
    "wallet.create": "Tạo Circle wallet cho tài khoản này",
    "wallet.status": "Kiểm tra trạng thái Circle wallet",
    "wallet.balanceChain": "Xem USDC trong Circle SCA wallet trên {chain}",
    "wallet.balance": "Xem USDC trong Circle SCA wallet",
    "wallet.choose": "Chọn wallet action",
    "link.metamask": "Link MetaMask vào tài khoản Payna hiện tại",
    "link.choose": "Chọn external wallet cần link",
    "fund.ready": "Fund {amount} {token} từ MetaMask vào Circle wallet trên {chain}",
    "fund.draft": "Tạo lệnh nạp USDC từ MetaMask vào Circle wallet",
    "balance.chain": "Xem USDC balance trên {chain}",
    "balance.all": "Xem tổng unified USDC balance",
    "deposit.ready": "Deposit {amount} {token} từ {sourceChain} vào Circle Gateway",
    "deposit.draft": "Tạo Gateway deposit draft",
    "withdraw.ready": "Withdraw {amount} {token} từ Gateway {sourceChain} về Circle SCA wallet",
    "withdraw.draft": "Tạo Gateway withdraw draft",
    "transfer.ready": "Transfer {amount} {token} từ {sourceChain} sang {destinationChain}",
    "transfer.draft": "Tạo Gateway transfer draft",
    "bridge.readyExternal": "Bridge {amount} {token} từ {sourceChain} sang {destinationChain} cho {recipientAddress}",
    "bridge.ready": "Bridge {amount} {token} từ {sourceChain} sang {destinationChain}",
    "bridge.draft": "Tạo CCTP bridge draft từ MetaMask",
    "swap.ready": "Swap {amount} {tokenIn} sang {tokenOut} trên Arc Testnet",
    "swap.draft": "Tạo swap draft trên Arc Testnet",
    "pay.ready": "Pay {amount} {token} cho {recipient} trên {chain}",
    "pay.defaultChain": "chain mặc định",
    "pay.draft": "Tạo payment draft cho contact",
    "request.ready": "Request {amount} {token} từ {payer} trên {destinationChain}",
    "request.draft": "Tạo payment request link",
    "payroll.ready": "Run payroll {batchName} với {amount} USDC mỗi contact",
    "payroll.draft": "Tạo payroll batch cho contacts active",
    "contacts.list": "List contacts",
    "contacts.add": "Add contact {name}",
    "contacts.internal": "Add internal contact from wallet address",
    "contacts.draft": "Thêm contact nhận tiền",
    "gas.chain": "Kiểm tra gas trên {chain}",
    "gas.draft": "Kiểm tra gas wallet",
    "gateway.balanceChain": "Xem Gateway balance trên {chain}",
    "gateway.balance": "Xem Gateway balance",
    "gateway.info": "Xem Circle Gateway domains và contracts",
    "history.filter": "Xem lịch sử {filter}",
    "history.all": "Xem lịch sử giao dịch Gateway",
    "unknown": "Chưa nhận diện được command",
  },
  en: {
    "wallet.title": "Manage Circle wallet",
    "wallet.create": "Create a Circle wallet for this account",
    "wallet.status": "Check Circle wallet status",
    "wallet.balanceChain": "Check USDC in the Circle SCA wallet on {chain}",
    "wallet.balance": "Check USDC in the Circle SCA wallet",
    "wallet.choose": "Choose a wallet action",
    "link.metamask": "Link MetaMask to the current Payna account",
    "link.choose": "Choose which external wallet to link",
    "fund.ready": "Fund {amount} {token} from MetaMask into the Circle wallet on {chain}",
    "fund.draft": "Create a USDC fund draft from MetaMask into the Circle wallet",
    "balance.chain": "Check USDC balance on {chain}",
    "balance.all": "Check total unified USDC balance",
    "deposit.ready": "Deposit {amount} {token} from {sourceChain} into Circle Gateway",
    "deposit.draft": "Create a Gateway deposit draft",
    "withdraw.ready": "Withdraw {amount} {token} from Gateway {sourceChain} to the Circle SCA wallet",
    "withdraw.draft": "Create a Gateway withdraw draft",
    "transfer.ready": "Transfer {amount} {token} from {sourceChain} to {destinationChain}",
    "transfer.draft": "Create a Gateway transfer draft",
    "bridge.readyExternal": "Bridge {amount} {token} from {sourceChain} to {destinationChain} for {recipientAddress}",
    "bridge.ready": "Bridge {amount} {token} from {sourceChain} to {destinationChain}",
    "bridge.draft": "Create a CCTP bridge draft from MetaMask",
    "swap.ready": "Swap {amount} {tokenIn} to {tokenOut} on Arc Testnet",
    "swap.draft": "Create an Arc Testnet swap draft",
    "pay.ready": "Pay {amount} {token} to {recipient} on {chain}",
    "pay.defaultChain": "default chain",
    "pay.draft": "Create a payment draft for a contact",
    "request.ready": "Request {amount} {token} from {payer} on {destinationChain}",
    "request.draft": "Create a payment request link",
    "payroll.ready": "Run payroll {batchName} with {amount} USDC per contact",
    "payroll.draft": "Create a payroll batch for active contacts",
    "contacts.list": "List contacts",
    "contacts.add": "Add contact {name}",
    "contacts.internal": "Add internal contact from wallet address",
    "contacts.draft": "Add a payment contact",
    "gas.chain": "Check gas on {chain}",
    "gas.draft": "Check wallet gas",
    "gateway.balanceChain": "Check Gateway balance on {chain}",
    "gateway.balance": "Check Gateway balance",
    "gateway.info": "View Circle Gateway domains and contracts",
    "history.filter": "View {filter} history",
    "history.all": "View Gateway transaction history",
    "unknown": "Command not recognized",
  },
};

function commandText(locale: CommandLocale | undefined, key: string, params?: Record<string, string>) {
  const resolvedLocale = locale === "en" ? "en" : "vi";
  const template = commandMessages[resolvedLocale][key] ?? commandMessages.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? "");
}
// A local copy of this map used to live here listing only arc/base/avalanche, so 9 of the 12
// supported chains were unparseable no matter what the user typed. Importing the single source
// in lib/paycmd/chains.ts means adding a chain there is enough to make it parseable here.

function tokenFrom(input: string) {
  const token = input.match(/\b(USDC|EURC|USYC|cirBTC|Circle\s*BTC|BTC)\b/i)?.[1] ?? "USDC";
  return normalizeSwapToken(token) || token.toUpperCase();
}

function amountFrom(input: string) {
  return input.match(/\b\d+(\.\d{1,6})?\b/)?.[0] ?? "";
}

function mintGasModeFrom(input: string) {
  return /\b(manual(?:\s+gas)?|no\s+forwarding|without\s+forwarding)\b/i.test(input)
    ? "manual"
    : "auto_forwarding";
}

function bridgeSourceChainFrom(input: string) {
  const token = input.match(
    /\b(?:from|từ|tu)\s+(.+?)(?=\s+(?:to|sang|đến|den)\b)/i,
  )?.[1];

  return token ? normalizeCctpBridgeChain(token.trim()) : "";
}

function bridgeDestinationChainFrom(input: string) {
  const token = input.match(
    /\b(?:to|sang|đến|den)\s+(.+?)(?=\s+(?:\d+(?:\.\d{1,6})?|USDC|EURC|USYC|to\s+0x[a-fA-F0-9]{40}|on\s+my\s+metamask|metamask|manual(?:\s+mint)?|manual\s+gas|no\s+forwarding|without\s+forwarding|slow|standard|fast)\b|$)/i,
  )?.[1];

  return token ? normalizeCctpBridgeChain(token.trim()) : "";
}

function bridgeRecipientAddressFrom(input: string) {
  return input.match(/\bto\s+(0x[a-fA-F0-9]{40})\b/i)?.[1] ?? "";
}

function swapFieldsFrom(input: string) {
  const amount = amountFrom(input);
  const direct = input.match(
    /\b(?:swap|đổi|doi|convert)\s+\d+(?:\.\d{1,8})?\s+([a-zA-Z][a-zA-Z0-9]*)\s+(?:to|sang|ra|for|lấy|lay)\s+([a-zA-Z][a-zA-Z0-9]*)\b/i,
  );
  const tokenIn =
    normalizeSwapToken(direct?.[1]) ||
    normalizeSwapToken(input.match(/\b(?:from|từ|tu)\s+([a-zA-Z][a-zA-Z0-9]*)\b/i)?.[1]) ||
    normalizeSwapToken(input.match(/\b\d+(?:\.\d{1,8})?\s+([a-zA-Z][a-zA-Z0-9]*)\b/i)?.[1]);
  const tokenOut =
    normalizeSwapToken(direct?.[2]) ||
    normalizeSwapToken(input.match(/\b(?:to|sang|ra|for|lấy|lay)\s+([a-zA-Z][a-zA-Z0-9]*)\b/i)?.[1]);

  return { amount, tokenIn, tokenOut };
}

// Built from chainAliases instead of a hardcoded literal. The old regex only listed
// arc/base/avalanche, so the 8 other supported chains parsed as "" — indistinguishable from
// "user named no chain" — and every per-chain command silently widened to all 12 chains.
// Longest alias first so "base-sepolia" is not shadowed by "base".
const chainTokenPattern = Object.keys(chainAliases)
  .sort((a, b) => b.length - a.length)
  .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

// Prepositions are matched in both locales: the UI defaults to Vietnamese, so "trên base"
// has to reach the same field as "on base" or the chain is dropped and the total comes back.
function chainTokenFrom(input: string, prefix?: string) {
  const pattern = prefix
    ? new RegExp(String.raw`\b(?:${prefix})\s+(${chainTokenPattern})\b`, "i")
    : new RegExp(String.raw`\b(${chainTokenPattern})\b`, "i");
  const token = input.match(pattern)?.[1]?.toLowerCase();

  return token ? chainAliases[token] ?? "" : "";
}

function chainFrom(input: string) {
  return chainTokenFrom(input);
}

function sourceChainFrom(input: string) {
  return chainTokenFrom(input, String.raw`from|từ|tu`);
}

function gatewaySourceModeFrom(input: string): "scoped" | "unified" {
  return /\b(?:from|từ|tu)\s+gateway\b/i.test(input) ? "unified" : "scoped";
}

function destinationChainFrom(input: string) {
  return chainTokenFrom(input, String.raw`to|sang|tới|toi|đến|den`);
}

function onChainFrom(input: string) {
  return chainTokenFrom(input, String.raw`on|trên|tren`);
}

function recipientFrom(input: string) {
  return input.match(/\bto\s+(.+?)(?:\s+(?:on|from)\s+|$)/i)?.[1]?.trim() ?? "";
}

function payerFrom(input: string) {
  return input.match(/\bfrom\s+(.+?)(?:\s+on\s+|$)/i)?.[1]?.trim() ?? "";
}

function contactFieldsFrom(input: string) {
  const addressOnlyMatch = input.match(/^\/?contacts\s+add\s+@?(0x[a-fA-F0-9]{40})(?:\s+on\s+(.+))?$/i);
  if (addressOnlyMatch) {
    const address = addressOnlyMatch[1]?.trim() ?? "";
    const chain = addressOnlyMatch[2]
      ? chainAliases[addressOnlyMatch[2].trim().toLowerCase() as keyof typeof chainAliases] ?? ""
      : "";

    return { name: "", address, chain };
  }

  const match = input.match(/^\/?contacts\s+add\s+(.+?)\s+@?(0x[a-fA-F0-9]{40})(?:\s+on\s+(.+))?$/i);
  const name = match?.[1]?.trim() ?? "";
  const address = match?.[2]?.trim() ?? "";
  const chain = match?.[3] ? chainAliases[match[3].trim().toLowerCase() as keyof typeof chainAliases] ?? "" : "";

  return { name, address, chain };
}

function compact(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

function result(
  command: CommandName,
  raw: string,
  fields: Record<string, string>,
  requiredFields: string[],
  sample: string,
  summary: string,
): ParsedCommand {
  const missingFields = requiredFields.filter((field) => !fields[field]);

  return {
    command,
    raw,
    fields,
    missingFields,
    sample,
    summary,
    status: missingFields.length ? "needs_input" : "draft_ready",
  };
}

export const commandRegistry: PayCmdCommand[] = [
  {
    name: "wallet",
    aliases: ["/wallet", "wallet"],
    // `title` is prompt metadata, not UI text: the only consumer is `commandCatalog()` in
    // app/api/ai/command/route.ts, which serializes it into an otherwise all-English prompt.
    // These used to resolve through `commandText("vi", …)`, which leaked Vietnamese into the
    // catalog even when the route asked the model to answer in English. Output language is
    // controlled separately by `responseLanguageInstruction`, so keep these literal and English.
    title: "Manage Circle wallet",
    sample: "/wallet status",
    requiredFields: ["action"],
    parse(input, locale) {
      const raw = compact(input);
      const action = raw.match(/\b(create|status|balance)\b/i)?.[1]?.toLowerCase() ?? "";
      const chain = chainFrom(raw);

      return result(
        "wallet",
        raw,
        { action, chain },
        this.requiredFields,
        this.sample,
        action === "create"
          ? commandText(locale, "wallet.create")
          : action === "status"
            ? commandText(locale, "wallet.status")
            : action === "balance"
              ? chain
                ? commandText(locale, "wallet.balanceChain", { chain })
                : commandText(locale, "wallet.balance")
            : commandText(locale, "wallet.choose"),
      );
    },
  },
  {
    name: "link",
    aliases: ["/link", "link"],
    title: "Link external wallet",
    sample: "/link metamask",
    requiredFields: ["walletType"],
    parse(input, locale) {
      const raw = compact(input);
      const walletType = raw.match(/\bmetamask\b/i)?.[0]?.toLowerCase() ?? "";

      return result(
        "link",
        raw,
        { walletType },
        this.requiredFields,
        this.sample,
        walletType === "metamask"
          ? commandText(locale, "link.metamask")
          : commandText(locale, "link.choose"),
      );
    },
  },
  {
    name: "fund",
    aliases: ["/fund", "fund"],
    title: "Fund Circle wallet",
    sample: "/fund 50 from metamask on base",
    requiredFields: ["amount", "sourceWallet", "chain"],
    parse(input, locale) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const sourceWallet = raw.match(/\bfrom\s+metamask\b/i)?.[0] ? "metamask" : "";
      const chain = onChainFrom(raw) || chainFrom(raw);
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "fund",
        raw,
        { amount: safeAmount, token, sourceWallet, chain },
        this.requiredFields,
        this.sample,
        safeAmount && chain
          ? commandText(locale, "fund.ready", { amount: safeAmount, token, chain })
          : commandText(locale, "fund.draft"),
      );
    },
  },
  {
    name: "balance",
    aliases: ["/balance", "balance"],
    title: "Check unified balance",
    sample: "/balance",
    requiredFields: [],
    parse(input, locale) {
      const raw = compact(input);
      const chain = chainFrom(raw);

      return result(
        "balance",
        raw,
        { chain },
        this.requiredFields,
        this.sample,
        chain ? commandText(locale, "balance.chain", { chain }) : commandText(locale, "balance.all"),
      );
    },
  },
  {
    name: "deposit",
    aliases: ["/deposit", "deposit"],
    title: "Create a Gateway deposit draft",
    sample: "/deposit 50 from arc",
    requiredFields: ["amount", "sourceChain"],
    parse(input, locale) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const sourceChain = sourceChainFrom(raw) || chainFrom(raw);
      const safeAmount = swapAmountSchema.safeParse(amount).success ? amount : "";

      return result(
        "deposit",
        raw,
        { amount: safeAmount, token, sourceChain },
        this.requiredFields,
        this.sample,
        sourceChain && safeAmount
          ? commandText(locale, "deposit.ready", { amount: safeAmount, token, sourceChain })
          : commandText(locale, "deposit.draft"),
      );
    },
  },
  {
    name: "withdraw",
    aliases: ["/withdraw", "withdraw"],
    title: "Create a Gateway withdraw draft",
    sample: "/withdraw 5 from base",
    requiredFields: ["amount", "sourceChain"],
    parse(input, locale) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const sourceChain = sourceChainFrom(raw) || chainFrom(raw);
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "withdraw",
        raw,
        { amount: safeAmount, token, sourceChain },
        this.requiredFields,
        this.sample,
        sourceChain && safeAmount
          ? commandText(locale, "withdraw.ready", { amount: safeAmount, token, sourceChain })
          : commandText(locale, "withdraw.draft"),
      );
    },
  },
  {
    name: "transfer",
    aliases: ["/transfer", "transfer"],
    title: "Create a Gateway transfer draft",
    sample: "/transfer 10 from base to arc",
    requiredFields: ["amount", "sourceChain", "destinationChain"],
    parse(input, locale) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const sourceMode = gatewaySourceModeFrom(raw);
      const sourceChain = sourceChainFrom(raw);
      const destinationChain = destinationChainFrom(raw);
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";
      const requiredFields = sourceMode === "unified"
        ? ["amount", "destinationChain"]
        : this.requiredFields;

      return result(
        "transfer",
        raw,
        { amount: safeAmount, token, sourceMode, sourceChain, destinationChain, mintGasMode: mintGasModeFrom(raw) },
        requiredFields,
        this.sample,
        (sourceMode === "unified" || sourceChain) && destinationChain && safeAmount
          ? commandText(locale, "transfer.ready", {
              amount: safeAmount,
              token,
              sourceChain: sourceMode === "unified" ? "Gateway" : sourceChain,
              destinationChain,
            })
          : commandText(locale, "transfer.draft"),
      );
    },
  },
  {
    name: "bridge",
    aliases: ["/bridge", "bridge"],
    title: "Create a CCTP bridge draft from MetaMask",
    sample: "/bridge 10 USDC from base to arc",
    requiredFields: ["amount", "sourceChain", "destinationChain"],
    parse(input, locale) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const sourceChain = bridgeSourceChainFrom(raw);
      const destinationChain = bridgeDestinationChainFrom(raw);
      const recipientAddress = bridgeRecipientAddressFrom(raw);
      const bridgeMintMode = bridgeModeFrom(raw);
      const transferSpeed = bridgeSpeedFrom(raw);
      const recipientMode = recipientAddress ? "external" : "self";
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "bridge",
        raw,
        {
          amount: safeAmount,
          token,
          sourceChain,
          destinationChain,
          recipientAddress,
          recipientMode,
          bridgeMintMode,
          transferSpeed,
        },
        this.requiredFields,
        this.sample,
        sourceChain && destinationChain && safeAmount
          ? recipientAddress
            ? commandText(locale, "bridge.readyExternal", { amount: safeAmount, token, sourceChain, destinationChain, recipientAddress })
            : commandText(locale, "bridge.ready", { amount: safeAmount, token, sourceChain, destinationChain })
          : commandText(locale, "bridge.draft"),
      );
    },
  },
  {
    name: "swap",
    aliases: ["/swap", "swap", "đổi", "doi", "convert"],
    title: "Create an Arc Testnet swap draft",
    sample: "/swap 1 USDC to EURC",
    requiredFields: ["amount", "tokenIn", "tokenOut"],
    parse(input, locale) {
      const raw = compact(input);
      const { amount, tokenIn, tokenOut } = swapFieldsFrom(raw);
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "swap",
        raw,
        { amount: safeAmount, tokenIn, tokenOut, chain: "arcTestnet" },
        this.requiredFields,
        this.sample,
        safeAmount && tokenIn && tokenOut
          ? commandText(locale, "swap.ready", { amount: safeAmount, tokenIn, tokenOut })
          : commandText(locale, "swap.draft"),
      );
    },
  },
  {
    name: "pay",
    aliases: ["/pay", "pay"],
    title: "Pay contact",
    sample: "/pay 25 to Minh on arc from base",
    requiredFields: ["amount", "recipient", "sourceChain", "destinationChain"],
    parse(input, locale) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const recipient = recipientFrom(raw);
      const destinationChain = onChainFrom(raw) || destinationChainFrom(raw);
      const sourceMode = gatewaySourceModeFrom(raw);
      const sourceChain = sourceChainFrom(raw);
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";
      const requiredFields = sourceMode === "unified"
        ? ["amount", "recipient", "destinationChain"]
        : this.requiredFields;

      return result(
        "pay",
        raw,
        { amount: safeAmount, token, recipient, destinationChain, sourceMode, sourceChain, mintGasMode: mintGasModeFrom(raw) },
        requiredFields,
        this.sample,
        recipient && safeAmount && destinationChain && (sourceMode === "unified" || sourceChain)
          ? commandText(locale, "pay.ready", {
              amount: safeAmount,
              token,
              recipient,
              chain: destinationChain,
            })
          : commandText(locale, "pay.draft"),
      );
    },
  },
  {
    name: "request",
    aliases: ["/request", "request"],
    title: "Request payment",
    sample: "/request 25 from Minh on arc",
    requiredFields: ["amount", "payer", "destinationChain"],
    parse(input, locale) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const payer = payerFrom(raw);
      const destinationChain = onChainFrom(raw);
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "request",
        raw,
        { amount: safeAmount, token, payer, destinationChain },
        this.requiredFields,
        this.sample,
        payer && safeAmount
          ? commandText(locale, "request.ready", { amount: safeAmount, token, payer, destinationChain })
          : commandText(locale, "request.draft"),
      );
    },
  },
  {
    name: "payroll",
    aliases: ["/payroll", "payroll"],
    title: "Run payroll",
    sample: "/payroll run team 25 from base",
    requiredFields: ["action", "batchName", "amount"],
    parse(input, locale) {
      const raw = compact(input);
      const action = raw.match(/\b(run|create)\b/i)?.[1]?.toLowerCase() ?? "";
      const batchName = raw.match(/\b(?:run|create)\s+([a-zA-Z0-9_-]+)/i)?.[1] ?? "";
      const amount = amountFrom(raw);
      const sourceChain = sourceChainFrom(raw);
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "payroll",
        raw,
        { action, batchName, amount: safeAmount, sourceChain },
        this.requiredFields,
        this.sample,
        batchName && safeAmount
          ? commandText(locale, "payroll.ready", { batchName, amount: safeAmount })
          : commandText(locale, "payroll.draft"),
      );
    },
  },
  {
    name: "contacts",
    aliases: ["/contacts", "contacts"],
    title: "Manage contacts",
    sample: "/contacts add Minh 0x0000000000000000000000000000000000000000 on arc",
    requiredFields: ["action", "name", "address"],
    parse(input, locale) {
      const raw = compact(input);
      const action = raw.match(/\b(add|list)\b/i)?.[1]?.toLowerCase() ?? "";
      const contact = contactFieldsFrom(raw);
      const requiredFields =
        action === "list" ? ["action"] : action === "add" ? ["action", "address"] : this.requiredFields;

      return result(
        "contacts",
        raw,
        { action, ...contact },
        requiredFields,
        this.sample,
        action === "list"
          ? commandText(locale, "contacts.list")
          : contact.name && contact.address
            ? commandText(locale, "contacts.add", { name: contact.name })
            : contact.address
              ? commandText(locale, "contacts.internal")
            : commandText(locale, "contacts.draft"),
      );
    },
  },
  {
    name: "gas",
    aliases: ["/gas", "gas"],
    title: "Check wallet gas",
    sample: "/gas check arc",
    requiredFields: ["action", "chain"],
    parse(input, locale) {
      const raw = compact(input);
      const action = raw.match(/\bcheck\b/i)?.[0]?.toLowerCase() ?? "";
      const chain = chainFrom(raw);

      return result(
        "gas",
        raw,
        { action, chain },
        this.requiredFields,
        this.sample,
        chain ? commandText(locale, "gas.chain", { chain }) : commandText(locale, "gas.draft"),
      );
    },
  },
  {
    name: "gateway",
    aliases: ["/gateway", "gateway"],
    title: "Gateway info",
    sample: "/gateway info",
    requiredFields: ["action"],
    parse(input, locale) {
      const raw = compact(input);
      const action = raw.match(/\b(info|balance)\b/i)?.[0]?.toLowerCase() ?? "";
      const chain = chainFrom(raw);

      return result(
        "gateway",
        raw,
        { action, chain },
        this.requiredFields,
        this.sample,
        action === "balance"
          ? chain
            ? commandText(locale, "gateway.balanceChain", { chain })
            : commandText(locale, "gateway.balance")
          : commandText(locale, "gateway.info"),
      );
    },
  },
  {
    name: "history",
    aliases: ["/history", "history"],
    title: "View Gateway transaction history",
    sample: "/history",
    requiredFields: [],
    parse(input, locale) {
      const raw = compact(input);
      const filter = raw.match(/\b(fund|deposit|withdraw|transfer|unify|bridge|swap)\b/i)?.[1]?.toLowerCase() ?? "";

      return result(
        "history",
        raw,
        { filter },
        this.requiredFields,
        this.sample,
        filter ? commandText(locale, "history.filter", { filter }) : commandText(locale, "history.all"),
      );
    },
  },
];

export function parsePayCmd(input: string, locale?: CommandLocale): ParsedCommand {
  const normalized = compact(input);
  const commandToken = normalized.match(/^\/?([a-zA-Z]+)/)?.[1]?.toLowerCase();
  const command =
    commandRegistry.find((item) => item.name === commandToken) ??
    commandRegistry.find((item) =>
      item.aliases.some((alias) => normalized.toLowerCase().startsWith(alias)),
    );

  if (!command) {
    return {
      command: "balance",
      raw: normalized,
      fields: {},
      missingFields: ["command"],
      sample: "/balance",
      summary: commandText(locale, "unknown"),
      status: "needs_input",
    };
  }

  return command.parse(normalized, locale);
}

export function createDemoExecution(parsed: ParsedCommand) {
  const now = new Date();
  const id = `cmd_${now.getTime()}`;

  return {
    id,
    draftId: `draft_${now.getTime()}`,
    command: parsed.command,
    status: "queued" as CommandStatus,
    title: parsed.summary,
    createdAt: now.toISOString(),
    estimatedSettlement: new Date(now.getTime() + 9000).toISOString(),
    gateway: {
      network: "Arc Testnet",
      rail: "Circle Gateway",
      mode: "demo",
    },
  };
}

export function requiresConfirmation(command: ParsedCommand) {
  return (
    (command.command === "wallet" && command.fields.action === "create") ||
    command.command === "deposit" ||
    command.command === "fund" ||
    command.command === "bridge" ||
    command.command === "swap" ||
    command.command === "withdraw" ||
    command.command === "transfer" ||
    command.command === "pay" ||
    command.command === "payroll"
  );
}
