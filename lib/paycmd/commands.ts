import { z } from "zod";

export const commandNames = [
  "wallet",
  "link",
  "fund",
  "balance",
  "deposit",
  "transfer",
  "pay",
  "request",
  "payroll",
  "contacts",
  "gas",
  "gateway",
  "history",
] as const;

export type CommandName = (typeof commandNames)[number];

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
  parse(input: string): ParsedCommand;
};

const amountSchema = z.string().regex(/^\d+(\.\d{1,6})?$/);
const chainAliases = {
  arc: "arcTestnet",
  arctestnet: "arcTestnet",
  "arc-testnet": "arcTestnet",
  base: "baseSepolia",
  basesepolia: "baseSepolia",
  "base-sepolia": "baseSepolia",
  avalanche: "avalancheFuji",
  avax: "avalancheFuji",
  fuji: "avalancheFuji",
  avalanchefuji: "avalancheFuji",
  "avalanche-fuji": "avalancheFuji",
} as const;

function tokenFrom(input: string) {
  return input.match(/\b(USDC|EURC|USYC)\b/i)?.[1].toUpperCase() ?? "USDC";
}

function amountFrom(input: string) {
  return input.match(/\b\d+(\.\d{1,6})?\b/)?.[0] ?? "";
}

function chainFrom(input: string) {
  const token = input
    .match(/\b(arc(?:-?testnet)?|base(?:-?sepolia)?|avalanche(?:-?fuji)?|avax|fuji)\b/i)?.[1]
    ?.toLowerCase();

  return token ? chainAliases[token as keyof typeof chainAliases] ?? "" : "";
}

function sourceChainFrom(input: string) {
  const token = input.match(/\bfrom\s+(arc(?:-?testnet)?|base(?:-?sepolia)?|avalanche(?:-?fuji)?|avax|fuji)\b/i)?.[1];
  return token ? chainAliases[token.toLowerCase() as keyof typeof chainAliases] ?? "" : "";
}

function destinationChainFrom(input: string) {
  const token = input.match(/\bto\s+(arc(?:-?testnet)?|base(?:-?sepolia)?|avalanche(?:-?fuji)?|avax|fuji)\b/i)?.[1];
  return token ? chainAliases[token.toLowerCase() as keyof typeof chainAliases] ?? "" : "";
}

function onChainFrom(input: string) {
  const token = input.match(/\bon\s+(arc(?:-?testnet)?|base(?:-?sepolia)?|avalanche(?:-?fuji)?|avax|fuji)\b/i)?.[1];
  return token ? chainAliases[token.toLowerCase() as keyof typeof chainAliases] ?? "" : "";
}

function recipientFrom(input: string) {
  return input.match(/\bto\s+(.+?)(?:\s+(?:on|from)\s+|$)/i)?.[1]?.trim() ?? "";
}

function payerFrom(input: string) {
  return input.match(/\bfrom\s+(.+?)(?:\s+on\s+|$)/i)?.[1]?.trim() ?? "";
}

