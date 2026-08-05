export type NavigationPlacement = "desktop" | "mobile-primary" | "mobile-more";

export type AppNavigationItem = {
  key: "chat" | "activity" | "budgets" | "contacts" | "schedules" | "profile" | "more";
  href?: string;
  placements: NavigationPlacement[];
};

const appNavigationItems: AppNavigationItem[] = [
  { key: "chat", href: "/app", placements: ["desktop", "mobile-primary"] },
  { key: "activity", href: "/activity", placements: ["desktop", "mobile-primary"] },
  { key: "budgets", href: "/budgets", placements: ["desktop", "mobile-more"] },
  { key: "contacts", href: "/contacts", placements: ["desktop", "mobile-primary"] },
  { key: "schedules", href: "/schedules", placements: ["desktop", "mobile-more"] },
  { key: "profile", href: "/profile", placements: ["desktop", "mobile-more"] },
  { key: "more", placements: ["mobile-primary"] },
];

export function navigationFor(placement: NavigationPlacement) {
  return appNavigationItems.filter((item) => item.placements.includes(placement));
}

export type ActivityTab = "transactions" | "notifications";

export function activityTabFrom(value: string | null | undefined): ActivityTab {
  return value === "notifications" ? "notifications" : "transactions";
}

export type PreviewDraft = {
  command: string;
  summary: string;
  fields: Record<string, string>;
};

export type TransactionPreviewField = {
  key: string;
  label: string;
  value: string;
};

export type TransactionPreviewModel = {
  command: string;
  summary: string;
  rail: string;
  fee: string;
  risk: string;
  amount?: string;
  token?: string;
  recipient?: string;
  sourceChain?: string;
  destinationChain?: string;
  confirmLabel: string;
  fields: TransactionPreviewField[];
  advancedDetails: TransactionPreviewField[];
};

const previewFieldLabels: Record<string, string> = {
  action: "Action",
  amount: "Amount",
  token: "Token",
  tokenIn: "Pay with",
  tokenOut: "Receive",
  recipient: "Recipient",
  recipientAddress: "Recipient",
  payer: "Payer",
  sourceChain: "From network",
  destinationChain: "To network",
  chain: "Network",
  batchName: "Batch",
  frequency: "Frequency",
  totalExposure: "Total exposure",
};

const stablePreviewFieldKeys = new Set([
  "amount",
  "token",
  "tokenIn",
  "sourceChain",
  "destinationChain",
  "chain",
  "recipient",
  "recipientAddress",
]);

