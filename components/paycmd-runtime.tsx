"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { formatUnits } from "viem";

import { getChainMeta } from "@/components/chain-identity";
import { localeRequestHeaders, translateClient, useI18n } from "@/lib/i18n";
import { faucetHint, isKnownTestnetChain } from "@/lib/paycmd/cctp-bridge";
import { createClient } from "@/lib/supabase/client";
import { ParsedCommand } from "@/lib/paycmd/commands";

export type ExecutionItem = {
  id: string;
  draftId: string;
  command: ParsedCommand["command"];
  status: "queued" | "running" | "waiting_gateway" | "success" | "failed";
  title: string;
  createdAt: string;
  gateway: {
    network: string;
    rail: string;
    mode: string;
  };
  txHash?: string;
  result?: unknown;
  error?: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  status: "unread" | "read" | "archived";
  commandExecutionId: string | null;
};

type RuntimeContext = {
  activeCommandCount: number;
  unreadCount: number;
  unifiedBalance: number | null;
  isBalanceLoading: boolean;
  notifications: NotificationItem[];
  refreshBalance: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  registerStatusWriter: (
    writer: ((text: string, execution: ExecutionItem) => Promise<void>) | null,
  ) => () => void;
  runServerCommand: (
    draft: ParsedCommand,
    context: { threadId: string | null; userId: string | null },
  ) => Promise<void>;
};

const PayCmdRuntimeContext = createContext<RuntimeContext | null>(null);

export function usePayCmdRuntime() {
  const context = useContext(PayCmdRuntimeContext);

  if (!context) {
    throw new Error("usePayCmdRuntime must be used inside PayCmdRuntimeProvider");
  }

  return context;
}

export async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...localeRequestHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const baseMessage =
      data?.error === "INSUFFICIENT_GAS"
        ? [
            data?.message ?? translateClient("request.insufficientGasDefault"),
            data?.walletAddress ? translateClient("request.fundGasAddress", { address: data.walletAddress }) : "",
            data?.chain ? translateClient("request.chain", { chain: data.chain }) : "",
          ]
            .filter(Boolean)
            .join(" ")
        : data?.error === "GATEWAY_FINALITY_PENDING"
          ? data?.message ?? translateClient("request.gatewayFinalityPending")
          : data?.message ?? data?.error ?? `Request failed: ${response.status}`;
    const message =
      /insufficient funds|insufficient balance|không đủ|thieu usdc|thiếu usdc|native gas/i.test(baseMessage) && data?.chain
        ? `${baseMessage} ${faucetHint(data.chain)}`.trim()
        : baseMessage;
    throw Object.assign(new Error(message), {
      code: data?.error,
      status: response.status,
      data,
    });
  }

  return data;
}

function isTransientFetchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const name = error instanceof Error ? error.name : "";

  return (
    name === "AuthRetryableFetchError" ||
    /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(message)
  );
}

export function isForegroundOnlyCommand(draft: ParsedCommand) {
  return draft.command === "link" || draft.command === "fund" || draft.command === "bridge" || draft.command === "swap";
}

export function usesGatewayPipeline(draft: ParsedCommand) {
  return (
    draft.command === "fund" ||
    draft.command === "deposit" ||
    draft.command === "withdraw" ||
    draft.command === "transfer" ||
    draft.command === "pay" ||
    draft.command === "payroll" ||
    (draft.command === "wallet" && draft.fields.action === "create")
  );
}

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

export function formatNativeGasBalance(rawBalance: unknown, chain: string) {
  const meta = getChainMeta(chain);
  const decimals = meta?.nativeSymbol === "USDC" ? 6 : 18;
  const symbol = meta?.nativeSymbol ?? "ETH";

  try {
    const value = typeof rawBalance === "bigint" ? rawBalance : BigInt(String(rawBalance ?? "0"));
    const formatted = formatUnits(value, decimals);
    return `${formatDecimalAmount(formatted, 6)} ${symbol}`;
  } catch {
    return `0 ${symbol}`;
  }
}

