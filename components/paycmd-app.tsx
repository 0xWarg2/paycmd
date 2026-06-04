"use client";

import {
  BadgeDollarSign,
  Check,
  ChevronRight,
  Clock3,
  Link2,
  History,
  Loader2,
  Paperclip,
  ReceiptText,
  Send,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  WalletCards,
  Waypoints,
} from "lucide-react";
import { FormEvent, useEffect, useLayoutEffect, useRef, useState, WheelEvent } from "react";
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";

import { PayCmdShell } from "@/components/paycmd-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  parsePayCmd,
  ParsedCommand,
  requiresConfirmation,
} from "@/lib/paycmd/commands";
import { web3Chains } from "@/lib/paycmd/web3-chains";

declare global {
  interface Window {
    ethereum?: {
      request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
  kind?: "text" | "preview" | "status";
  draft?: ParsedCommand;
  execution?: ExecutionItem;
  createdAt?: string;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  status: "unread" | "read";
  commandExecutionId: string;
};

type ExecutionItem = {
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

type ChatMessageRow = {
  id: string;
  thread_id: string;
  user_id: string;
  role: "assistant" | "user" | "system";
  content: string;
  kind: "text" | "preview" | "status";
  metadata: Record<string, unknown>;
  created_at: string;
};

const MESSAGE_PAGE_SIZE = 10;

const commandTemplates = [
  {
    group: "Wallet",
    items: [
      {
        sample: "/link metamask",
        title: "Link MetaMask",
        description: "Gắn MetaMask vào tài khoản PayCMD hiện tại.",
        badge: "write",
        icon: Link2,
      },
      {
        sample: "/fund 50 from metamask on base",
        title: "Fund Circle wallet",
        description: "Chuyển USDC từ MetaMask vào Circle wallet.",
        badge: "confirm",
        icon: Wallet,
      },
      {
        sample: "/wallet create",
        title: "Tạo Circle wallet",
        description: "Khởi tạo wallet set và SCA wallet cho tài khoản.",
        badge: "write",
        icon: Wallet,
      },
      {
        sample: "/wallet status",
        title: "Xem trạng thái ví",
        description: "Kiểm tra ví Circle và Gateway signer đã có chưa.",
        badge: "read",
        icon: WalletCards,
      },
    ],
  },
  {
    group: "Balance",
    items: [
      {
        sample: "/balance",
        title: "Unified balance",
        description: "Tổng USDC on-chain và Gateway trên mọi chain.",
        badge: "read",
        icon: BadgeDollarSign,
      },
      {
        sample: "/balance arc",
        title: "Balance Arc",
        description: "Lọc USDC balance trên Arc Testnet.",
        badge: "read",
        icon: BadgeDollarSign,
      },
      {
        sample: "/balance base",
        title: "Balance Base",
        description: "Lọc USDC balance trên Base Sepolia.",
        badge: "read",
        icon: BadgeDollarSign,
      },
      {
        sample: "/balance avalanche",
        title: "Balance Avalanche",
        description: "Lọc USDC balance trên Avalanche Fuji.",
        badge: "read",
        icon: BadgeDollarSign,
      },
    ],
  },
  {
    group: "Gateway Actions",
    items: [
      {
        sample: "/deposit 50 from arc",
        title: "Deposit vào Gateway",
        description: "Approve và deposit USDC từ source chain.",
        badge: "confirm",
        icon: Waypoints,
      },
      {
        sample: "/transfer 10 from base to arc",
        title: "Cross-chain transfer",
        description: "Burn intent, attestation, rồi mint ở destination.",
        badge: "confirm",
        icon: Waypoints,
      },
      {
        sample: "/gas check arc",
        title: "Kiểm tra gas",
        description: "Kiểm tra native gas cho wallet mint transaction.",
        badge: "read",
        icon: Clock3,
      },
      {
        sample: "/gateway info",
        title: "Gateway info",
        description: "Xem domains và contract data từ Circle Gateway.",
        badge: "read",
        icon: Sparkles,
      },
    ],
  },
  {
    group: "Payments",
    items: [
      {
        sample: "/pay 25 to Minh on arc from base",
        title: "Pay contact",
        description: "Chuyển USDC cho PayCMD contact hoặc địa chỉ ngoài.",
        badge: "confirm",
        icon: Send,
      },
      {
        sample: "/request 25 from Minh on arc",
        title: "Request payment",
        description: "Tạo payment request link/QR để người trả confirm.",
        badge: "write",
        icon: ReceiptText,
      },
      {
        sample: "/payroll run team 25 from base",
        title: "Run payroll",
        description: "Tạo batch trả cùng amount cho contacts active.",
        badge: "confirm",
        icon: Users,
      },
      {
        sample: "/contacts add Minh 0x0000000000000000000000000000000000000000 on arc",
        title: "Add contact",
        description: "Lưu người nhận để /pay và payroll resolve tên.",
        badge: "write",
        icon: UserPlus,
      },
    ],
  },
  {
    group: "History",
    items: [
      {
        sample: "/history",
        title: "Tất cả giao dịch",
        description: "Xem các deposit và transfer mới nhất.",
        badge: "read",
        icon: History,
      },
      {
        sample: "/history deposit",
        title: "Deposit history",
        description: "Lọc riêng các giao dịch deposit.",
        badge: "read",
        icon: History,
      },
      {
        sample: "/history transfer",
        title: "Transfer history",
        description: "Lọc riêng các giao dịch transfer.",
        badge: "read",
        icon: History,
      },
    ],
  },
];

function missingFieldQuestion(field: string) {
  const labels: Record<string, string> = {
    amount: "Bạn muốn dùng số tiền bao nhiêu?",
    token: "Bạn muốn dùng token nào?",
    recipient: "Bạn muốn gửi cho ai?",
    payer: "Bạn muốn yêu cầu ai thanh toán?",
    name: "Bạn muốn đặt tên contact là gì?",
    address: "Bạn cần nhập địa chỉ ví 0x... của contact.",
    batchName: "Bạn muốn đặt tên payroll batch là gì?",
    budgetName: "Bạn muốn đặt tên ngân sách là gì?",
    frequency: "Bạn muốn lịch chạy daily, weekly hay monthly?",
    action: "Bạn muốn dùng action nào?",
    walletType: "Bạn muốn link ví nào? Ví dụ: /link metamask.",
    sourceWallet: "Bạn muốn nạp từ ví nào? Ví dụ: /fund 50 from metamask on base.",
    sourceChain: "Bạn muốn dùng source chain nào? Ví dụ: arc, base, avalanche.",
    destinationChain: "Bạn muốn chuyển sang chain nào? Ví dụ: arc, base, avalanche.",
    chain: "Bạn muốn kiểm tra chain nào? Ví dụ: arc, base, avalanche.",
    command: "Bạn muốn dùng command nào? Gõ / để xem danh sách.",
  };

  return labels[field] ?? `Bạn cần bổ sung ${field}.`;
}

function statusLabel(status: ExecutionItem["status"]) {
  const labels = {
    queued: "Queued",
    running: "Running",
    waiting_gateway: "Gateway",
    success: "Success",
    failed: "Failed",
  };

  return labels[status];
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error ?? data?.message ?? `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function getEthereumProvider(): EthereumProvider {
  const provider = window.ethereum;

  if (!provider?.request) {
    throw new Error("MetaMask is not available. Install MetaMask and try again.");
  }

  return provider as EthereumProvider;
}

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

async function requestMetaMaskAccount() {
  const provider = getEthereumProvider();
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const address = Array.isArray(accounts) ? String(accounts[0] ?? "") : "";

  if (!address) {
    throw new Error("No MetaMask account selected.");
  }

  return normalizeAddress(address);
}

async function linkMetaMaskWallet() {
  const provider = getEthereumProvider();
  const address = await requestMetaMaskAccount();
  const message = [
    "Link this MetaMask wallet to PayCMD.",
    `Address: ${address}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join("\n");
  const signature = await provider.request({
    method: "personal_sign",
    params: [message, address],
  });

  if (typeof signature !== "string") {
    throw new Error("MetaMask did not return a signature.");
  }

  return requestJson("/api/user/link-metamask", {
    method: "POST",
    body: JSON.stringify({
      walletAddress: address,
      message,
      signature,
    }),
  });
}

async function switchMetaMaskChain(chainKey: keyof typeof web3Chains) {
  const provider = getEthereumProvider();
  const chain = web3Chains[chainKey];

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chain.hexChainId }],
    });
  } catch (error: any) {
    if (error?.code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chain.hexChainId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [chain.rpcUrl],
          blockExplorerUrls: [chain.blockExplorerUrl],
        },
      ],
    });
  }
}

