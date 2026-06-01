import { z } from "zod";

export const commandNames = ["pay", "createbudget", "schedule"] as const;

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

function tokenFrom(input: string) {
  return input.match(/\b(USDC|EURC|USYC)\b/i)?.[1].toUpperCase() ?? "USDC";
}

function amountFrom(input: string) {
  return input.match(/\b\d+(\.\d{1,6})?\b/)?.[0] ?? "";
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
    name: "pay",
    aliases: ["/pay", "pay", "send"],
    title: "Thanh toán một lần",
    sample: "/pay 50 USDC to Minh",
    requiredFields: ["amount", "token", "recipient"],
    parse(input) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const recipient =
        raw.match(/\bto\s+([a-zA-Z0-9_. -]+)$/i)?.[1]?.trim() ?? "";
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "pay",
        raw,
        { amount: safeAmount, token, recipient },
        this.requiredFields,
        this.sample,
        recipient && safeAmount
          ? `Gửi ${safeAmount} ${token} cho ${recipient}`
          : "Tạo payment draft",
      );
    },
  },
  {
    name: "createbudget",
    aliases: ["/createbudget", "createbudget", "budget"],
    title: "Tạo ngân sách",
    sample: "/createbudget Marketing 500",
    requiredFields: ["budgetName", "amount", "token"],
    parse(input) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const budgetName = raw
        .replace(/^\/?createbudget\s+/i, "")
        .replace(/\b\d+(\.\d{1,6})?\b.*$/i, "")
        .trim();
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "createbudget",
        raw,
        { budgetName, amount: safeAmount, token },
        this.requiredFields,
        this.sample,
        budgetName && safeAmount
          ? `Tạo ngân sách ${budgetName} ${safeAmount} ${token}`
          : "Tạo budget draft",
      );
    },
  },
  {
    name: "schedule",
    aliases: ["/schedule", "schedule", "recurring"],
    title: "Thanh toán định kỳ",
    sample: "/schedule 25 USDC monthly to Minh",
    requiredFields: ["amount", "token", "frequency", "recipient"],
    parse(input) {
      const raw = compact(input);
      const amount = amountFrom(raw);
      const token = tokenFrom(raw);
      const frequency =
        raw.match(/\b(daily|weekly|monthly|quarterly)\b/i)?.[1]?.toLowerCase() ??
        "";
      const recipient =
        raw.match(/\bto\s+([a-zA-Z0-9_. -]+)$/i)?.[1]?.trim() ?? "";
      const safeAmount = amountSchema.safeParse(amount).success ? amount : "";

      return result(
        "schedule",
        raw,
        { amount: safeAmount, token, frequency, recipient },
        this.requiredFields,
        this.sample,
        recipient && safeAmount && frequency
          ? `Lên lịch ${safeAmount} ${token} ${frequency} cho ${recipient}`
          : "Tạo schedule draft",
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
      command: "pay",
      raw: normalized,
      fields: {},
      missingFields: ["command"],
      sample: "/pay 50 USDC to Minh",
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