function gatewayFeeText(transfer: any, translate: Translator) {
  const amount = Number(transfer?.amount ?? 0);
  const estimatedFee = Number(transfer?.estimatedGatewayFee ?? transfer?.fees?.total ?? 0);
  const required = Number(transfer?.requiredGatewayBalance ?? amount + estimatedFee);
  const txRef = transfer?.mintTxHash ?? transfer?.txHash ?? transfer?.transferId;
  const manualHint =
    transfer?.forwarding
      ? translate("runtime.gatewayFeeAutoHint")
      : translate("runtime.gatewayFeeManualHint");

  if (!amount && !estimatedFee) {
    return txRef ? `ID: ${txRef}\nMode: ${manualHint}` : `Mode: ${manualHint}`;
  }

  const feeLine =
    estimatedFee > 0
      ? `${formatDecimalAmount(estimatedFee)} USDC`
      : translate("runtime.gatewayNoBreakdown");

  return [
    translate("runtime.result.recipient", { value: `${formatDecimalAmount(amount)} USDC` }),
    translate("runtime.result.sourceDebit", { value: formatDecimalAmount(required) }),
    translate("runtime.result.fees", { value: feeLine }),
    translate("runtime.result.includes", {
      forwardingFee: transfer?.forwarding ? translate("runtime.result.forwardingFee") : "",
    }),
    transfer?.forwarding
      ? translate("bridge.destinationGasForwarder")
      : translate("runtime.result.destinationGasSigner"),
    txRef ? translate("runtime.result.id", { value: txRef }) : "",
    translate("runtime.result.mode", {
      value: transfer?.forwarding ? translate("transfer.autoForwarding") : translate("transfer.manualGas"),
    }),
  ].filter(Boolean).join("\n");
}

export function totalBalanceSource(
  balances: any[],
  source: "wallet" | "gateway" | "unified",
  chain?: string,
) {
  return balances.reduce((sum: number, item: any) => {
    const gateway =
      source === "wallet"
        ? 0
        : (item.gatewayBalances ?? [])
            .filter((entry: any) => !chain || entry.chain === chain)
            .reduce((inner: number, entry: any) => inner + Number(entry.balance || 0), 0);
    const wallet =
      source === "gateway"
        ? 0
        : (item.chainBalances ?? [])
            .filter((entry: any) => !chain || entry.chain === chain)
            .reduce((inner: number, entry: any) => inner + Number(entry.balance || 0), 0);

    return sum + gateway + wallet;
  }, 0);
}

type Translator = (key: string, params?: Record<string, string | number | undefined | null>) => string;

function commandTitle(draft: ParsedCommand, t: Translator) {
  if (draft.command === "transfer") {
    return t("transfer.title", {
      amount: draft.fields.amount,
      source: draft.fields.sourceChain,
      destination: draft.fields.destinationChain,
    });
  }

  if (draft.command === "gateway" && draft.fields.action === "balance") {
    return draft.fields.chain
      ? t("runtime.gatewayBalanceTitle", { chain: draft.fields.chain })
      : t("runtime.gatewayBalanceTitleAll");
  }

  if (draft.command === "pay") {
    return t("pay.title", {
      amount: draft.fields.amount,
      recipient: draft.fields.recipient,
      chain: draft.fields.destinationChain,
    });
  }

  if (draft.command === "balance") {
    return t("command.balance", { chain: draft.fields.chain ? ` on ${draft.fields.chain}` : "" });
  }

  if (draft.command === "wallet") {
    if (draft.fields.action === "create") return t("command.walletCreate");
    if (draft.fields.action === "balance") return t("command.walletBalance");
    return t("command.walletStatus");
  }

  if (draft.command === "contacts") {
    return draft.fields.action === "list"
      ? t("command.contactsList")
      : t("command.contactsAdd", { name: draft.fields.name });
  }

  return draft.summary;
}

