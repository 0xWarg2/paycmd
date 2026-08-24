import type { ParsedCommand } from "./commands.ts";
import { gatewayTransferAmounts } from "./gateway-transfer.ts";

/**
 * Builds the short inbox notification for a completed chat command: a title that carries the
 * key fact, a one-line body, and structured metadata the activity page renders as chips
 * (route, per-source amounts, fee, explorer link). The verbose multi-line receipt from
 * `resultText` stays in chat — it used to double as the notification body, which is exactly
 * what made the inbox read like a log.
 *
 * Kept free of `@/` aliases, JSX, and i18n imports so `node --test` can run it directly:
 * the caller injects `translate` and `chainLabel`.
 */

export type NotificationSourceAllocation = { sourceChain: string; amount: string };

export type NotificationMetadataV1 = {
  v: 1;
  command: string;
  outcome: "success" | "pending" | "failed";
  amount?: string;
  recipient?: string;
  sourceMode?: "scoped" | "unified";
  sourceChain?: string | null;
  destinationChain?: string | null;
  sourceAllocations?: NotificationSourceAllocation[];
  fee?: string | null;
  feeEstimated?: boolean;
  txHash?: string | null;
  retryCommand?: string | null;
};

export type ComposedNotification = {
  type: string;
  title: string;
  body: string;
  metadata: NotificationMetadataV1;
};

export type NotificationTranslate = (
  key: string,
  params?: Record<string, string | number | undefined | null>,
) => string;

export type NotificationChainLabel = (chain?: string | null) => string;

export function formatDecimalAmount(value: unknown, maxFractionDigits = 6) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(numberValue);
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/**
 * Notifications are for things worth finding in an inbox after the tab is closed: money moved
 * (or is about to). Read-only commands answer in chat and get a toast; an inbox row per
 * balance check buried the rows that mattered.
 */
export function shouldNotifyCommand(draft: ParsedCommand): boolean {
  switch (draft.command) {
    case "transfer":
    case "pay":
    case "deposit":
    case "withdraw":
    case "payroll":
    case "request":
      return true;
    case "wallet":
      return draft.fields.action === "create";
    default:
      return false;
  }
}

/**
 * Unified transfers report which chains funded them via `sourceAllocations`; `/pay` nests the
 * same array under `result.transfer`. Scoped transfers return `sourceAllocations: null`.
 * Malformed entries are dropped rather than rendered — the summary is decorative, the chat
 * receipt is the authoritative record.
 */
export function notificationAllocations(result: unknown): NotificationSourceAllocation[] {
  const record = recordFrom(result);
  const raw = record.sourceAllocations ?? recordFrom(record.transfer).sourceAllocations;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    const item = recordFrom(entry);
    const sourceChain = stringFrom(item.sourceChain);
    const amount = Number(item.amount);
    if (!sourceChain || !Number.isFinite(amount) || amount <= 0) return [];
    return [{ sourceChain, amount: formatDecimalAmount(amount) }];
  });
}

export function allocationSummary(
  allocations: NotificationSourceAllocation[],
  chainLabel: NotificationChainLabel,
): string {
  return allocations
    .map((allocation) => `${chainLabel(allocation.sourceChain)} ${allocation.amount}`)
    .join(" + ");
}

/**
 * First sentence, hard-capped. Failure bodies quote server errors that can run to paragraphs
 * (stack-ish RPC messages, retry hints); the notification only needs the headline — the full
 * message stays in the chat status row.
 */
export function shortErrorSummary(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  // Sentence break = terminator followed by whitespace, so "1.5 USDC" does not split.
  const match = normalized.match(/^.*?[.!?](?=\s)/);
  const sentence = (match?.[0] ?? normalized).trim();
  return sentence.length <= 140 ? sentence : `${sentence.slice(0, 139).trimEnd()}…`;
}

export type NotificationBucket = "attention" | "waiting" | "gateway" | "completed";

const TYPE_BUCKETS: Record<string, NotificationBucket> = {
  command_failed: "attention",
  gateway_deposit_pending: "waiting",
  gateway_finality_pending: "waiting",
  gateway_deposit_available: "gateway",
  command_success: "completed",
  payment_success: "completed",
  payment_received: "completed",
  payment_request_paid: "completed",
  x402_payment: "completed",
  payroll_completed: "completed",
};