async function waitForMetaMaskReceipt(txHash: string) {
  const provider = getEthereumProvider();

  for (let index = 0; index < 30; index += 1) {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });

    if (receipt && typeof receipt === "object") {
      return receipt as { status?: string };
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return null;
}

async function fundCircleWalletFromMetaMask(draft: ParsedCommand) {
  const chainKey = draft.fields.chain as keyof typeof web3Chains;
  const chain = web3Chains[chainKey];

  if (!chain) {
    throw new Error("Unsupported fund chain.");
  }

  const context = await requestJson(`/api/user/fund?chain=${encodeURIComponent(chainKey)}`);
  const account = await requestMetaMaskAccount();
  const sourceWallet = normalizeAddress(context.sourceWallet);
  const destinationWallet = normalizeAddress(context.destinationWallet);

  if (account !== sourceWallet) {
    throw new Error(`Connected MetaMask ${account} does not match linked wallet ${sourceWallet}.`);
  }

  await switchMetaMaskChain(chainKey);

  const amount = parseUnits(draft.fields.amount, 6);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [destinationWallet as `0x${string}`, amount],
  });
  const provider = getEthereumProvider();
  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: account,
        to: chain.usdcAddress,
        value: "0x0",
        data,
      },
    ],
  });

  if (typeof txHash !== "string") {
    throw new Error("MetaMask did not return a transaction hash.");
  }

  const receipt = await waitForMetaMaskReceipt(txHash);
  const status = receipt?.status === "0x1" ? "success" : receipt?.status === "0x0" ? "failed" : "pending";

  return requestJson("/api/user/fund", {
    method: "POST",
    body: JSON.stringify({
      chain: chainKey,
      amount: draft.fields.amount,
      txHash,
      status,
      fromAddress: account,
      toAddress: destinationWallet,
    }),
  });
}