function gatewayFinalityPendingText(data: any, draft: ParsedCommand, t: Translator) {
  const chain = data?.sourceChain ?? draft.fields.sourceChain ?? data?.chain ?? "";
  const amount = data?.pendingAmount ?? data?.autoDepositedAmount ?? draft.fields.amount ?? data?.amount ?? "";
  const action =
    data?.autoDeposit || data?.pendingAmount
      ? data?.pendingAmount
        ? t("runtime.gatewayFinalityPending.autoDeposit", { amount: formatDecimalAmount(amount), chain })
        : t("runtime.gatewayFinalityPending.autoDepositSubmitted", { amount: formatDecimalAmount(amount), chain })
      : data?.stage === "delegate"
        ? t("runtime.gatewayFinalityPending.delegate", { chain })
        : t("runtime.gatewayFinalityPending.burnIntent", { chain });
  const balance =
    data?.currentGatewayBalance !== undefined && data?.requiredGatewayBalance !== undefined
      ? t("runtime.gatewayFinalityPending.balance", {
          current: formatDecimalAmount(data.currentGatewayBalance),
          required: formatDecimalAmount(data.requiredGatewayBalance),
        })
      : "";
  const finality =
    chain === "baseSepolia"
      ? t("runtime.gatewayFinalityPending.base")
      : t("runtime.gatewayFinalityPending.generic");
  const retry = data?.retryCommand
    ? t("runtime.gatewayFinalityPending.retry", { command: data.retryCommand })
    : "";

  return [action, balance, finality, t("runtime.gatewayFinalityPending.noAutoDeposit"), retry]
    .filter(Boolean)
    .join(" ");
}