function contactFieldsFrom(input: string) {
  const match = input.match(/^\/?contacts\s+add\s+(.+?)\s+(0x[a-fA-F0-9]{40})(?:\s+on\s+(.+))?$/i);
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
    title: "Quản lý ví Circle",
    sample: "/wallet status",
    requiredFields: ["action"],
    parse(input) {
      const raw = compact(input);
      const action = raw.match(/\b(create|status)\b/i)?.[1]?.toLowerCase() ?? "";

      return result(
        "wallet",
        raw,
        { action },
        this.requiredFields,
        this.sample,
        action === "create"
          ? "Tạo Circle wallet cho tài khoản này"
          : action === "status"
            ? "Kiểm tra trạng thái Circle wallet"
            : "Chọn wallet action",
      );
    },
  },
  {
    name: "link",
    aliases: ["/link", "link"],
    title: "Link external wallet",
    sample: "/link metamask",
    requiredFields: ["walletType"],
    parse(input) {
      const raw = compact(input);
      const walletType = raw.match(/\bmetamask\b/i)?.[0]?.toLowerCase() ?? "";

      return result(
        "link",
        raw,
        { walletType },
        this.requiredFields,
        this.sample,
        walletType === "metamask"
          ? "Link MetaMask vào tài khoản PayCMD hiện tại"
          : "Chọn external wallet cần link",
      );
    },
  },
  {
    name: "fund",
    aliases: ["/fund", "fund"],
    title: "Fund Circle wallet",
    sample: "/fund 50 from metamask on base",
    requiredFields: ["amount", "sourceWallet", "chain"],
    parse(input) {
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
          ? `Fund ${safeAmount} ${token} từ MetaMask vào Circle wallet trên ${chain}`
          : "Tạo lệnh nạp USDC từ MetaMask vào Circle wallet",
      );
    },
  },
  {
    name: "balance",
    aliases: ["/balance", "balance"],
    title: "Xem unified balance",
    sample: "/balance",
    requiredFields: [],
    parse(input) {
      const raw = compact(input);
      const chain = chainFrom(raw);

      return result(
        "balance",
        raw,
        { chain },
        this.requiredFields,
        this.sample,
        chain ? `Xem USDC balance trên ${chain}` : "Xem tổng unified USDC balance",
      );
    },
  },
  {
    name: "deposit",
    aliases: ["/deposit", "deposit"],
    title: "Deposit vào Gateway",
    sample: "/deposit 50 from arc",
    requiredFields: ["amount", "sourceChain"],
    parse(input) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const sourceChain = sourceChainFrom(raw) || chainFrom(raw);
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "deposit",
        raw,
        { amount: safeAmount, token, sourceChain },
        this.requiredFields,
        this.sample,
        sourceChain && safeAmount
          ? `Deposit ${safeAmount} ${token} từ ${sourceChain} vào Circle Gateway`
          : "Tạo Gateway deposit draft",
      );
    },
  },
  {
    name: "transfer",
    aliases: ["/transfer", "transfer"],
    title: "Chuyển unified balance",
    sample: "/transfer 10 from base to arc",
    requiredFields: ["amount", "sourceChain", "destinationChain"],
    parse(input) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const sourceChain = sourceChainFrom(raw);
      const destinationChain = destinationChainFrom(raw);
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "transfer",
        raw,
        { amount: safeAmount, token, sourceChain, destinationChain },
        this.requiredFields,
        this.sample,
        sourceChain && destinationChain && safeAmount
          ? `Transfer ${safeAmount} ${token} từ ${sourceChain} sang ${destinationChain}`
          : "Tạo Gateway transfer draft",
      );
    },
  },
  {
    name: "pay",
    aliases: ["/pay", "pay"],
    title: "Pay contact",
    sample: "/pay 25 to Minh on arc from base",
    requiredFields: ["amount", "recipient", "destinationChain"],
    parse(input) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const recipient = recipientFrom(raw);
      const destinationChain = onChainFrom(raw) || destinationChainFrom(raw);
      const sourceChain = sourceChainFrom(raw);
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "pay",
        raw,
        { amount: safeAmount, token, recipient, destinationChain, sourceChain },
        this.requiredFields,
        this.sample,
        recipient && safeAmount
          ? `Pay ${safeAmount} ${token} cho ${recipient} trên ${destinationChain || "chain mặc định"}`
          : "Tạo payment draft cho contact",
      );
    },
  },
  {
    name: "request",
    aliases: ["/request", "request"],
    title: "Request payment",
    sample: "/request 25 from Minh on arc",
    requiredFields: ["amount", "payer", "destinationChain"],
    parse(input) {
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
          ? `Request ${safeAmount} ${token} từ ${payer} trên ${destinationChain}`
          : "Tạo payment request link",
      );
    },
  },
  {
    name: "payroll",
    aliases: ["/payroll", "payroll"],
    title: "Run payroll",
    sample: "/payroll run team 25 from base",
    requiredFields: ["action", "batchName", "amount"],
    parse(input) {
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
          ? `Run payroll ${batchName} với ${safeAmount} USDC mỗi contact`
          : "Tạo payroll batch cho contacts active",
      );
    },
  },
  {
    name: "contacts",
    aliases: ["/contacts", "contacts"],
    title: "Manage contacts",
    sample: "/contacts add Minh 0x0000000000000000000000000000000000000000 on arc",
    requiredFields: ["action", "name", "address"],
    parse(input) {
      const raw = compact(input);
      const action = raw.match(/\b(add|list)\b/i)?.[1]?.toLowerCase() ?? "";
      const contact = contactFieldsFrom(raw);

      return result(
        "contacts",
        raw,
        { action, ...contact },
        action === "list" ? ["action"] : this.requiredFields,
        this.sample,
        action === "list"
          ? "List contacts"
          : contact.name && contact.address
            ? `Add contact ${contact.name}`
            : "Thêm contact nhận tiền",
      );
    },
  },
  {
    name: "gas",
    aliases: ["/gas", "gas"],
    title: "Kiểm tra gas",
    sample: "/gas check arc",
    requiredFields: ["action", "chain"],
    parse(input) {
      const raw = compact(input);
      const action = raw.match(/\bcheck\b/i)?.[0]?.toLowerCase() ?? "";
      const chain = chainFrom(raw);

      return result(
        "gas",
        raw,
        { action, chain },
        this.requiredFields,
        this.sample,
        chain ? `Kiểm tra gas trên ${chain}` : "Kiểm tra gas wallet",
      );
    },
  },
  {
    name: "gateway",
    aliases: ["/gateway", "gateway"],
    title: "Gateway info",
    sample: "/gateway info",
    requiredFields: ["action"],
    parse(input) {
      const raw = compact(input);
      const action = raw.match(/\binfo\b/i)?.[0]?.toLowerCase() ?? "";

      return result(
        "gateway",
        raw,
        { action },
        this.requiredFields,
        this.sample,
        "Xem Circle Gateway domains và contracts",
      );
    },
  },
  {
    name: "history",
    aliases: ["/history", "history"],
    title: "Lịch sử giao dịch",
    sample: "/history",
    requiredFields: [],
    parse(input) {
      const raw = compact(input);
      const filter = raw.match(/\b(fund|deposit|transfer)\b/i)?.[1]?.toLowerCase() ?? "";

      return result(
        "history",
        raw,
        { filter },
        this.requiredFields,
        this.sample,
        filter ? `Xem lịch sử ${filter}` : "Xem lịch sử giao dịch Gateway",
      );
    },
  },
];

export function parsePayCmd(input: string): ParsedCommand {
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
      summary: "Chưa nhận diện được command",
      status: "needs_input",
    };
  }

  return command.parse(normalized);
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
    command.command === "transfer" ||
    command.command === "pay" ||
    command.command === "payroll"
  );
}
