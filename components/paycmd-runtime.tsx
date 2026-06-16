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
  notifications: NotificationItem[];
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
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error === "INSUFFICIENT_GAS"
        ? [
            data?.message ?? "Wallet thực thi giao dịch chưa có native gas token.",
            data?.walletAddress ? `Nạp gas vào ví: ${data.walletAddress}.` : "",
            data?.chain ? `Chain: ${data.chain}.` : "",
          ]
            .filter(Boolean)
            .join(" ")
        : data?.error === "GATEWAY_FINALITY_PENDING"
          ? data?.message ?? "Gateway đang chờ finality. Chạy lại command sau vài phút."
          : data?.message ?? data?.error ?? `Request failed: ${response.status}`;
    throw Object.assign(new Error(message), {
      code: data?.error,
      status: response.status,
      data,
    });
  }

  return data;
}

export function isForegroundOnlyCommand(draft: ParsedCommand) {
  return draft.command === "link" || draft.command === "fund";
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
  const decimals = chain === "arcTestnet" ? 6 : 18;
  const symbol =
    chain === "arcTestnet" ? "USDC" : chain === "avalancheFuji" ? "AVAX" : "ETH";

  try {
    const value = typeof rawBalance === "bigint" ? rawBalance : BigInt(String(rawBalance ?? "0"));
    const formatted = formatUnits(value, decimals);
    return `${formatDecimalAmount(formatted, 6)} ${symbol}`;
  } catch {
    return `0 ${symbol}`;
  }
}