function humanizePreviewKey(key: string) {
  const value = key.replace(/([a-z])([A-Z])/g, "$1 $2");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const hiddenPreviewFields = new Set([
  "mintGasMode",
  "bridgeMintMode",
  "transferSpeed",
  "recipientMode",
]);

const advancedFieldLabels: Record<string, string> = {
  mintGasMode: "Destination gas",
  bridgeMintMode: "Mint mode",
  transferSpeed: "Transfer speed",
  recipientMode: "Recipient mode",
};

function transactionRail(command: string) {
  if (command === "bridge") return "CCTP v2";
  if (["deposit", "withdraw", "transfer", "pay"].includes(command)) return "Circle Gateway";
  if (command === "swap") return "Payna Swap";
  if (command === "fund") return "Circle wallet";
  if (command === "payroll") return "Payment batch";
  return "Payna";
}

function transactionRisk(draft: PreviewDraft) {
  if (draft.command === "bridge" || draft.command === "transfer") return "Cross-chain finality";
  if (draft.command === "swap") return "Price movement and slippage";
  if (draft.fields.recipientAddress || draft.fields.recipient) return "Verify the recipient before signing";
  return "Wallet approval required";
}

export function buildTransactionPreviewModel(draft: PreviewDraft): TransactionPreviewModel {
  const token = draft.fields.token || draft.fields.tokenIn || (draft.command === "payroll" ? "USDC" : undefined);
  const amount = draft.fields.amount;
  const sourceChain = draft.fields.sourceChain || draft.fields.chain;
  const destinationChain = draft.fields.destinationChain;
  const recipient = draft.fields.recipient || draft.fields.recipientAddress;
  const confirmLabel = amount
    ? `Confirm ${amount}${token ? ` ${token}` : ""}`
    : "Confirm command";

  const fields: TransactionPreviewField[] = [
    { key: "amount", label: "Amount", value: amount || "Not provided" },
    { key: "token", label: "Token", value: token || "USDC" },
    { key: "sourceChain", label: "From network", value: sourceChain || "Connected network" },
    { key: "destinationChain", label: "To network", value: destinationChain || sourceChain || "Same network" },
    {
      key: "recipient",
      label: "Recipient",
      value: recipient || (draft.command === "payroll" ? "Active contacts" : "Connected wallet"),
    },
    ...Object.entries(draft.fields)
    .filter(([key, value]) =>
      Boolean(value) &&
      !hiddenPreviewFields.has(key) &&
      !stablePreviewFieldKeys.has(key) &&
      key !== "estimatedFee" &&
      key !== "fee",
    )
    .map(([key, value]) => ({
      key,
      label: previewFieldLabels[key] ?? humanizePreviewKey(key),
      value,
    })),
  ];
  const advancedDetails = Object.entries(draft.fields)
    .filter(([key, value]) => Boolean(value) && hiddenPreviewFields.has(key))
    .map(([key, value]) => ({
      key,
      label: advancedFieldLabels[key] ?? humanizePreviewKey(key),
      value,
    }));

  return {
    command: draft.command,
    summary: draft.summary,
    rail: transactionRail(draft.command),
    fee: draft.fields.estimatedFee || draft.fields.fee || "Shown by wallet before signing",
    risk: transactionRisk(draft),
    amount,
    token,
    recipient,
    sourceChain,
    destinationChain,
    confirmLabel,
    fields,
    advancedDetails,
  };
}

export type ExecutionDisplayStatus = "queued" | "running" | "waiting_gateway" | "success" | "failed";
export type ExecutionStepState = "complete" | "active" | "upcoming" | "failed";
export type ExecutionStepKey = "prepared" | "wallet_approval" | "submitted" | "finalizing" | "complete";

export type ExecutionStep = {
  key: ExecutionStepKey;
  state: ExecutionStepState;
};

const executionStepKeys: ExecutionStepKey[] = [
  "prepared",
  "wallet_approval",
  "submitted",
  "finalizing",
  "complete",
];

const activeStepIndex: Record<Exclude<ExecutionDisplayStatus, "success" | "failed">, number> = {
  queued: 0,
  running: 1,
  waiting_gateway: 3,
};

export function executionStepsForStatus(
  status: ExecutionDisplayStatus,
  context: { fundsMoved?: boolean; submitted?: boolean; historical?: boolean } = {},
): ExecutionStep[] {
  if (status === "success") {
    return executionStepKeys.map((key) => ({ key, state: "complete" }));
  }

  const activeIndex =
    status === "failed"
      ? context.fundsMoved
        ? 3
        : 1
      : status === "waiting_gateway" && !context.submitted
        ? 1
        : activeStepIndex[status];

  if (context.historical && status !== "failed") {
    return executionStepKeys.map((key, index) => ({
      key,
      state: index <= activeIndex ? "complete" : "upcoming",
    }));
  }

  return executionStepKeys.map((key, index) => ({
    key,
    state:
      index < activeIndex
        ? "complete"
        : index === activeIndex
          ? status === "failed"
            ? "failed"
            : "active"
          : "upcoming",
  }));
}

export function canSafelyRetryExecutionFailure({
  errorCode,
  fundsMoved = false,
  transferSubmitted = false,
}: {
  errorCode?: string | number;
  fundsMoved?: boolean;
  transferSubmitted?: boolean;
}) {
  return !fundsMoved && !transferSubmitted && errorCode === 4001;
}

export function gatewayTransferSubmitted(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const transferId = (value as Record<string, unknown>).transferId;
  return typeof transferId === "string" && transferId.trim().length > 0;
}