/**
 * Type-first classification. The activity page used to sniff `${type} ${body}` with regexes,
 * which meant rewording a body could silently recolor a row; known types now map directly.
 * The regex fallback survives only for legacy/unknown rows already in the database.
 */
export function notificationBucket(type: string, body: string): NotificationBucket {
  const known = TYPE_BUCKETS[type];
  if (known) return known;

  const normalized = `${type} ${body}`.toLowerCase();
  if (/failed|error/.test(normalized)) return "attention";
  if (/pending|finality|waiting/.test(normalized)) return "waiting";
  if (normalized.includes("gateway")) return "gateway";
  return "completed";
}

function truncateAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function notificationTxHash(result: unknown): string | undefined {
  const record = recordFrom(result);
  return (
    stringFrom(record.destinationTxHash) ??
    stringFrom(recordFrom(record.transfer).destinationTxHash) ??
    stringFrom(record.txHash) ??
    stringFrom(record.mintTxHash)
  );
}

function feeSegment(
  transfer: unknown,
  translate: NotificationTranslate,
): { text: string; fee: string | null; feeEstimated: boolean } {
  const amounts = gatewayTransferAmounts(transfer ?? {}, "receipt");

  if (amounts.gatewayFee !== null) {
    const fee = formatDecimalAmount(amounts.gatewayFee);
    return { text: translate("notify.body.fee", { amount: fee }), fee, feeEstimated: false };
  }
  if (amounts.estimatedGatewayFee > 0) {
    const fee = formatDecimalAmount(amounts.estimatedGatewayFee);
    return { text: translate("notify.body.feeEstimated", { amount: fee }), fee, feeEstimated: true };
  }
  return { text: translate("notify.body.feePending"), fee: null, feeEstimated: false };
}

function sourceDescriptor(
  result: unknown,
  draft: ParsedCommand,
  chainLabel: NotificationChainLabel,
): {
  allocations: NotificationSourceAllocation[];
  sourceChain: string | null;
  sourcesText: string | null;
  sourceMode: "scoped" | "unified";
} {
  const record = recordFrom(result);
  const allocations = notificationAllocations(result);
  const rawMode =
    stringFrom(record.sourceMode) ??
    stringFrom(recordFrom(record.transfer).sourceMode) ??
    stringFrom(recordFrom(record.payment).sourceMode) ??
    draft.fields.sourceMode;
  const sourceMode: "scoped" | "unified" =
    rawMode === "unified" || allocations.length > 1 ? "unified" : "scoped";

  if (allocations.length > 1) {
    return { allocations, sourceChain: null, sourcesText: null, sourceMode };
  }
  if (allocations.length === 1) {
    return {
      allocations,
      sourceChain: allocations[0].sourceChain,
      sourcesText: chainLabel(allocations[0].sourceChain),
      sourceMode,
    };
  }

  const scopedSource =
    stringFrom(record.sourceChain) ??
    stringFrom(recordFrom(record.transfer).sourceChain) ??
    stringFrom(draft.fields.sourceChain) ??
    null;
  return {
    allocations,
    sourceChain: scopedSource,
    sourcesText: scopedSource ? chainLabel(scopedSource) : null,
    sourceMode,
  };
}

function joinBody(segments: Array<string | null | undefined>): string {
  return segments.filter(Boolean).join(" · ");
}