async function executeCommand(draft: ParsedCommand) {
  if (draft.command === "link") {
    if (draft.fields.walletType === "metamask") {
      return linkMetaMaskWallet();
    }
    throw new Error("Unsupported wallet type");
  }

  if (draft.command === "fund") {
    return fundCircleWalletFromMetaMask(draft);
  }

  if (draft.command === "wallet") {
    if (draft.fields.action === "create") {
      return requestJson("/api/wallet-set", { method: "POST", body: JSON.stringify({}) });
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

  if (draft.command === "transfer") {
    return requestJson("/api/gateway/transfer", {
      method: "POST",
      body: JSON.stringify({
        sourceChain: draft.fields.sourceChain,
        destinationChain: draft.fields.destinationChain,
        amount: draft.fields.amount,
        autoDeposit: true,
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
    return requestJson("/api/gateway/info");
  }

  if (draft.command === "history") {
    const filter = draft.fields.filter;
    const suffix = filter ? `?type=${encodeURIComponent(filter)}` : "";
    return requestJson(`/api/transactions${suffix}`);
  }

  throw new Error("Unsupported command");
}

export function PayCmdApp() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [, setExecutions] = useState<ExecutionItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [scrollMetrics, setScrollMetrics] = useState({ top: 0, height: 1, client: 1 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previousScrollHeightRef = useRef<number | null>(null);
  const isLoadingOlderRef = useRef(false);
  const skipNextAutoScrollRef = useRef(false);

  const showPalette = input.trim() === "/" || input.startsWith("/");
  const unreadCount = notifications.filter((item) => item.status === "unread").length;
  const scrollThumbHeight = Math.max(
    36,
    Math.min(100, (scrollMetrics.client / scrollMetrics.height) * 100),
  );
  const scrollThumbTop =
    scrollMetrics.height <= scrollMetrics.client
      ? 0
      : (scrollMetrics.top / (scrollMetrics.height - scrollMetrics.client)) *
        (100 - scrollThumbHeight);

  function mapRowToMessage(row: ChatMessageRow): ChatMessage {
    const metadata = row.metadata ?? {};

    return {
      id: row.id,
      role: row.role,
      text: row.content,
      kind: row.kind,
      draft: metadata.draft as ParsedCommand | undefined,
      execution: metadata.execution as ExecutionItem | undefined,
      createdAt: row.created_at,
    };
  }

  function addMessage(message: Omit<ChatMessage, "id"> & { id?: string }) {
    setMessages((current) => [
      ...current,
      { ...message, id: message.id ?? `${message.role}_${Date.now()}_${current.length}` },
    ]);
  }

  async function saveMessage(message: Omit<ChatMessage, "id">) {
    if (!threadId || !userId) {
      addMessage(message);
      return null;
    }

    const supabase = createClient();
    const metadata = {
      draft: message.draft ?? null,
      execution: message.execution ?? null,
    };
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        user_id: userId,
        role: message.role,
        content: message.text,
        kind: message.kind ?? "text",
        metadata,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("Failed to save chat message", error);
      addMessage(message);
      return null;
    }

    const savedMessage = mapRowToMessage(data as ChatMessageRow);
    setMessages((current) => [...current, savedMessage]);
    return savedMessage;
  }

  async function addSystemStatus(text: string, execution: ExecutionItem) {
    await saveMessage({ role: "system", text, kind: "status", execution });
  }

  function createExecution(draft: ParsedCommand): ExecutionItem {
    const now = new Date();
    return {
      id: `cmd_${now.getTime()}`,
      draftId: `draft_${now.getTime()}`,
      command: draft.command,
      status: "queued",
      title: draft.summary,
      createdAt: now.toISOString(),
      gateway: {
        network: "Arc Testnet, Base Sepolia, Avalanche Fuji",
        rail: "Circle Gateway",
        mode: "real",
      },
    };
  }

  function resultText(draft: ParsedCommand, result: any) {
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
        return wallet?.address
          ? `Wallet đã sẵn sàng: ${wallet.address}`
          : result?.message ?? "Wallet đã sẵn sàng.";
      }
      return result?.hasWallet
        ? `Wallet active: ${result.scaWallet?.address ?? result.scaWallet?.wallet_address}`
        : "Chưa có Circle wallet. Dùng /wallet create để tạo.";
    }

    if (draft.command === "balance") {
      const chain = draft.fields.chain;
      const balances = result?.balances ?? [];
      if (chain) {
        const chainTotal = balances.reduce((sum: number, item: any) => {
          const gateway = (item.gatewayBalances ?? [])
            .filter((entry: any) => entry.chain === chain)
            .reduce((inner: number, entry: any) => inner + Number(entry.balance || 0), 0);
          const wallet = (item.chainBalances ?? [])
            .filter((entry: any) => entry.chain === chain)
            .reduce((inner: number, entry: any) => inner + Number(entry.balance || 0), 0);
          return sum + gateway + wallet;
        }, 0);
        return `${chain}: ${chainTotal.toFixed(6)} USDC.`;
      }
      return `Unified balance: ${Number(result?.totalUnified ?? 0).toFixed(6)} USDC.`;
    }

    if (draft.command === "deposit") {
      return `Deposit thành công: ${result.amount} USDC từ ${result.chain}.`;
    }

    if (draft.command === "transfer") {
      const autoDeposit = result.autoDeposit
        ? ` Đã auto-deposit ${result.autoDepositedAmount} USDC trước khi transfer.`
        : "";
      return `Transfer thành công: ${result.amount} USDC từ ${result.sourceChain} sang ${result.destinationChain}.${autoDeposit}`;
    }

    if (draft.command === "pay") {
      const payment = result.payment;
      const recipient = payment?.recipient?.label ?? draft.fields.recipient;
      const txHash = result.transfer?.mintTxHash ?? result.transfer?.txHash;
      return `Đã pay ${payment?.amount ?? draft.fields.amount} USDC cho ${recipient} trên ${payment?.destinationChain}. ${txHash ? `Tx: ${txHash}` : ""}`;
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
      return `Đã thêm contact ${result.contact?.display_name ?? draft.fields.name}.`;
    }

    if (draft.command === "gas") {
      return result?.hasGas
        ? `${result.chain}: có gas. Balance native: ${result.balance}.`
        : `${result.chain}: chưa có native gas cho wallet ${result.address}.`;
    }

    if (draft.command === "gateway") {
      return `Gateway online. Domains: ${(result?.domains ?? []).length}.`;
    }

    if (draft.command === "history") {
      const rows = Array.isArray(result) ? result : [];
      if (!rows.length) return "Chưa có transaction history.";
      return `Có ${rows.length} transaction. Gần nhất: ${rows[0].tx_type} ${rows[0].amount} trên ${rows[0].chain}.`;
    }

    return "Command đã hoàn tất.";
  }

  async function runCommand(draft: ParsedCommand) {
    if (draft.missingFields.length) return;

    const execution = createExecution(draft);
    setActiveDraftId(null);
    setExecutions((current) => [execution, ...current]);
    await addSystemStatus(`${execution.title} đã được đưa vào hàng đợi.`, execution);

    const running = { ...execution, status: "running" as const };
    setExecutions((current) =>
      current.map((item) => (item.id === execution.id ? running : item)),
    );
    await addSystemStatus(`${execution.title} đang được xử lý.`, running);

    const waiting = { ...execution, status: "waiting_gateway" as const };
    setExecutions((current) =>
      current.map((item) => (item.id === execution.id ? waiting : item)),
    );
    await addSystemStatus(`${execution.title} đang gọi Circle Gateway.`, waiting);

    try {
      const result = await executeCommand(draft);
      const txHash = result?.txHash ?? result?.mintTxHash;
      const success = {
        ...execution,
        status: "success" as const,
        txHash,
        result,
      };
      setExecutions((current) =>
        current.map((item) => (item.id === execution.id ? success : item)),
      );
      setNotifications((current) => [
        {
          id: `notif_${execution.id}`,
          title: "Command completed",
          body: resultText(draft, result),
          status: "unread",
          commandExecutionId: execution.id,
        },
        ...current,
      ]);
      await addSystemStatus(resultText(draft, result), success);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed";
      const failed = {
        ...execution,
        status: "failed" as const,
        error: message,
      };
      setExecutions((current) =>
        current.map((item) => (item.id === execution.id ? failed : item)),
      );
      setNotifications((current) => [
        {
          id: `notif_${execution.id}`,
          title: "Command failed",
          body: message,
          status: "unread",
          commandExecutionId: execution.id,
        },
        ...current,
      ]);
      await addSystemStatus(message, failed);
    }
  }

  async function loadOlderMessages() {
    const viewport = viewportRef.current;
    if (
      !viewport ||
      !threadId ||
      isLoadingOlder ||
      isLoadingOlderRef.current ||
      !hasOlderMessages ||
      !messages.length
    ) {
      return;
    }

    isLoadingOlderRef.current = true;
    skipNextAutoScrollRef.current = true;
    previousScrollHeightRef.current = viewport.scrollHeight;
    setIsLoadingOlder(true);

    const oldestMessage = messages[0] as ChatMessage & { createdAt?: string };
    const oldestCreatedAt = oldestMessage.createdAt;
    if (!oldestCreatedAt) {
      isLoadingOlderRef.current = false;
      skipNextAutoScrollRef.current = false;
      previousScrollHeightRef.current = null;
      setIsLoadingOlder(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("thread_id", threadId)
      .lt("created_at", oldestCreatedAt)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);

    if (error) {
      console.error("Failed to load older messages", error);
      isLoadingOlderRef.current = false;
      skipNextAutoScrollRef.current = false;
      previousScrollHeightRef.current = null;
      setIsLoadingOlder(false);
      return;
    }

    const olderRows = ((data ?? []) as ChatMessageRow[]).reverse();
    if (!olderRows.length) {
      isLoadingOlderRef.current = false;
      skipNextAutoScrollRef.current = false;
      previousScrollHeightRef.current = null;
      setHasOlderMessages(false);
      setIsLoadingOlder(false);
      return;
    }

    setHasOlderMessages(olderRows.length === MESSAGE_PAGE_SIZE);
    setMessages((current) => [
      ...olderRows.map((row) => ({
        ...mapRowToMessage(row),
        createdAt: row.created_at,
      })),
      ...current,
    ]);
    isLoadingOlderRef.current = false;
    setIsLoadingOlder(false);
  }

  function handleViewportScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setScrollMetrics({
      top: viewport.scrollTop,
      height: viewport.scrollHeight,
      client: viewport.clientHeight,
    });
    if (viewport.scrollTop < 48) {
      void loadOlderMessages();
    }
  }

  function handleViewportWheel(event: WheelEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (event.deltaY < 0 && viewport.scrollTop < 48) {
      void loadOlderMessages();
    }
  }

  function scrollToLatest() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }

  async function submitCommand(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;

    const parsed = parsePayCmd(value);
    await saveMessage({ role: "user", text: value });
    setInput("");

    if (parsed.missingFields.length) {
      await saveMessage({ role: "assistant", text: missingFieldQuestion(parsed.missingFields[0]) });
      return;
    }

    if (!requiresConfirmation(parsed)) {
      await runCommand(parsed);
      return;
    }

    const previewMessage = await saveMessage({
      role: "assistant",
      text: parsed.summary,
      kind: "preview",
      draft: parsed,
    });
    setActiveDraftId(previewMessage?.id ?? null);
  }

  function selectCommand(sample: string) {
    setInput(sample);
  }

  function confirmDraft(draft: ParsedCommand) {
    void runCommand(draft);
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const previousHeight = previousScrollHeightRef.current;
    if (!viewport || previousHeight === null) return;

    viewport.scrollTop = viewport.scrollHeight - previousHeight;
    previousScrollHeightRef.current = null;
  }, [messages.length]);

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
    if (previousScrollHeightRef.current !== null) return;
    window.requestAnimationFrame(scrollToLatest);
  }, [messages.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    setScrollMetrics({
      top: viewport.scrollTop,
      height: viewport.scrollHeight,
      client: viewport.clientHeight,
    });
  }, [messages.length]);

  useEffect(() => {
    async function bootstrapChat() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/auth/login?next=/app";
        return;
      }

      setUserId(user.id);

      const { data: existingThread, error: threadError } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (threadError) {
        console.error("Failed to load chat thread", threadError);
        setIsLoadingHistory(false);
        return;
      }

      let activeThreadId = existingThread?.id as string | undefined;

      if (!activeThreadId) {
        const { data: createdThread, error: createThreadError } = await supabase
          .from("chat_threads")
          .insert({ user_id: user.id, title: "PayCMD main thread" })
          .select("*")
          .single();

        if (createThreadError || !createdThread) {
          console.error("Failed to create chat thread", createThreadError);
          setIsLoadingHistory(false);
          return;
        }

        activeThreadId = createdThread.id as string;
      }

      setThreadId(activeThreadId);

      const { data: recentMessages, error: messagesError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", activeThreadId)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

      if (messagesError) {
        console.error("Failed to load chat messages", messagesError);
        setIsLoadingHistory(false);
        return;
      }

      const recentRows = ((recentMessages ?? []) as ChatMessageRow[]).reverse();
      setHasOlderMessages(recentRows.length === MESSAGE_PAGE_SIZE);
      setMessages(
        recentRows.map((row) => ({
          ...mapRowToMessage(row),
          createdAt: row.created_at,
        })),
      );
      setIsLoadingHistory(false);
    }

    void bootstrapChat();
  }, []);

  return (
    <PayCmdShell>
      <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top_left,oklch(0.96_0.035_168),transparent_32%),linear-gradient(180deg,oklch(0.99_0.006_84),oklch(0.965_0.012_240))] dark:bg-[radial-gradient(circle_at_top_left,oklch(0.28_0.07_166),transparent_30%),linear-gradient(180deg,oklch(0.16_0.018_250),oklch(0.11_0.012_250))]">
        <header className="flex shrink-0 items-center justify-between border-b bg-card/92 px-4 py-3 backdrop-blur md:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Command chat
            </div>
            <h1 className="text-xl font-semibold tracking-normal md:text-2xl">Pay, budget, schedule</h1>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 ? <Badge>{unreadCount} new</Badge> : null}
            <Badge variant="secondary">USDC V1</Badge>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            ref={viewportRef}
            onScroll={handleViewportScroll}
            onWheel={handleViewportWheel}
            className="paycmd-chat-scrollbar h-full overflow-y-scroll px-3 py-4 pr-6 md:px-6 md:pr-9"
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
              {isLoadingHistory ? (
                <div className="mx-auto rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground">
                  Loading chat history...
                </div>
              ) : messages.length ? (
                messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    activeDraftId={activeDraftId}
                    onConfirm={confirmDraft}
                  />
                ))
              ) : (
                <MessageBubble
                  message={{
                    id: "welcome",
                    role: "assistant",
                    text: "PayCMD đã sẵn sàng. Gõ / để chọn command hoặc thử /balance.",
                  }}
                  activeDraftId={activeDraftId}
                  onConfirm={confirmDraft}
                />
              )}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-3 right-2 top-3 w-2 rounded-full bg-border/80 dark:bg-border/70">
            <div
              className="absolute left-0 w-2 rounded-full bg-primary shadow-sm transition-[top,height]"
              style={{
                height: `${scrollThumbHeight}%`,
                top: `${scrollThumbTop}%`,
              }}
            />
          </div>
        </div>

        <div className="shrink-0 border-t bg-card/94 px-3 py-3 backdrop-blur md:px-6">
          <div className="mx-auto w-full max-w-3xl">
            {showPalette ? <CommandPalette query={input} onSelect={selectCommand} /> : null}

            <form
              className="flex items-center gap-2 rounded-2xl border bg-background p-2 shadow-sm"
              onSubmit={submitCommand}
            >
              <Button type="button" variant="ghost" size="icon" aria-label="Attach context">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Message PayCMD or type /"
                className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button type="submit" size="icon" aria-label="Send command">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </PayCmdShell>
  );
}