export function resultText(draft: ParsedCommand, result: any, t?: Translator) {
  const translate = t ?? ((key: string) => key);
  if (draft.command === "link") {
    const address = result?.externalWallet?.wallet_address;
    return address
      ? translate("runtime.linkedMetamask", { address })
      : translate("runtime.linkedMetamaskNoAddress");
  }

  if (draft.command === "fund") {
    return translate("runtime.fundSuccess", {
      amount: result.amount,
      chain: result.chain,
      txHash: result.txHash,
      status: result.status,
    });
  }

  if (draft.command === "bridge") {
    const recipientLabel =
      result?.recipientMode === "external"
        ? result?.recipientAddress ?? draft.fields.recipientAddress
        : translate("bridge.myWallet");
    const sourceDebit = Number(result?.sourceDebit ?? 0);
    const bridgeFee = Number(result?.estimatedFeeTotal ?? 0);
    const sourceGasSymbol = getChainMeta(result?.sourceChain ?? draft.fields.sourceChain)?.nativeSymbol ?? "ETH";
    const transferId = result?.transferId ?? result?.recordedTransaction?.id;
    return [
      translate("bridge.success", {
        source: result?.sourceChain ?? draft.fields.sourceChain,
        destination: result?.destinationChain ?? draft.fields.destinationChain,
      }),
      translate("runtime.result.recipient", { value: recipientLabel }),
      translate("bridge.recipientReceives", { amount: formatDecimalAmount(result?.amount ?? draft.fields.amount) }),
      sourceDebit > 0 ? translate("bridge.sourceSpend", { amount: formatDecimalAmount(sourceDebit) }) : "",
      bridgeFee > 0 ? translate("bridge.bridgeFees", { amount: formatDecimalAmount(bridgeFee) }) : "",
      translate("bridge.sourceGas", {
        symbol: sourceGasSymbol,
        chain: result?.sourceChain ?? draft.fields.sourceChain,
      }),
      result?.mintMode === "manual_mint"
        ? translate("bridge.destinationGasUser", { chain: result?.destinationChain ?? draft.fields.destinationChain })
        : translate("bridge.destinationGasForwarder"),
      result?.sourceTxHash ? translate("bridge.sourceTx", { hash: result.sourceTxHash }) : "",
      result?.mintTxHash ? translate("bridge.mintTx", { hash: result.mintTxHash }) : "",
      transferId ? translate("bridge.transferId", { id: transferId }) : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (draft.command === "wallet") {
    if (draft.fields.action === "create") {
      const wallet = result?.wallets?.[0];
      const address = wallet?.address ?? wallet?.wallet_address;
      const alreadyExists = String(result?.message ?? "").toLowerCase().includes("already exists");

      return address
        ? alreadyExists
          ? translate("runtime.walletExists", { address })
          : translate("runtime.walletReady", { address })
        : translate("runtime.walletReadyNoAddress");
    }
    if (draft.fields.action === "balance") {
      const chain = draft.fields.chain;
      const total = totalBalanceSource(result?.balances ?? [], "wallet", chain);

      return chain
        ? translate("runtime.walletBalance", { chain, amount: formatDecimalAmount(total) })
        : translate("runtime.walletBalanceAll", { amount: formatDecimalAmount(total) });
    }
    return result?.hasWallet
      ? translate("runtime.walletActive", { address: result.scaWallet?.address ?? result.scaWallet?.wallet_address })
      : translate("runtime.walletMissing");
  }

  if (draft.command === "balance") {
    const chain = draft.fields.chain;
    const balances = result?.balances ?? [];
    if (chain) {
      const chainTotal = totalBalanceSource(balances, "unified", chain);
      return `${chain}: ${formatDecimalAmount(chainTotal)} USDC.`;
    }
    return `Unified balance: ${formatDecimalAmount(result?.totalUnified)} USDC.`;
  }

  if (draft.command === "deposit") {
    if (result?.status === "pending_gateway_finality") {
      return translate("runtime.depositPending", { amount: result.amount, chain: result.chain });
    }
    return translate("runtime.depositSuccess", { amount: result.amount, chain: result.chain });
  }

  if (draft.command === "withdraw") {
    const fee = Number(result?.estimatedGatewayFee ?? 0);
    const feeText = fee > 0 ? ` Fee: ${formatDecimalAmount(fee)} USDC.` : "";
    return translate("runtime.withdrawSuccess", { amount: result.amount, chain: result.chain, fee: feeText });
  }

  if (draft.command === "transfer") {
    const autoDeposit = result.autoDeposit
      ? translate("runtime.autoDeposit", { amount: result.autoDepositedAmount })
      : "";
    const forwarding = result.forwarding
      ? translate("runtime.forwardingMint")
      : "";
    return [
      translate("runtime.transferSuccess", { source: result.sourceChain, destination: result.destinationChain }),
      autoDeposit.trim(),
      forwarding.trim(),
      gatewayFeeText(result, translate),
    ].filter(Boolean).join("\n");
  }

  if (draft.command === "pay") {
    const payment = result.payment;
    const recipient = payment?.recipient?.label ?? draft.fields.recipient;
    const forwarding = result.transfer?.forwarding ? translate("runtime.forwardingMint") : "";
    return [
      `Paid ${payment?.amount ?? draft.fields.amount} USDC to ${recipient} on ${payment?.destinationChain}`,
      forwarding.trim(),
      gatewayFeeText(result.transfer, translate),
    ].filter(Boolean).join("\n");
  }

  if (draft.command === "request") {
    return translate("runtime.paymentRequestCreated", {
      url: result.paymentUrl,
      qr: result.qrImageUrl ? ` · QR: ${result.qrImageUrl}` : "",
    });
  }

  if (draft.command === "payroll") {
    const results = result.results ?? [];
    const successCount = results.filter((item: any) => item.status === "success").length;
    return translate("runtime.payrollResult", { status: result.status, success: successCount, total: results.length });
  }

  if (draft.command === "contacts") {
    if (draft.fields.action === "list") {
      return translate("runtime.contactsCount", { count: (result.contacts ?? []).length });
    }
    const resolution = result.resolution === "internal" ? "internal Payna user" : "external wallet";
    const name = result.contact?.display_name ?? draft.fields.name;
    return result.warning?.message
      ? translate("runtime.contactSavedWarning", { name, resolution, warning: result.warning.message })
      : translate("runtime.contactSaved", { name, resolution });
  }

  if (draft.command === "gas") {
    const sca = result?.wallets?.sca;
    const signer = result?.wallets?.gatewaySigner;

    if (sca || signer || result?.gatewaySignerError) {
      const scaText = sca
        ? sca.hasGas
          ? translate("runtime.gasScaHas", { balance: formatNativeGasBalance(sca.balance, result.chain) })
          : translate("runtime.gasScaMissing", { address: sca.address })
        : translate("runtime.gasScaNoWallet");
      const signerText = signer
        ? signer.hasGas
          ? translate("runtime.gasSignerHas", { balance: formatNativeGasBalance(signer.balance, result.chain) })
          : translate("runtime.gasSignerMissing", { address: signer.address })
        : translate("runtime.gasSignerUnknown", { error: result?.gatewaySignerError ? `: ${result.gatewaySignerError}` : "" });

      return `${result.chain}: ${scaText}. ${signerText}.`;
    }

    return result?.hasGas
      ? translate("runtime.gasHas", { chain: result.chain, balance: formatNativeGasBalance(result.balance, result.chain) })
      : translate("runtime.gasMissing", { chain: result.chain, address: result.address });
  }

  if (draft.command === "gateway") {
    if (draft.fields.action === "balance") {
      const chain = draft.fields.chain;
      const total = totalBalanceSource(result?.balances ?? [], "gateway", chain);

      return chain
        ? translate("runtime.gatewayBalanceResult", { chain, amount: formatDecimalAmount(total) })
        : translate("runtime.gatewayBalanceResultAll", { amount: formatDecimalAmount(total) });
    }
    return `Gateway online. Domains: ${(result?.domains ?? []).length}.`;
  }

  if (draft.command === "history") {
    const rows = Array.isArray(result) ? result : [];
    if (!rows.length) return translate("runtime.historyEmpty");
    return translate("runtime.historySummary", {
      count: rows.length,
      type: rows[0].tx_type,
      amount: rows[0].amount,
      chain: rows[0].chain,
    });
  }

  return translate("runtime.commandDone");
}

export function bridgeErrorWithFaucet(message: string, chains: Array<string | null | undefined>) {
  if (!/insufficient funds|insufficient balance|insufficient usdc|native gas|gas required|funds/i.test(message)) {
    return message;
  }

  const hints = [...new Set(chains.filter((chain): chain is string => Boolean(chain && isKnownTestnetChain(chain))).map((chain) => faucetHint(chain)).filter(Boolean))];
  return hints.length ? `${message} ${hints.join(" ")}` : message;
}

async function executeServerCommand(draft: ParsedCommand) {
  if (isForegroundOnlyCommand(draft)) {
    throw new Error(translateClient("runtime.metamaskRequired"));
  }

  if (draft.command === "wallet") {
    if (draft.fields.action === "create") {
      return requestJson("/api/wallet-set", { method: "POST", body: JSON.stringify({}) });
    }
    if (draft.fields.action === "balance") {
      return requestJson("/api/gateway/balance", { method: "POST", body: JSON.stringify({}) });
    }
    return requestJson("/api/wallet/status");
  }

  if (draft.command === "balance") {
    return requestJson("/api/gateway/balance", { method: "POST", body: JSON.stringify({}) });
  }

  if (draft.command === "deposit") {
    return requestJson("/api/gateway/deposit", {
      method: "POST",
      body: JSON.stringify({
        chain: draft.fields.sourceChain,
        amount: draft.fields.amount,
      }),
    });
  }

  if (draft.command === "withdraw") {
    return requestJson("/api/gateway/withdraw", {
      method: "POST",
      body: JSON.stringify({
        chain: draft.fields.sourceChain,
        amount: draft.fields.amount,
      }),
    });
  }

  if (draft.command === "transfer") {
    return requestJson("/api/gateway/transfer", {
      method: "POST",
      body: JSON.stringify({
        sourceChain: draft.fields.sourceChain,
        destinationChain: draft.fields.destinationChain,
        amount: draft.fields.amount,
        autoDeposit: true,
        mintGasMode: draft.fields.mintGasMode ?? "auto_forwarding",
      }),
    });
  }

  if (draft.command === "pay") {
    return requestJson("/api/payments/pay", {
      method: "POST",
      body: JSON.stringify({
        amount: draft.fields.amount,
        recipient: draft.fields.recipient,
        sourceChain: draft.fields.sourceChain,
        destinationChain: draft.fields.destinationChain,
        mintGasMode: draft.fields.mintGasMode ?? "manual",
      }),
    });
  }

  if (draft.command === "request") {
    return requestJson("/api/payment-requests", {
      method: "POST",
      body: JSON.stringify({
        amount: draft.fields.amount,
        payer: draft.fields.payer,
        destinationChain: draft.fields.destinationChain,
      }),
    });
  }

  if (draft.command === "payroll") {
    const created = await requestJson("/api/payroll/batches", {
      method: "POST",
      body: JSON.stringify({
        name: draft.fields.batchName,
        amount: draft.fields.amount,
        sourceChain: draft.fields.sourceChain,
      }),
    });

    if (draft.fields.action === "run") {
      const batchId = created?.batch?.id;
      if (!batchId) throw new Error("Payroll batch was not created");
      return requestJson(`/api/payroll/batches/${batchId}/confirm`, { method: "POST" });
    }

    return created;
  }

  if (draft.command === "contacts") {
    if (draft.fields.action === "list") {
      return requestJson("/api/contacts");
    }

    return requestJson("/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        displayName: draft.fields.name,
        walletAddress: draft.fields.address,
        preferredChain: draft.fields.chain,
        requireInternal: /\b(paycmd|internal|user|account|tai khoan|tài khoản|noi bo|nội bộ)\b/i.test(
          draft.raw,
        ),
      }),
    });
  }

  if (draft.command === "gas") {
    return requestJson("/api/gateway/gas-check", {
      method: "POST",
      body: JSON.stringify({ chain: draft.fields.chain }),
    });
  }

  if (draft.command === "gateway") {
    if (draft.fields.action === "balance") {
      return requestJson("/api/gateway/balance", { method: "POST", body: JSON.stringify({}) });
    }
    return requestJson("/api/gateway/info");
  }

  if (draft.command === "history") {
    const filter = draft.fields.filter;
    const suffix = filter ? `?type=${encodeURIComponent(filter)}` : "";
    return requestJson(`/api/transactions${suffix}`);
  }

  throw new Error("Unsupported command");
}