export function composeSuccessNotification(input: {
  draft: ParsedCommand;
  result: unknown;
  translate: NotificationTranslate;
  chainLabel: NotificationChainLabel;
}): ComposedNotification | null {
  const { draft, result, translate, chainLabel } = input;
  if (!shouldNotifyCommand(draft)) return null;

  const record = recordFrom(result);
  const txHash = notificationTxHash(result);

  if (draft.command === "transfer") {
    const amount = formatDecimalAmount(record.amount ?? draft.fields.amount);
    const destination = stringFrom(record.destinationChain) ?? draft.fields.destinationChain ?? null;
    const source = sourceDescriptor(result, draft, chainLabel);
    const fee = feeSegment(result, translate);
    const sameChain =
      source.allocations.length <= 1 &&
      source.sourceChain !== null &&
      destination !== null &&
      (source.sourceChain === destination ||
        chainLabel(source.sourceChain) === chainLabel(destination));
    const sourcesText =
      source.allocations.length > 1
        ? allocationSummary(source.allocations, chainLabel)
        : sameChain
          ? null
          : source.sourcesText;

    return {
      type: "command_success",
      title: translate("notify.transfer.title", { amount, chain: chainLabel(destination) }),
      body: joinBody([
        sourcesText ? translate("notify.body.from", { sources: sourcesText }) : null,
        fee.text,
      ]),
      metadata: {
        v: 1,
        command: draft.command,
        outcome: "success",
        amount,
        sourceMode: source.sourceMode,
        sourceChain: source.sourceChain,
        destinationChain: destination,
        ...(source.allocations.length > 0 ? { sourceAllocations: source.allocations } : {}),
        fee: fee.fee,
        feeEstimated: fee.feeEstimated,
        txHash: txHash ?? null,
      },
    };
  }

  if (draft.command === "pay") {
    const payment = recordFrom(record.payment);
    const recipient =
      stringFrom(recordFrom(payment.recipient).label) ?? draft.fields.recipient ?? "";
    const amount = formatDecimalAmount(payment.amount ?? draft.fields.amount);
    const destination =
      stringFrom(payment.destinationChain) ?? draft.fields.destinationChain ?? null;
    const source = sourceDescriptor(result, draft, chainLabel);
    const fee = feeSegment(record.transfer, translate);
    const sourcesText =
      source.allocations.length > 1
        ? allocationSummary(source.allocations, chainLabel)
        : source.sourcesText;

    return {
      type: "command_success",
      title: translate("notify.pay.title", { amount, recipient }),
      body: joinBody([
        destination ? translate("notify.body.to", { chain: chainLabel(destination) }) : null,
        sourcesText ? translate("notify.body.from", { sources: sourcesText }) : null,
        fee.text,
      ]),
      metadata: {
        v: 1,
        command: draft.command,
        outcome: "success",
        amount,
        recipient,
        sourceMode: source.sourceMode,
        sourceChain: source.sourceChain,
        destinationChain: destination,
        ...(source.allocations.length > 0 ? { sourceAllocations: source.allocations } : {}),
        fee: fee.fee,
        feeEstimated: fee.feeEstimated,
        txHash: txHash ?? null,
      },
    };
  }

  if (draft.command === "deposit") {
    const amount = formatDecimalAmount(record.amount ?? draft.fields.amount);
    const chain = stringFrom(record.chain) ?? draft.fields.sourceChain ?? null;
    const pending = record.status === "pending_gateway_finality";

    return {
      type: pending ? "gateway_deposit_pending" : "command_success",
      title: pending
        ? translate("notify.depositPending.title", { amount })
        : translate("notify.deposit.title", { amount, chain: chainLabel(chain) }),
      body: pending
        ? translate("notify.depositPending.body", { chain: chainLabel(chain) })
        : translate("notify.deposit.body"),
      metadata: {
        v: 1,
        command: draft.command,
        outcome: pending ? "pending" : "success",
        amount,
        sourceChain: chain,
        txHash: txHash ?? null,
      },
    };
  }

  if (draft.command === "withdraw") {
    const amount = formatDecimalAmount(record.amount ?? draft.fields.amount);
    const chain = stringFrom(record.chain) ?? draft.fields.sourceChain ?? null;
    const estimatedFee = Number(record.estimatedGatewayFee ?? 0);
    const hasFee = Number.isFinite(estimatedFee) && estimatedFee > 0;

    return {
      type: "command_success",
      title: translate("notify.withdraw.title", { amount, chain: chainLabel(chain) }),
      body: hasFee
        ? translate("notify.body.feeEstimated", { amount: formatDecimalAmount(estimatedFee) })
        : "",
      metadata: {
        v: 1,
        command: draft.command,
        outcome: "success",
        amount,
        sourceChain: chain,
        fee: hasFee ? formatDecimalAmount(estimatedFee) : null,
        feeEstimated: hasFee,
        txHash: txHash ?? null,
      },
    };
  }

  if (draft.command === "payroll") {
    const results = Array.isArray(record.results) ? record.results : [];
    const total = results.length;
    const successCount = results.filter(
      (item) => recordFrom(item).status === "success",
    ).length;
    const failed = total - successCount;

    return {
      type: "command_success",
      title: translate("notify.payroll.title", { success: successCount, total }),
      body:
        failed > 0
          ? translate("notify.payroll.bodyFailures", { failed })
          : total > 0
            ? translate("notify.payroll.bodyAllPaid")
            : "",
      metadata: {
        v: 1,
        command: draft.command,
        outcome: failed > 0 ? "failed" : "success",
        ...(draft.fields.amount ? { amount: formatDecimalAmount(draft.fields.amount) } : {}),
        sourceChain: draft.fields.sourceChain ?? null,
      },
    };
  }

  if (draft.command === "request") {
    const amount = formatDecimalAmount(
      draft.fields.amount ?? recordFrom(record.request).amount,
    );

    return {
      type: "command_success",
      title: translate("notify.request.title", { amount }),
      body: translate("notify.request.body"),
      metadata: {
        v: 1,
        command: draft.command,
        outcome: "success",
        amount,
        destinationChain: draft.fields.destinationChain ?? null,
      },
    };
  }

  if (draft.command === "wallet") {
    const wallet = recordFrom(Array.isArray(record.wallets) ? record.wallets[0] : undefined);
    const address = stringFrom(wallet.address) ?? stringFrom(wallet.wallet_address);

    return {
      type: "command_success",
      title: translate("notify.walletCreate.title"),
      body: address
        ? translate("notify.walletCreate.body", { address: truncateAddress(address) })
        : "",
      metadata: { v: 1, command: draft.command, outcome: "success" },
    };
  }

  // A command that passed the notify policy but has no bespoke copy yet: a plain localized
  // title beats regressing to the receipt dump.
  return {
    type: "command_success",
    title: translate("notify.generic.title"),
    body: "",
    metadata: { v: 1, command: draft.command, outcome: "success" },
  };
}