function gatewayFeeText(transfer: any) {
  const amount = Number(transfer?.amount ?? 0);
  const estimatedFee = Number(transfer?.estimatedGatewayFee ?? transfer?.fees?.total ?? 0);
  const required = Number(transfer?.requiredGatewayBalance ?? amount + estimatedFee);
  const txRef = transfer?.mintTxHash ?? transfer?.txHash ?? transfer?.transferId;
  const manualHint =
    transfer?.forwarding
      ? "Đang dùng Auto forwarding. Muốn rẻ hơn và tự trả gas destination: thêm `manual` hoặc `no forwarding` vào command."
      : "Đang dùng Manual mint gas. SCA/signer ở destination đã trả native gas.";

  if (!amount && !estimatedFee) {
    return txRef ? `ID: ${txRef}\nMode: ${manualHint}` : `Mode: ${manualHint}`;
  }

  const feeLine =
    estimatedFee > 0
      ? `${formatDecimalAmount(estimatedFee)} USDC`
      : "Gateway không trả breakdown";

  return [
    `Recipient: ${formatDecimalAmount(amount)} USDC`,
    `Source debit: ~${formatDecimalAmount(required)} USDC`,
    `Fees: ${feeLine}`,
    `Includes: source burn gas + cross-chain fee${transfer?.forwarding ? " + forwarding fee" : ""}`,
    transfer?.forwarding
      ? "Destination gas: paid by Circle/forwarder"
      : "Destination gas: paid by your SCA/signer",
    txRef ? `ID: ${txRef}` : "",
    `Mode: ${transfer?.forwarding ? "Auto forwarding" : "Manual gas"}`,
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

export function resultText(draft: ParsedCommand, result: any) {
  if (draft.command === "link") {
    const address = result?.externalWallet?.wallet_address;
    return address ? `Đã link MetaMask ${address}.` : "Đã link MetaMask.";
  }

  if (draft.command === "fund") {
    return `Fund ${result.amount} USDC từ MetaMask vào Circle wallet trên ${result.chain}. Tx: ${result.txHash} (${result.status}).`;
  }

  if (draft.command === "wallet") {
    if (draft.fields.action === "create") {
      const wallet = result?.wallets?.[0];
      const address = wallet?.address ?? wallet?.wallet_address;
      const alreadyExists = String(result?.message ?? "").toLowerCase().includes("already exists");

      return address
        ? alreadyExists
          ? `Wallet đã tồn tại: ${address}`
          : `Wallet đã sẵn sàng: ${address}`
        : result?.message ?? "Wallet đã sẵn sàng.";
    }
    if (draft.fields.action === "balance") {
      const chain = draft.fields.chain;
      const total = totalBalanceSource(result?.balances ?? [], "wallet", chain);

      return chain
        ? `Circle SCA wallet trên ${chain}: ${formatDecimalAmount(total)} USDC.`
        : `Circle SCA wallet total: ${formatDecimalAmount(total)} USDC.`;
    }
    return result?.hasWallet
      ? `Wallet active: ${result.scaWallet?.address ?? result.scaWallet?.wallet_address}`
      : "Chưa có Circle wallet. Dùng /wallet create để tạo.";
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
      return result?.message ?? `Đã gửi deposit ${result.amount} USDC từ ${result.chain}. Đang chờ Gateway finality.`;
    }
    return `Deposit thành công: ${result.amount} USDC từ ${result.chain}.`;
  }

  if (draft.command === "withdraw") {
    const fee = Number(result?.estimatedGatewayFee ?? 0);
    const feeText = fee > 0 ? ` Fee: ${formatDecimalAmount(fee)} USDC.` : "";
    return `Withdraw thành công: ${result.amount} USDC từ Gateway ${result.chain} về Circle SCA wallet.${feeText}`;
  }

  if (draft.command === "transfer") {
    const autoDeposit = result.autoDeposit
      ? ` Đã auto-deposit ${result.autoDepositedAmount} USDC trước khi transfer.`
      : "";
    const forwarding = result.forwarding
      ? " Circle Forwarding Service sẽ mint hộ ở destination; không cần gas ở chain đích."
      : "";
    return [
      `Transfer success: ${result.sourceChain} -> ${result.destinationChain}`,
      autoDeposit.trim(),
      forwarding.trim(),
      gatewayFeeText(result),
    ].filter(Boolean).join("\n");
  }

  if (draft.command === "pay") {
    const payment = result.payment;
    const recipient = payment?.recipient?.label ?? draft.fields.recipient;
    const forwarding = result.transfer?.forwarding ? " Forwarding mint hộ ở destination." : "";
    return [
      `Paid ${payment?.amount ?? draft.fields.amount} USDC to ${recipient} on ${payment?.destinationChain}`,
      forwarding.trim(),
      gatewayFeeText(result.transfer),
    ].filter(Boolean).join("\n");
  }

  if (draft.command === "request") {
    return `Payment request đã tạo: ${result.paymentUrl}${result.qrImageUrl ? ` · QR: ${result.qrImageUrl}` : ""}`;
  }

  if (draft.command === "payroll") {
    const results = result.results ?? [];
    const successCount = results.filter((item: any) => item.status === "success").length;
    return `Payroll ${result.status}: ${successCount}/${results.length} payment thành công.`;
  }

  if (draft.command === "contacts") {
    if (draft.fields.action === "list") {
      return `Có ${(result.contacts ?? []).length} contact.`;
    }
    const resolution = result.resolution === "internal" ? "internal PayCMD user" : "external wallet";
    return result.warning?.message
      ? `Đã lưu contact ${result.contact?.display_name ?? draft.fields.name} (${resolution}). ${result.warning.message}`
      : `Đã lưu contact ${result.contact?.display_name ?? draft.fields.name} (${resolution}).`;
  }

  if (draft.command === "gas") {
    const sca = result?.wallets?.sca;
    const signer = result?.wallets?.gatewaySigner;

    if (sca || signer || result?.gatewaySignerError) {
      const scaText = sca
        ? sca.hasGas
          ? `SCA có ${formatNativeGasBalance(sca.balance, result.chain)}`
          : `SCA chưa có gas (${sca.address})`
        : "SCA chưa có ví";
      const signerText = signer
        ? signer.hasGas
          ? `Gateway signer có ${formatNativeGasBalance(signer.balance, result.chain)}`
          : `Gateway signer chưa có gas (${signer.address})`
        : `Gateway signer chưa kiểm tra được${result?.gatewaySignerError ? `: ${result.gatewaySignerError}` : ""}`;

      return `${result.chain}: ${scaText}. ${signerText}.`;
    }

    return result?.hasGas
      ? `${result.chain}: có gas. Balance native: ${formatNativeGasBalance(result.balance, result.chain)}.`
      : `${result.chain}: chưa có native gas cho wallet ${result.address}.`;
  }

  if (draft.command === "gateway") {
    if (draft.fields.action === "balance") {
      const chain = draft.fields.chain;
      const total = totalBalanceSource(result?.balances ?? [], "gateway", chain);

      return chain
        ? `Gateway balance trên ${chain}: ${formatDecimalAmount(total)} USDC.`
        : `Gateway balance total: ${formatDecimalAmount(total)} USDC.`;
    }
    return `Gateway online. Domains: ${(result?.domains ?? []).length}.`;
  }

  if (draft.command === "history") {
    const rows = Array.isArray(result) ? result : [];
    if (!rows.length) return "Chưa có transaction history.";
    return `Có ${rows.length} transaction. Gần nhất: ${rows[0].tx_type} ${rows[0].amount} trên ${rows[0].chain}.`;
  }

  return "Command đã hoàn tất.";
}

async function executeServerCommand(draft: ParsedCommand) {
  if (isForegroundOnlyCommand(draft)) {
    throw new Error("Lệnh này cần MetaMask nên phải chạy trực tiếp trong chat.");
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
        mintGasMode: draft.fields.mintGasMode ?? "auto_forwarding",
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
      network: "Arc Testnet, Base Sepolia, Avalanche Fuji",
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
  const [activeCommandCount, setActiveCommandCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
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

      console.error("Failed to refresh notifications", error);
    }
  }, []);

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
        throw new Error("Lệnh này cần MetaMask nên phải chạy trực tiếp trong chat.");
      }

      setActiveCommandCount((current) => current + 1);

      let execution = await createExecutionRecord(draft, context.userId);
      const running = { ...execution, status: "running" as const };
      const waiting = { ...execution, status: "waiting_gateway" as const };

      try {
        if (usesGatewayPipeline(draft)) {
          await writeStatus(context, `${execution.title} đã được đưa vào hàng đợi.`, execution);

          execution = running;
          await updateExecutionRecord(execution);
          await writeStatus(context, `${execution.title} đang được xử lý.`, execution);

          execution = waiting;
          await updateExecutionRecord(execution);
          await writeStatus(context, `${execution.title} đang gọi Circle Gateway.`, execution);
        } else {
          execution = running;
          await updateExecutionRecord(execution);
          await writeStatus(context, `${execution.title} đang kiểm tra.`, execution);
        }

        const result = await executeServerCommand(draft);
        const txHash = result?.txHash ?? result?.mintTxHash;
        const success = {
          ...execution,
          status: "success" as const,
          txHash,
          result,
        };
        const body = resultText(draft, result);

        await updateExecutionRecord(success);
        await insertNotification({
          userId: context.userId,
          executionId: success.id,
          type: "command_success",
          title: "Command completed",
          body,
        });
        await writeStatus(context, body, success);
        toast.success("Command completed", { description: body });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Command failed";
        const errorCode = (error as { code?: string })?.code;
        const waitingGateway = errorCode === "GATEWAY_FINALITY_PENDING";
        const failed = {
          ...execution,
          status: waitingGateway ? ("waiting_gateway" as const) : ("failed" as const),
          error: message,
        };

        await updateExecutionRecord(failed);
        await insertNotification({
          userId: context.userId,
          executionId: failed.id,
          type: waitingGateway ? "gateway_finality_pending" : "command_failed",
          title: waitingGateway ? "Gateway finality pending" : "Command failed",
          body: message,
        });
        await writeStatus(context, message, failed);

        if (waitingGateway) {
          toast.warning("Gateway finality pending", { description: message });
        } else {
          toast.error("Command failed", { description: message });
        }
      } finally {
        setActiveCommandCount((current) => Math.max(0, current - 1));
      }
    },
    [
      createExecutionRecord,
      insertNotification,
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

  const value = useMemo(
    () => ({
      activeCommandCount,
      unreadCount: notifications.filter((item) => item.status === "unread").length,
      notifications,
      refreshNotifications,
      registerStatusWriter,
      runServerCommand,
    }),
    [
      activeCommandCount,
      notifications,
      refreshNotifications,
      registerStatusWriter,
      runServerCommand,
    ],
  );

  return (
    <PayCmdRuntimeContext.Provider value={value}>
      {children}
    </PayCmdRuntimeContext.Provider>
  );
}