function executionFromDraft(draft: ParsedCommand, id: string, createdAt?: string): ExecutionItem {
  return {
    id,
    draftId: `draft_${id}`,
    command: draft.command,
    status: "queued",
    title: draft.summary,
    createdAt: createdAt ?? new Date().toISOString(),
    gateway: {
      network: "Circle Gateway testnets",
      rail: "Circle Gateway",
      mode: "real",
    },
  };
}

function mapNotification(row: any): NotificationItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    commandExecutionId: row.command_execution_id,
  };
}

export function PayCmdRuntimeProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [activeCommandCount, setActiveCommandCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unifiedBalance, setUnifiedBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const statusWriterRef = useRef<((text: string, execution: ExecutionItem) => Promise<void>) | null>(
    null,
  );

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await requestJson("/api/notifications");
      setNotifications((data.notifications ?? []).map(mapNotification));
    } catch (error) {
      if ((error as { status?: number })?.status === 401) {
        setNotifications([]);
        return;
      }

      if (isTransientFetchError(error)) return;

      console.error("Failed to refresh notifications", error);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (unifiedBalance === null) {
      setIsBalanceLoading(true);
    }

    try {
      const data = await requestJson("/api/gateway/balance", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const total = Number(data?.totalUnified ?? 0);

      setUnifiedBalance(Number.isFinite(total) ? total : 0);
    } catch (error) {
      const status = (error as { status?: number })?.status;

      if (status === 401) {
        setUnifiedBalance(null);
        return;
      }

      if (status === 404) {
        setUnifiedBalance(0);
        return;
      }

      if (isTransientFetchError(error)) {
        setUnifiedBalance(null);
        return;
      }

      console.error("Failed to load unified balance", error);
      setUnifiedBalance(null);
    } finally {
      setIsBalanceLoading(false);
    }
  }, [unifiedBalance]);

  const syncGatewayDeposits = useCallback(async () => {
    try {
      const data = await requestJson("/api/gateway/deposit/sync", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const completedCount = Array.isArray(data?.completed) ? data.completed.length : 0;

      if (completedCount > 0) {
        const firstCompleted = data.completed[0];
        const description =
          completedCount === 1
            ? t("runtime.gatewayDepositReadyOne", {
                amount: formatDecimalAmount(firstCompleted?.amount),
                chain: firstCompleted?.chain ?? "Gateway",
              })
            : t("runtime.gatewayDepositReadyMany", { count: completedCount });

        toast.success(t("runtime.gatewayBalanceUpdated"), { description });
        await refreshNotifications();
        await refreshBalance();
      }
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401) return;
      if (isTransientFetchError(error)) return;

      console.error("Failed to sync Gateway deposits", error);
    }
  }, [refreshBalance, refreshNotifications, t]);

  const registerStatusWriter = useCallback(
    (writer: ((text: string, execution: ExecutionItem) => Promise<void>) | null) => {
      statusWriterRef.current = writer;

      return () => {
        if (statusWriterRef.current === writer) {
          statusWriterRef.current = null;
        }
      };
    },
    [],
  );

  const writeStatus = useCallback(
    async (
      context: { threadId: string | null; userId: string | null },
      text: string,
      execution: ExecutionItem,
    ) => {
      if (statusWriterRef.current) {
        await statusWriterRef.current(text, execution);
        return;
      }

      if (!context.threadId || !context.userId) {
        return;
      }

      const supabase = createClient();
      await supabase.from("chat_messages").insert({
        thread_id: context.threadId,
        user_id: context.userId,
        role: "system",
        content: text,
        kind: "status",
        command_execution_id: execution.id,
        metadata: {
          draft: null,
          execution,
          provider: null,
          citations: null,
          model: null,
        },
      });
    },
    [],
  );

  const createExecutionRecord = useCallback(async (draft: ParsedCommand, userId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("command_executions")
      .insert({
        user_id: userId,
        command_name: draft.command,
        status: "queued",
        result: {
          raw: draft.raw,
          fields: draft.fields,
        },
      })
      .select("id, created_at")
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message ?? "Could not create command execution");
    }

    return executionFromDraft(draft, data.id, data.created_at);
  }, []);

  const updateExecutionRecord = useCallback(async (execution: ExecutionItem) => {
    const supabase = createClient();
    const updates: Record<string, unknown> = {
      status: execution.status,
      error_message: execution.error ?? null,
      updated_at: new Date().toISOString(),
      completed_at:
        execution.status === "success" || execution.status === "failed"
          ? new Date().toISOString()
          : null,
    };

    if (execution.result !== undefined) {
      updates.result = { result: execution.result };
    }

    await supabase
      .from("command_executions")
      .update(updates)
      .eq("id", execution.id);
  }, []);

  const insertNotification = useCallback(
    async (params: {
      userId: string;
      executionId: string;
      type: string;
      title: string;
      body: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          user_id: params.userId,
          command_execution_id: params.executionId,
          type: params.type,
          title: params.title,
          body: params.body,
          status: "unread",
        })
        .select("*")
        .single();

      if (!error && data) {
        setNotifications((current) => [mapNotification(data), ...current]);
        return;
      }

      await refreshNotifications();
    },
    [refreshNotifications],
  );

  const runServerCommand = useCallback(
    async (draft: ParsedCommand, context: { threadId: string | null; userId: string | null }) => {
      if (draft.missingFields.length) return;

      if (!context.userId) {
        throw new Error("User is not ready for background command execution.");
      }

      if (isForegroundOnlyCommand(draft)) {
        throw new Error(t("runtime.metamaskRequired"));
      }

      setActiveCommandCount((current) => current + 1);

      let execution = await createExecutionRecord(draft, context.userId);
      const running = { ...execution, status: "running" as const };
      const waiting = { ...execution, status: "waiting_gateway" as const };

      try {
        if (usesGatewayPipeline(draft)) {
          const title = commandTitle(draft, t);
          await writeStatus(context, t("runtime.queued", { title }), execution);

          execution = running;
          await updateExecutionRecord(execution);
          await writeStatus(context, t("runtime.running", { title }), execution);

          execution = waiting;
          await updateExecutionRecord(execution);
          await writeStatus(context, t("runtime.gateway", { title }), execution);
        } else {
          execution = running;
          await updateExecutionRecord(execution);
          await writeStatus(context, t("runtime.checking", { title: commandTitle(draft, t) }), execution);
        }

        const result = await executeServerCommand(draft);
        const txHash = result?.txHash ?? result?.mintTxHash;
        const success = {
          ...execution,
          status: "success" as const,
          txHash,
          result,
        };
        const body = resultText(draft, result, t);

        await updateExecutionRecord(success);
        await insertNotification({
          userId: context.userId,
          executionId: success.id,
          type: "command_success",
          title: t("runtime.commandCompleted"),
          body,
        });
        await writeStatus(context, body, success);
        toast.success(t("runtime.commandCompleted"), { description: body });

        if (usesGatewayPipeline(draft) || draft.command === "balance") {
          void refreshBalance();
          void syncGatewayDeposits();
          window.setTimeout(() => void refreshBalance(), 5_000);
          window.setTimeout(() => void syncGatewayDeposits(), 15_000);
          window.setTimeout(() => void refreshBalance(), 15_000);
          window.setTimeout(() => void syncGatewayDeposits(), 60_000);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : t("runtime.commandFailed");
        const errorCode = (error as { code?: string })?.code;
        const waitingGateway = errorCode === "GATEWAY_FINALITY_PENDING";
        const localizedMessage = waitingGateway
          ? gatewayFinalityPendingText((error as { data?: unknown })?.data, draft, t)
          : message;
        const failed = {
          ...execution,
          status: waitingGateway ? ("waiting_gateway" as const) : ("failed" as const),
          error: localizedMessage,
        };

        await updateExecutionRecord(failed);
        await insertNotification({
          userId: context.userId,
          executionId: failed.id,
          type: waitingGateway ? "gateway_finality_pending" : "command_failed",
          title: waitingGateway ? t("runtime.gatewayPending") : t("runtime.commandFailed"),
          body: localizedMessage,
        });
        await writeStatus(context, localizedMessage, failed);

        if (waitingGateway) {
          toast.warning(t("runtime.gatewayPending"), { description: localizedMessage });
        } else {
          toast.error(t("runtime.commandFailed"), { description: localizedMessage });
        }
      } finally {
        setActiveCommandCount((current) => Math.max(0, current - 1));
      }
    },
    [
      createExecutionRecord,
      insertNotification,
      refreshBalance,
      t,
      syncGatewayDeposits,
      updateExecutionRecord,
      writeStatus,
    ],
  );

  useEffect(() => {
    void refreshNotifications();
    const interval = window.setInterval(() => void refreshNotifications(), 30_000);
    const onFocus = () => void refreshNotifications();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    void refreshBalance();
    const interval = window.setInterval(() => void refreshBalance(), 30_000);
    const onFocus = () => void refreshBalance();
    const onBalanceChanged = () => void refreshBalance();

    window.addEventListener("focus", onFocus);
    window.addEventListener("ra:balance-changed", onBalanceChanged);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("ra:balance-changed", onBalanceChanged);
    };
  }, [refreshBalance]);

  useEffect(() => {
    void syncGatewayDeposits();
    const onFocus = () => void syncGatewayDeposits();
    const onBalanceChanged = () => void syncGatewayDeposits();

    window.addEventListener("focus", onFocus);
    window.addEventListener("ra:balance-changed", onBalanceChanged);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("ra:balance-changed", onBalanceChanged);
    };
  }, [syncGatewayDeposits]);

  const value = useMemo(
    () => ({
      activeCommandCount,
      unreadCount: notifications.filter((item) => item.status === "unread").length,
      unifiedBalance,
      isBalanceLoading,
      notifications,
      refreshBalance,
      refreshNotifications,
      registerStatusWriter,
      runServerCommand,
    }),
    [
      activeCommandCount,
      isBalanceLoading,
      notifications,
      refreshBalance,
      refreshNotifications,
      registerStatusWriter,
      runServerCommand,
      unifiedBalance,
    ],
  );

  return (
    <PayCmdRuntimeContext.Provider value={value}>
      {children}
    </PayCmdRuntimeContext.Provider>
  );
}