export function composeFailureNotification(input: {
  draft: ParsedCommand;
  message: string;
  errorData: unknown;
  waitingGateway: boolean;
  fundsMoved: boolean;
  translate: NotificationTranslate;
  chainLabel: NotificationChainLabel;
}): ComposedNotification | null {
  const { draft, message, errorData, waitingGateway, fundsMoved, translate, chainLabel } = input;
  if (!shouldNotifyCommand(draft)) return null;

  const data = recordFrom(errorData);

  if (waitingGateway) {
    // Mirrors the field precedence of the chat's gatewayFinalityPendingText, minus the prose:
    // the notification only needs the amount, the chain, and what to do next.
    const amount = formatDecimalAmount(
      data.pendingAmount ?? data.autoDepositedAmount ?? draft.fields.amount ?? data.amount,
    );
    const chain =
      stringFrom(data.sourceChain) ??
      stringFrom(draft.fields.sourceChain) ??
      stringFrom(data.chain) ??
      null;
    const autoDepositSubmitted = Boolean(data.autoDeposit) && !data.pendingAmount;

    return {
      type: "gateway_finality_pending",
      title: translate("notify.waiting.title", { amount }),
      body: autoDepositSubmitted
        ? translate("notify.waiting.autoDeposit.body", { amount, chain: chainLabel(chain) })
        : translate("notify.waiting.body", { chain: chainLabel(chain) }),
      metadata: {
        v: 1,
        command: draft.command,
        outcome: "pending",
        amount,
        sourceChain: chain,
        retryCommand: stringFrom(data.retryCommand) ?? null,
      },
    };
  }

  const amount = draft.fields.amount ? formatDecimalAmount(draft.fields.amount) : undefined;
  const titles: Partial<Record<ParsedCommand["command"], string>> = {
    transfer: translate("notify.failed.transfer.title", { amount }),
    pay: translate("notify.failed.pay.title", { recipient: draft.fields.recipient ?? "" }),
    deposit: translate("notify.failed.deposit.title"),
    withdraw: translate("notify.failed.withdraw.title"),
    payroll: translate("notify.failed.payroll.title"),
  };

  return {
    type: "command_failed",
    title: titles[draft.command] ?? translate("notify.failed.generic.title"),
    body: joinBody([
      shortErrorSummary(message),
      fundsMoved ? translate("notify.failed.fundsMoved") : null,
    ]),
    metadata: {
      v: 1,
      command: draft.command,
      outcome: "failed",
      ...(amount ? { amount } : {}),
      ...(draft.command === "pay" && draft.fields.recipient
        ? { recipient: draft.fields.recipient }
        : {}),
      sourceChain: draft.fields.sourceChain ?? null,
      destinationChain: draft.fields.destinationChain ?? null,
    },
  };
}