function normalizePaletteQuery(query: string) {
  return query.trim().replace(/^\/+/, "").toLowerCase();
}

function CommandPalette({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (sample: string) => void;
}) {
  const normalizedQuery = normalizePaletteQuery(query);
  const filteredSections = commandTemplates
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!normalizedQuery) return true;

        const sample = item.sample.replace(/^\/+/, "").toLowerCase();
        const firstToken = sample.split(/\s+/)[0] ?? "";
        const searchable = `${sample} ${item.title} ${item.description}`.toLowerCase();

        return firstToken.startsWith(normalizedQuery) || searchable.includes(normalizedQuery);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="mb-2 overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm font-medium">Commands</div>
        <div className="text-xs text-muted-foreground">
          {normalizedQuery ? `Filter: ${normalizedQuery}` : "Click để điền mẫu"}
        </div>
      </div>
      <div className="paycmd-command-palette-scrollbar max-h-[42vh] overflow-y-auto p-2">
        {filteredSections.length ? (
          <div className="grid gap-3">
            {filteredSections.map((section) => (
            <section key={section.group} className="space-y-2">
              <div className="px-1 text-xs font-semibold uppercase text-muted-foreground">
                {section.group}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.sample}
                      className="group min-w-0 rounded-lg border bg-card p-3 text-left transition hover:border-primary hover:bg-accent"
                      onClick={() => onSelect(item.sample)}
                      type="button"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 rounded-md border bg-background p-1.5 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="flex min-w-0 items-center justify-between gap-2">
                            <span className="truncate font-medium">{item.title}</span>
                            <Badge
                              variant={item.badge === "confirm" ? "default" : "secondary"}
                              className="shrink-0 text-[10px]"
                            >
                              {item.badge}
                            </Badge>
                          </span>
                          <code className="block break-words rounded-md bg-muted px-2 py-1 text-xs text-foreground">
                            {item.sample}
                          </code>
                          <span className="block text-xs leading-5 text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Không có command khớp với “{normalizedQuery}”.
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  activeDraftId,
  onConfirm,
}: {
  message: ChatMessage;
  activeDraftId: string | null;
  onConfirm: (draft: ParsedCommand) => void;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm md:max-w-[74%] ${
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : isSystem
              ? "rounded-bl-md border bg-accent text-accent-foreground"
              : "rounded-bl-md border bg-card"
        }`}
      >
        {message.kind === "preview" && message.draft ? (
          <CommandPreviewCard
            draft={message.draft}
            disabled={activeDraftId !== message.id}
            onConfirm={() => onConfirm(message.draft as ParsedCommand)}
          />
        ) : message.kind === "status" && message.execution ? (
          <ExecutionStatus execution={message.execution} text={message.text} />
        ) : (
          <span>{message.text}</span>
        )}
      </div>
    </div>
  );
}

function CommandPreviewCard({
  draft,
  disabled,
  onConfirm,
}: {
  draft: ParsedCommand;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="min-w-[260px] space-y-3">
      <div>
        <div className="text-xs font-medium uppercase text-muted-foreground">Preview</div>
        <div className="font-semibold">{draft.summary}</div>
      </div>
      <div className="grid gap-2 text-xs">
        <Row label="Command" value={`/${draft.command}`} />
        {Object.entries(draft.fields).map(([key, value]) =>
          value ? <Row key={key} label={key} value={value} /> : null,
        )}
      </div>
      <div className="rounded-lg border bg-background p-2 text-xs text-muted-foreground">
        Rail: Circle Gateway · Mode: real
        {draft.command === "transfer" ? " · Auto-deposit nếu Gateway balance thiếu" : ""}
        {draft.command === "fund" ? " · MetaMask sẽ mở popup ký USDC transfer" : ""}
      </div>
      <Button className="w-full" disabled={disabled} onClick={onConfirm}>
        <Check className="mr-2 h-4 w-4" />
        {disabled ? "Confirmed" : "Confirm command"}
      </Button>
    </div>
  );
}

function ExecutionStatus({ execution, text }: { execution: ExecutionItem; text: string }) {
  const done = execution.status === "success";
  const failed = execution.status === "failed";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-medium">
        {done ? (
          <Check className="h-4 w-4 text-primary" />
        ) : failed ? (
          <Clock3 className="h-4 w-4 text-destructive" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        {statusLabel(execution.status)}
      </div>
      <div>{text}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        {execution.gateway.rail} · {execution.gateway.network}
      </div>
      {execution.txHash ? (
        <div className="break-all rounded-lg bg-background p-2 text-xs text-muted-foreground">
          {execution.txHash}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words font-medium">{value}</span>
    </div>
  );
}
