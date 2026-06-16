"use client";

import {
  BadgeDollarSign,
  Bot,
  Check,
  Clipboard,
  Copy,
  ChevronRight,
  Clock3,
  Download,
  FileDown,
  Link2,
  History,
  Loader2,
  Maximize2,
  Paperclip,
  Printer,
  ReceiptText,
  Search,
  Send,
  Sparkles,
  Table2,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Users,
  Wallet,
  WalletCards,
  Waypoints,
  Zap,
  X,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, KeyboardEvent, ReactNode, useEffect, useLayoutEffect, useRef, useState, WheelEvent } from "react";
import { decodeFunctionResult, encodeFunctionData, erc20Abi, formatUnits, parseUnits } from "viem";

import {
  ChainRoute,
  ExplorerTxLink,
  RailBadge,
  inferRailFromCommand,
} from "@/components/chain-identity";
import { MetaMaskStatusPills } from "@/components/metamask-status-pills";
import { PayCmdShell } from "@/components/paycmd-shell";
import {
  isForegroundOnlyCommand,
  usePayCmdRuntime,
} from "@/components/paycmd-runtime";
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

type AiProvider = "openai" | "asksurf" | "paycmd";
type ChatMode = "paycmd" | "asksurf";
type SurfMode = "instant" | "research";
type SurfEffort = "standard" | "extended" | "maximum";

type ChatCitation = {
  title?: string;
  url?: string;
};

type AssistantAction = {
  kind: "switch_to_asksurf";
  label: string;
  query: string;
  surfMode?: SurfMode;
  effort?: SurfEffort;
};

type DraftState = "active" | "cancelled" | "confirmed";
type PreviewDisplayState = DraftState | "closed";

type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
  kind?: "text" | "preview" | "status" | "onboarding";
  draft?: ParsedCommand;
  draftState?: DraftState;
  execution?: ExecutionItem;
  createdAt?: string;
  provider?: AiProvider;
  citations?: ChatCitation[];
  model?: string;
  surfMode?: SurfMode;
  effort?: SurfEffort;
  durationMs?: number;
  actions?: AssistantAction[];
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

type AiModelOption = {
  id: string;
  label: string;
  description: string;
};

type AiCommandResult = {
  intent: "command" | "answer" | "clarify" | "crypto_research";
  canonicalCommand: string;
  assistantText: string;
  missingFields: string[];
  suggestions: string[];
  parsedCommand: ParsedCommand | null;
  modelProfile?: string;
};

type CryptoResearchResult = {
  assistantText: string;
  citations?: ChatCitation[];
  provider: "asksurf";
  model?: string;
  surfMode?: SurfMode;
  effort?: SurfEffort;
  durationMs?: number;
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
const METAMASK_CONFIRMATION_TIMEOUT_MS = 90_000;
const METAMASK_CHAIN_TIMEOUT_MS = 60_000;
const METAMASK_RPC_TIMEOUT_MS = 15_000;
const aiLoadingCopy: Record<AiProvider, string[]> = {
  openai: [
    "OpenAI đang hiểu ý định PayCMD...",
    "Đang kiểm tra lệnh, chain và trường cần thiết...",
    "Đang chuẩn bị preview an toàn...",
  ],
  asksurf: [
    "AskSurf đang tìm thông tin crypto...",
    "Đang tổng hợp market, protocol và on-chain context...",
    "Đang chuẩn hóa câu trả lời cho PayCMD...",
  ],
  paycmd: ["PayCMD đang xử lý..."],
};

const surfEffortOptions: { id: SurfEffort; label: string; description: string }[] = [
  { id: "standard", label: "Standard", description: "surf-1.5, medium reasoning" },
  { id: "extended", label: "Extended", description: "surf-1.5, high reasoning" },
  { id: "maximum", label: "Maximum", description: "surf-1.5-thinking, high reasoning" },
];

function surfModeLabel(mode?: SurfMode) {
  return mode === "instant" ? "Instant" : "Research 2.0";
}

function surfEffortLabel(effort?: SurfEffort) {
  return surfEffortOptions.find((option) => option.id === effort)?.label ?? "Standard";
}

function surfClientTimeoutMs(mode: SurfMode) {
  return mode === "instant" ? 120_000 : 600_000;
}

function formatDuration(ms?: number) {
  if (!ms || ms < 0) return "";
  const seconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${String(remainder).padStart(2, "0")}s` : `${seconds}s`;
}

function normalizeAiProvider(value: unknown): AiProvider | undefined {
  return value === "openai" || value === "asksurf" || value === "paycmd" ? value : undefined;
}

function normalizeAssistantActions(value: unknown): AssistantAction[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const actions: AssistantAction[] = value
    .map((item) => recordFrom(item))
    .filter((item) => item.kind === "switch_to_asksurf" && typeof item.query === "string" && item.query.trim())
    .map((item) => ({
      kind: "switch_to_asksurf" as const,
      label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : "Hỏi bằng AskSurf",
      query: (item.query as string).trim(),
      surfMode: item.surfMode === "instant" || item.surfMode === "research" ? item.surfMode : "research",
      effort:
        item.effort === "standard" || item.effort === "extended" || item.effort === "maximum"
          ? item.effort
          : "standard",
    }));

  return actions.length ? actions : undefined;
}

function providerName(provider?: AiProvider) {
  if (provider === "openai") return "OpenAI Router";
  if (provider === "asksurf") return "AskSurf Research";
  if (provider === "paycmd") return "PayCMD";
  return "";
}

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
      {
        sample: "/wallet balance",
        title: "SCA wallet USDC",
        description: "Xem USDC còn nằm trong Circle SCA wallet.",
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
      {
        sample: "/gateway balance",
        title: "Gateway balance",
        description: "Chỉ xem USDC đã deposit vào Gateway.",
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
        sample: "/withdraw 5 from base",
        title: "Withdraw khỏi Gateway",
        description: "Rút Gateway balance về Circle SCA wallet cùng chain.",
        badge: "confirm",
        icon: Download,
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
        title: "Gas Arc",
        description: "Kiểm tra native gas trên Arc Testnet.",
        badge: "read",
        icon: Clock3,
      },
      {
        sample: "/gas check base",
        title: "Gas Base",
        description: "Kiểm tra ETH gas trên Base Sepolia.",
        badge: "read",
        icon: Clock3,
      },
      {
        sample: "/gas check avalanche",
        title: "Gas Avalanche",
        description: "Kiểm tra AVAX gas trên Avalanche Fuji.",
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

const onboardingCommands = [
  {
    sample: "/wallet create",
    title: "Tạo ví Circle",
    description: "Idempotent: nếu có ví rồi PayCMD sẽ báo ví đã sẵn sàng.",
  },
  {
    sample: "/wallet status",
    title: "Kiểm tra ví",
    description: "Xem Circle SCA wallet và Gateway signer.",
  },
  {
    sample: "/balance",
    title: "Xem tổng USDC",
    description: "Unified view gồm SCA wallet và Gateway balance.",
  },
  {
    sample: "/fund 10 from metamask on base",
    title: "Nạp từ MetaMask",
    description: "Chuyển USDC vào Circle SCA wallet trên chain nguồn.",
  },
  {
    sample: "/transfer 5 from base to arc",
    title: "Cross-chain",
    description: "Dùng Circle Gateway để chuyển USDC sang chain khác.",
  },
  {
    sample: "/contacts add Minh 0x0000000000000000000000000000000000000000 on arc",
    title: "Lưu contact",
    description: "Sau đó có thể gõ pay Minh bằng tên.",
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

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringFrom(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function looksLikeResearchQuestion(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.startsWith("/")) return false;
  if (looksLikePayCmdAction(normalized)) return false;

  return /\b(là gì|la gi|what is|why|vì sao|vi sao|research|nghiên cứu|nghien cuu|phân tích|phan tich|so sánh|so sanh|tin tức|tin tuc|market|token|chain|protocol|defi|tvl|yield|gateway|cctp|stablecoin|usdc|monad|arc|base|ethereum|solana|avalanche|circle)\b/i.test(
    normalized,
  );
}

function looksLikePayCmdAction(value: string) {
  return /\b(chuyển|chuyen|gửi|gui|trả|tra|pay|send|transfer|nạp|nap|fund|deposit|withdraw|rút|rut|balance|số dư|so du|wallet|ví|vi|contact|liên hệ|lien he|payroll|request)\b/i.test(
    value,
  );
}

function executionResultRecords(execution: ExecutionItem) {
  const result = recordFrom(execution.result);
  return {
    result,
    transfer: recordFrom(result.transfer),
    payment: recordFrom(result.payment),
  };
}

function executionSourceChain(execution: ExecutionItem) {
  const { result, transfer, payment } = executionResultRecords(execution);

  return (
    stringFrom(result.sourceChain) ??
    stringFrom(transfer.sourceChain) ??
    stringFrom(payment.sourceChain) ??
    stringFrom(result.chain) ??
    stringFrom(transfer.chain) ??
    null
  );
}

function executionDestinationChain(execution: ExecutionItem) {
  const { result, transfer, payment } = executionResultRecords(execution);

  return (
    stringFrom(result.destinationChain) ??
    stringFrom(transfer.destinationChain) ??
    stringFrom(payment.destinationChain) ??
    null
  );
}

function executionTxLinks(execution: ExecutionItem) {
  const { result, transfer } = executionResultRecords(execution);
  const sourceChain = executionSourceChain(execution);
  const destinationChain = executionDestinationChain(execution);
  const primaryHash =
    stringFrom(execution.txHash) ??
    stringFrom(result.txHash) ??
    stringFrom(result.mintTxHash) ??
    stringFrom(transfer.txHash) ??
    stringFrom(transfer.mintTxHash);
  const autoDepositHash = stringFrom(result.autoDepositTxHash) ?? stringFrom(transfer.autoDepositTxHash);
  const links: Array<{ label: string; txHash: string; chain: string | null }> = [];

  if (autoDepositHash) {
    links.push({ label: "Auto-deposit", txHash: autoDepositHash, chain: sourceChain });
  }

  if (primaryHash && primaryHash !== autoDepositHash) {
    const chain = execution.command === "transfer" || execution.command === "pay"
      ? destinationChain ?? sourceChain
      : sourceChain ?? destinationChain;
    const label =
      execution.command === "transfer" || execution.command === "pay" || execution.command === "withdraw"
        ? "Mint"
        : "Transaction";

    links.push({ label, txHash: primaryHash, chain });
  }

  return links;
}

function usesGatewayPipeline(draft: ParsedCommand) {
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

function getEthereumProvider(): EthereumProvider {
  const provider = window.ethereum;

  if (!provider?.request) {
    throw new Error("MetaMask is not available. Install MetaMask and try again.");
  }

  return provider as EthereumProvider;
}

function normalizeMetaMaskError(error: unknown, fallback: string) {
  const maybeError = error as { code?: number; message?: string };

  if (maybeError?.code === 4001) {
    return Object.assign(new Error("MetaMask request was rejected."), { code: maybeError.code });
  }

  if (maybeError?.code === -32002) {
    return Object.assign(
      new Error("MetaMask already has a pending request. Open MetaMask and finish or cancel it."),
      { code: maybeError.code },
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return Object.assign(new Error(maybeError?.message ?? fallback), { code: maybeError?.code });
}

function withThirdPartyTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${Math.round(timeoutMs / 1000)} seconds. Open MetaMask to finish or cancel the pending request, then run the command again.`,
        ),
      );
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(normalizeMetaMaskError(error, `${label} failed.`));
      },
    );
  });
}

function requestMetaMask(
  args: { method: string; params?: unknown[] },
  options?: { timeoutMs?: number; label?: string },
) {
  const provider = getEthereumProvider();

  return withThirdPartyTimeout(
    provider.request(args),
    options?.timeoutMs ?? METAMASK_CONFIRMATION_TIMEOUT_MS,
    options?.label ?? args.method,
  );
}

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

function bigIntFromRpcQuantity(value: unknown) {
  if (typeof value === "string" && value.startsWith("0x")) {
    return BigInt(value);
  }

  return 0n;
}

function formatDecimalAmount(value: unknown, maxFractionDigits = 6) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(numberValue);
}

function formatNativeGasBalance(rawBalance: unknown, chain: string) {
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

function totalBalanceSource(
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

async function requestMetaMaskAccount() {
  const accounts = await requestMetaMask(
    { method: "eth_requestAccounts" },
    { label: "MetaMask account selection" },
  );
  const address = Array.isArray(accounts) ? String(accounts[0] ?? "") : "";

  if (!address) {
    throw new Error("No MetaMask account selected.");
  }

  return normalizeAddress(address);
}

async function linkMetaMaskWallet() {
  const address = await requestMetaMaskAccount();
  const message = [
    "Link this MetaMask wallet to PayCMD.",
    `Address: ${address}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join("\n");
  const signature = await requestMetaMask(
    {
      method: "personal_sign",
      params: [message, address],
    },
    { label: "MetaMask signature" },
  );

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
  const chain = web3Chains[chainKey];

  try {
    await requestMetaMask(
      {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chain.hexChainId }],
      },
      { timeoutMs: METAMASK_CHAIN_TIMEOUT_MS, label: `Switch MetaMask to ${chain.name}` },
    );
  } catch (error: any) {
    if (error?.code !== 4902) {
      throw error;
    }

    await requestMetaMask(
      {
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
      },
      { timeoutMs: METAMASK_CHAIN_TIMEOUT_MS, label: `Add ${chain.name} to MetaMask` },
    );
  }
}

async function waitForMetaMaskReceipt(txHash: string) {
  for (let index = 0; index < 30; index += 1) {
    const receipt = await requestMetaMask(
      {
        method: "eth_getTransactionReceipt",
        params: [txHash],
      },
      { timeoutMs: METAMASK_RPC_TIMEOUT_MS, label: "Transaction receipt lookup" },
    );

    if (receipt && typeof receipt === "object") {
      return receipt as { status?: string };
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return null;
}

async function getNativeBalance(address: string) {
  const balance = await requestMetaMask(
    {
      method: "eth_getBalance",
      params: [address, "latest"],
    },
    { timeoutMs: METAMASK_RPC_TIMEOUT_MS, label: "Native gas balance lookup" },
  );

  return bigIntFromRpcQuantity(balance);
}

async function getErc20Balance(tokenAddress: `0x${string}`, account: string) {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account as `0x${string}`],
  });
  const result = await requestMetaMask(
    {
      method: "eth_call",
      params: [{ to: tokenAddress, data }, "latest"],
    },
    { timeoutMs: METAMASK_RPC_TIMEOUT_MS, label: "USDC balance lookup" },
  );

  if (typeof result !== "string") {
    return 0n;
  }

  return decodeFunctionResult({
    abi: erc20Abi,
    functionName: "balanceOf",
    data: result as `0x${string}`,
  });
}

async function estimateFundGas(params: {
  account: string;
  tokenAddress: `0x${string}`;
  data: `0x${string}`;
  chainName: string;
}) {
  try {
    await requestMetaMask(
      {
        method: "eth_estimateGas",
        params: [
          {
            from: params.account,
            to: params.tokenAddress,
            value: "0x0",
            data: params.data,
          },
        ],
      },
      { timeoutMs: METAMASK_RPC_TIMEOUT_MS, label: "Gas estimation" },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown gas estimation error";
    throw new Error(
      `Không thể ước tính gas cho lệnh fund trên ${params.chainName}. Kiểm tra ví MetaMask có đủ native gas token và USDC trên đúng network. Chi tiết: ${message}`,
    );
  }
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

  const nativeBalance = await getNativeBalance(account);
  if (nativeBalance === 0n) {
    throw new Error(
      `Ví MetaMask ${account} chưa có ${chain.nativeCurrency.symbol} trên ${chain.name} để trả gas. Nạp một ít ${chain.nativeCurrency.symbol} vào ví rồi chạy lại lệnh fund.`,
    );
  }

  const usdcBalance = await getErc20Balance(chain.usdcAddress, account);
  if (usdcBalance < amount) {
    throw new Error(
      `Ví MetaMask không đủ USDC trên ${chain.name}. Cần ${draft.fields.amount} USDC, hiện có ${formatUnits(usdcBalance, 6)} USDC.`,
    );
  }

  await estimateFundGas({
    account,
    tokenAddress: chain.usdcAddress,
    data,
    chainName: chain.name,
  });

  const txHash = await requestMetaMask(
    {
      method: "eth_sendTransaction",
      params: [
        {
          from: account,
          to: chain.usdcAddress,
          value: "0x0",
          data,
        },
      ],
    },
    { label: "MetaMask USDC transfer confirmation" },
  );

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

export function PayCmdApp() {
  const { registerStatusWriter, runServerCommand, unreadCount } = usePayCmdRuntime();
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>("paycmd");
  const [selectedSurfMode, setSelectedSurfMode] = useState<SurfMode>("research");
  const [selectedSurfEffort, setSelectedSurfEffort] = useState<SurfEffort>("standard");
  const [aiModels, setAiModels] = useState<AiModelOption[]>([]);
  const [selectedAiModel, setSelectedAiModel] = useState("gpt-5.5");
  const [suggestionChips, setSuggestionChips] = useState<string[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAiProvider, setActiveAiProvider] = useState<AiProvider | null>(null);
  const [aiLoadingStep, setAiLoadingStep] = useState(0);
  const [activeAskSurfStartedAt, setActiveAskSurfStartedAt] = useState<number | null>(null);
  const [activeAskSurfElapsedMs, setActiveAskSurfElapsedMs] = useState(0);
  const [activeAskSurfMode, setActiveAskSurfMode] = useState<SurfMode>("research");
  const [activeAskSurfEffort, setActiveAskSurfEffort] = useState<SurfEffort>("standard");
  const [isSlowAskSurfNoticeDismissed, setIsSlowAskSurfNoticeDismissed] = useState(false);
  const [, setExecutions] = useState<ExecutionItem[]>([]);
  const [scrollMetrics, setScrollMetrics] = useState({ top: 0, height: 1, client: 1 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previousScrollHeightRef = useRef<number | null>(null);
  const isLoadingOlderRef = useRef(false);
  const skipNextAutoScrollRef = useRef(false);
  const draftInputBeforeHistoryRef = useRef("");
  const submitLockRef = useRef(false);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  const showPalette = input.trim() === "/" || input.startsWith("/");
  const isInputBusy = isAiThinking || isSubmitting;
  const showSlowAskSurfNotice =
    activeAiProvider === "asksurf" && aiLoadingStep >= 7 && !isSlowAskSurfNoticeDismissed;
  const userInputHistory = messages
    .filter((message) => message.role === "user")
    .map((message) => message.text.trim())
    .filter(Boolean);
  const scrollThumbHeight = Math.max(
    36,
    Math.min(100, (scrollMetrics.client / scrollMetrics.height) * 100),
  );
  const scrollThumbTop =
    scrollMetrics.height <= scrollMetrics.client
      ? 0
      : (scrollMetrics.top / (scrollMetrics.height - scrollMetrics.client)) *
        (100 - scrollThumbHeight);
  const latestStatusMessageIdByExecution = messages.reduce<Record<string, string>>(
    (latest, message) => {
      if (message.kind === "status" && message.execution) {
        latest[message.execution.id] = message.id;
      }

      return latest;
    },
    {},
  );

  function mapRowToMessage(row: ChatMessageRow): ChatMessage {
    const metadata = row.metadata ?? {};

    return {
      id: row.id,
      role: row.role,
      text: row.content,
      kind: row.kind,
      draft: metadata.draft as ParsedCommand | undefined,
      draftState:
        metadata.draftState === "active" ||
        metadata.draftState === "cancelled" ||
        metadata.draftState === "confirmed"
          ? metadata.draftState
          : undefined,
      execution: metadata.execution as ExecutionItem | undefined,
      createdAt: row.created_at,
      provider: normalizeAiProvider(metadata.provider),
      citations: Array.isArray(metadata.citations) ? (metadata.citations as ChatCitation[]) : undefined,
      model: typeof metadata.model === "string" ? metadata.model : undefined,
      surfMode:
        metadata.surfMode === "instant" || metadata.surfMode === "research"
          ? metadata.surfMode
          : undefined,
      effort:
        metadata.effort === "standard" ||
        metadata.effort === "extended" ||
        metadata.effort === "maximum"
          ? metadata.effort
          : undefined,
      durationMs: typeof metadata.durationMs === "number" ? metadata.durationMs : undefined,
      actions: normalizeAssistantActions(metadata.actions),
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
      draftState: message.draftState ?? null,
      execution: message.execution ?? null,
      provider: message.provider ?? null,
      citations: message.citations ?? null,
      model: message.model ?? null,
      surfMode: message.surfMode ?? null,
      effort: message.effort ?? null,
      durationMs: message.durationMs ?? null,
      actions: message.actions ?? null,
    };
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        user_id: userId,
        role: message.role,
        content: message.text,
        kind: message.kind === "onboarding" ? "text" : message.kind ?? "text",
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

  async function updateDraftState(messageId: string, draftState: DraftState) {
    const target = messages.find((message) => message.id === messageId);
    if (!target?.draft) return;

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, draftState } : message,
      ),
    );

    if (activeDraftId === messageId) {
      setActiveDraftId(null);
    }

    if (!userId) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("chat_messages")
      .update({
        metadata: {
          draft: target.draft,
          draftState,
          execution: target.execution ?? null,
          provider: target.provider ?? null,
          citations: target.citations ?? null,
          model: target.model ?? null,
          surfMode: target.surfMode ?? null,
          effort: target.effort ?? null,
          durationMs: target.durationMs ?? null,
          actions: target.actions ?? null,
        },
      })
      .eq("id", messageId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to update draft state", error);
    }
  }

  async function cancelDraft(messageId: string) {
    await updateDraftState(messageId, "cancelled");
  }

  function cancelActiveInteraction() {
    if (activeAiProvider && aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
      setIsAiThinking(false);
      setIsSubmitting(false);
      setActiveAiProvider(null);
      setAiLoadingStep(0);
      setActiveAskSurfStartedAt(null);
      setActiveAskSurfElapsedMs(0);
      submitLockRef.current = false;
      return true;
    }

    if (activeDraftId) {
      void cancelDraft(activeDraftId);
      return true;
    }

    if (input.trim()) {
      setInput("");
      setHistoryIndex(null);
      draftInputBeforeHistoryRef.current = "";
      setSuggestionChips([]);
      return true;
    }

    return false;
  }

  async function askCryptoResearch(
    value: string,
    recentMessages: { role: string; text: string }[],
    options?: { surfMode?: SurfMode; effort?: SurfEffort },
  ) {
    const surfMode = options?.surfMode ?? "research";
    const effort = surfMode === "instant" ? "standard" : options?.effort ?? "standard";
    setActiveAiProvider("asksurf");
    setActiveAskSurfMode(surfMode);
    setActiveAskSurfEffort(effort);
    setActiveAskSurfStartedAt(Date.now());
    setActiveAskSurfElapsedMs(0);
    setAiLoadingStep(0);
    setIsSlowAskSurfNoticeDismissed(false);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, surfClientTimeoutMs(surfMode));
    aiAbortControllerRef.current = controller;

    try {
      const result = (await requestJson("/api/ai/crypto", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          input: value,
          recentMessages,
          surfMode,
          effort,
        }),
      })) as CryptoResearchResult;

      await saveMessage({
        role: "assistant",
        text: result.assistantText,
        provider: "asksurf",
        citations: result.citations ?? [],
        model: result.model,
        surfMode: result.surfMode ?? surfMode,
        effort: result.effort ?? effort,
        durationMs: result.durationMs,
      });
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") {
        if (timedOut) {
          await saveMessage({
            role: "assistant",
            text: `AskSurf timed out after ${Math.round(surfClientTimeoutMs(surfMode) / 1000)} seconds.`,
            provider: "asksurf",
            surfMode,
            effort,
          });
        }
        return;
      }

      const message = error instanceof Error ? error.message : "AskSurf research failed";
      await saveMessage({
        role: "assistant",
        text: `AskSurf chưa lấy được thông tin: ${message}`,
        provider: "asksurf",
        surfMode,
        effort,
      });
    } finally {
      window.clearTimeout(timeout);
      if (aiAbortControllerRef.current === controller) {
        aiAbortControllerRef.current = null;
      }
      setActiveAskSurfStartedAt(null);
      setActiveAskSurfElapsedMs(0);
      setActiveAiProvider(null);
    }
  }

  async function askAiForCommand(value: string) {
    setIsAiThinking(true);
    setActiveAiProvider("openai");
    setAiLoadingStep(0);
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;
    try {
      const recentMessages = messages.slice(-8).map((message) => ({
        role: message.role,
        text: message.text,
      }));
      const result = (await requestJson("/api/ai/command", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          input: value,
          modelProfile: selectedAiModel,
          recentMessages,
        }),
      })) as AiCommandResult;

      setSuggestionChips((result.suggestions ?? []).slice(0, 4));

      if (result.intent === "crypto_research") {
        await askCryptoResearch(value, recentMessages, { surfMode: "research", effort: "standard" });
        return;
      }

      if (result.intent === "command" && result.parsedCommand) {
        if (!requiresConfirmation(result.parsedCommand)) {
          await runCommand(result.parsedCommand);
          return;
        }

        if (activeDraftId) {
          await updateDraftState(activeDraftId, "cancelled");
        }

        const previewMessage = await saveMessage({
          role: "assistant",
          text: result.assistantText || result.parsedCommand.summary,
          kind: "preview",
          draft: result.parsedCommand,
          draftState: "active",
          provider: "openai",
          model: result.modelProfile,
        });
        setActiveDraftId(previewMessage?.id ?? null);
        return;
      }

      await saveMessage({
        role: "assistant",
        text: result.assistantText || "Mình cần thêm thông tin để tạo command.",
        provider: "openai",
        model: result.modelProfile,
      });
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") {
        return;
      }

      const message = error instanceof Error ? error.message : "AI command parsing failed";
      await saveMessage({
        role: "assistant",
        text: looksLikeResearchQuestion(value)
          ? "PayCMD đang ở chế độ lệnh/thanh toán nên OpenAI Router chưa xử lý được câu hỏi research này. Chuyển sang AskSurf để hỏi trực tiếp và nhận bài research có nguồn, sections, bảng nếu có dữ liệu."
          : `AI chưa xử lý được câu này: ${message}`,
        provider: "openai",
        actions: looksLikeResearchQuestion(value)
          ? [
              {
                kind: "switch_to_asksurf",
                label: "Hỏi bằng AskSurf",
                query: value,
                surfMode: "research",
                effort: selectedSurfEffort,
              },
            ]
          : undefined,
      });
    } finally {
      if (aiAbortControllerRef.current === controller) {
        aiAbortControllerRef.current = null;
      }
      setIsAiThinking(false);
      setActiveAiProvider(null);
    }
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

  async function runForegroundCommand(draft: ParsedCommand) {
    if (draft.missingFields.length) return;

    const execution = createExecution(draft);
    setActiveDraftId(null);

    const running = { ...execution, status: "running" as const };
    const waiting = { ...execution, status: "waiting_gateway" as const };

    if (usesGatewayPipeline(draft)) {
      setExecutions((current) => [execution, ...current]);
      await addSystemStatus(`${execution.title} đã được đưa vào hàng đợi.`, execution);

      setExecutions((current) =>
        current.map((item) => (item.id === execution.id ? running : item)),
      );
      await addSystemStatus(`${execution.title} đang được xử lý.`, running);

      setExecutions((current) =>
        current.map((item) => (item.id === execution.id ? waiting : item)),
      );
      await addSystemStatus(`${execution.title} đang gọi Circle Gateway.`, waiting);
    } else {
      setExecutions((current) => [running, ...current]);
      await addSystemStatus(`${execution.title} đang kiểm tra.`, running);
    }

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
      await addSystemStatus(resultText(draft, result), success);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed";
      const errorCode = (error as { code?: string })?.code;
      const waitingGateway = errorCode === "GATEWAY_FINALITY_PENDING";
      const failed = {
        ...execution,
        status: waitingGateway ? "waiting_gateway" as const : "failed" as const,
        error: message,
      };
      setExecutions((current) =>
        current.map((item) => (item.id === execution.id ? failed : item)),
      );
      await addSystemStatus(message, failed);
    }
  }

  async function runCommand(draft: ParsedCommand) {
    if (draft.missingFields.length) return;

    if (isForegroundOnlyCommand(draft)) {
      await runForegroundCommand(draft);
      return;
    }

    if (!threadId || !userId) {
      await saveMessage({
        role: "assistant",
        text: "Chat chưa sẵn sàng để chạy command nền. Đợi lịch sử tải xong rồi thử lại.",
        provider: "paycmd",
      });
      return;
    }

    setActiveDraftId(null);
    await runServerCommand(draft, { threadId, userId });
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

  async function submitValue(value: string, options?: { forceAskSurf?: boolean }) {
    await saveMessage({ role: "user", text: value });
    setInput("");
    setHistoryIndex(null);
    draftInputBeforeHistoryRef.current = "";
    setSuggestionChips([]);

    const recentMessages = messages.slice(-8).map((message) => ({
      role: message.role,
      text: message.text,
    }));

    if (!value.startsWith("/") && (options?.forceAskSurf || chatMode === "asksurf")) {
      await askCryptoResearch(value, recentMessages, {
        surfMode: selectedSurfMode,
        effort: selectedSurfEffort,
      });
      return;
    }

    if (!value.startsWith("/")) {
      await askAiForCommand(value);
      return;
    }

    const parsed = parsePayCmd(value);

    if (parsed.missingFields.length) {
      await saveMessage({
        role: "assistant",
        text: missingFieldQuestion(parsed.missingFields[0]),
        provider: "paycmd",
      });
      return;
    }

    if (!requiresConfirmation(parsed)) {
      await runCommand(parsed);
      return;
    }

    if (activeDraftId) {
      await updateDraftState(activeDraftId, "cancelled");
    }

    const previewMessage = await saveMessage({
      role: "assistant",
      text: parsed.summary,
      kind: "preview",
      draft: parsed,
      draftState: "active",
      provider: "paycmd",
    });
    setActiveDraftId(previewMessage?.id ?? null);
  }

  async function submitCommand(event: FormEvent) {
    event.preventDefault();
    if (submitLockRef.current) return;

    const value = input.trim();
    if (!value) return;

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      await submitValue(value);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  function submitRelatedQuestion(question: string) {
    const value = question.trim();
    if (!value || submitLockRef.current) return;

    void (async () => {
      submitLockRef.current = true;
      setIsSubmitting(true);
      setChatMode("asksurf");

      try {
        await submitValue(value, { forceAskSurf: true });
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    })();
  }

  function selectCommand(sample: string) {
    setInput(sample);
    setHistoryIndex(null);
    draftInputBeforeHistoryRef.current = "";
    setSuggestionChips([]);
  }

  function handleInputChange(value: string) {
    setInput(value);
    setHistoryIndex(null);
    draftInputBeforeHistoryRef.current = "";
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }

    if (!userInputHistory.length) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSuggestionChips([]);
      setHistoryIndex((current) => {
        if (current === null) {
          draftInputBeforeHistoryRef.current = input;
        }

        const nextIndex = current === null ? userInputHistory.length - 1 : Math.max(0, current - 1);
        setInput(userInputHistory[nextIndex]);
        return nextIndex;
      });
      return;
    }

    if (historyIndex === null) {
      return;
    }

    event.preventDefault();
    setSuggestionChips([]);
    setHistoryIndex((current) => {
      if (current === null) {
        return null;
      }

      const nextIndex = current + 1;
      if (nextIndex >= userInputHistory.length) {
        setInput(draftInputBeforeHistoryRef.current);
        draftInputBeforeHistoryRef.current = "";
        return null;
      }

      setInput(userInputHistory[nextIndex]);
      return nextIndex;
    });
  }

  function confirmDraft(messageId: string, draft: ParsedCommand) {
    void (async () => {
      await updateDraftState(messageId, "confirmed");
      await runCommand(draft);
    })();
  }

  useEffect(() => {
    if (!threadId || !userId) {
      return;
    }

    return registerStatusWriter(async (text, execution) => {
      await addSystemStatus(text, execution as ExecutionItem);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerStatusWriter, threadId, userId]);

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (cancelActiveInteraction()) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAiProvider, activeDraftId, input]);

  useEffect(() => {
    if (!activeAiProvider) {
      setAiLoadingStep(0);
      setActiveAskSurfElapsedMs(0);
      return;
    }

    const interval = window.setInterval(() => {
      setAiLoadingStep((current) => current + 1);
      if (activeAiProvider === "asksurf" && activeAskSurfStartedAt) {
        setActiveAskSurfElapsedMs(Date.now() - activeAskSurfStartedAt);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeAiProvider, activeAskSurfStartedAt]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const previousHeight = previousScrollHeightRef.current;
    if (!viewport || previousHeight === null) return;

    viewport.scrollTop = viewport.scrollHeight - previousHeight;
    previousScrollHeightRef.current = null;
  }, [messages.length, activeAiProvider]);

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
    if (previousScrollHeightRef.current !== null) return;
    window.requestAnimationFrame(scrollToLatest);
  }, [messages.length, activeAiProvider]);

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
    async function loadAiModels() {
      try {
        const data = await requestJson("/api/ai/models");
        setAiModels(data.models ?? []);
        setSelectedAiModel(data.defaultModelProfile ?? "gpt-5.5");
      } catch (error) {
        console.error("Failed to load AI models", error);
      }
    }

    void loadAiModels();
  }, []);

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
      const mappedMessages = recentRows.map((row) => ({
        ...mapRowToMessage(row),
        createdAt: row.created_at,
      }));
      setHasOlderMessages(recentRows.length === MESSAGE_PAGE_SIZE);
      setMessages(mappedMessages);
      setActiveDraftId(
        [...mappedMessages]
          .reverse()
          .find((message) => message.kind === "preview" && message.draftState === "active")
          ?.id ?? null,
      );
      setIsLoadingHistory(false);
    }

    void bootstrapChat();
  }, []);

  return (
    <PayCmdShell>
      <div className="relative flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top_left,oklch(0.96_0.035_168),transparent_32%),linear-gradient(180deg,oklch(0.99_0.006_84),oklch(0.965_0.012_240))] dark:bg-[radial-gradient(circle_at_top_left,oklch(0.28_0.07_166),transparent_30%),linear-gradient(180deg,oklch(0.16_0.018_250),oklch(0.11_0.012_250))]">
        {showSlowAskSurfNotice ? (
          <SlowAskSurfNotice
            mode={activeAskSurfMode}
            effort={activeAskSurfEffort}
            elapsedMs={activeAskSurfElapsedMs || undefined}
            onDismiss={() => setIsSlowAskSurfNoticeDismissed(true)}
          />
        ) : null}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-card/92 px-4 py-3 backdrop-blur md:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Command chat
            </div>
            <h1 className="truncate text-xl font-semibold tracking-normal md:text-2xl">Pay, budget, schedule</h1>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {unreadCount > 0 ? <Badge>{unreadCount} new</Badge> : null}
            <MetaMaskStatusPills />
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
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
              {isLoadingHistory ? (
                <div className="mx-auto rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground">
                  Loading chat history...
                </div>
              ) : messages.length ? (
                <>
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      activeDraftId={activeDraftId}
                      isLatestExecutionStatus={
                        message.kind === "status" && message.execution
                          ? latestStatusMessageIdByExecution[message.execution.id] === message.id
                          : false
                      }
                      onConfirm={confirmDraft}
                      onCancel={cancelDraft}
                      onRelatedQuestion={submitRelatedQuestion}
                    />
                  ))}
                  {activeAiProvider ? (
                    <AiLoadingBubble
                      provider={activeAiProvider}
                      step={aiLoadingStep}
                      surfMode={activeAskSurfMode}
                      effort={activeAskSurfEffort}
                      elapsedMs={activeAskSurfElapsedMs}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <OnboardingGuide onSelect={selectCommand} />
                  {activeAiProvider ? (
                    <AiLoadingBubble
                      provider={activeAiProvider}
                      step={aiLoadingStep}
                      surfMode={activeAskSurfMode}
                      effort={activeAskSurfEffort}
                      elapsedMs={activeAskSurfElapsedMs}
                    />
                  ) : null}
                </>
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
            {suggestionChips.length ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {suggestionChips.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                    onClick={() => selectCommand(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            <ComposerModeControls
              chatMode={chatMode}
              surfMode={selectedSurfMode}
              surfEffort={selectedSurfEffort}
              aiModels={aiModels}
              selectedAiModel={selectedAiModel}
              isBusy={isInputBusy}
              onChatModeChange={setChatMode}
              onSurfModeChange={(mode) => {
                setSelectedSurfMode(mode);
                if (mode === "instant") setSelectedSurfEffort("standard");
              }}
              onSurfEffortChange={setSelectedSurfEffort}
              onAiModelChange={setSelectedAiModel}
            />

            <form
              className="flex items-center gap-2 rounded-2xl border bg-background p-2 shadow-sm"
              onSubmit={submitCommand}
            >
              <Button type="button" variant="ghost" size="icon" aria-label="Attach context">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(event) => handleInputChange(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={
                  activeAiProvider === "asksurf"
                    ? "AskSurf đang tìm thông tin crypto..."
                    : activeAiProvider === "openai"
                      ? "OpenAI đang phân tích lệnh..."
                      : "Message PayCMD or type /"
                }
                className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
                disabled={isInputBusy}
              />
              <Button type="submit" size="icon" aria-label="Send command" disabled={isInputBusy || !input.trim()}>
                {isInputBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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

function ComposerModeControls({
  chatMode,
  surfMode,
  surfEffort,
  aiModels,
  selectedAiModel,
  isBusy,
  onChatModeChange,
  onSurfModeChange,
  onSurfEffortChange,
  onAiModelChange,
}: {
  chatMode: ChatMode;
  surfMode: SurfMode;
  surfEffort: SurfEffort;
  aiModels: AiModelOption[];
  selectedAiModel: string;
  isBusy: boolean;
  onChatModeChange: (mode: ChatMode) => void;
  onSurfModeChange: (mode: SurfMode) => void;
  onSurfEffortChange: (effort: SurfEffort) => void;
  onAiModelChange: (model: string) => void;
}) {
  const models = aiModels.length ? aiModels : [{ id: "gpt-5.5", label: "GPT-5.5", description: "" }];

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="inline-flex rounded-xl border bg-background p-1">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onChatModeChange("paycmd")}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
            chatMode === "paycmd"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Bot className="h-3.5 w-3.5" />
          PayCMD
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onChatModeChange("asksurf")}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
            chatMode === "asksurf"
              ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-600"
              : "border border-emerald-400/45 bg-emerald-500/10 text-emerald-700 shadow-sm shadow-emerald-500/10 hover:bg-emerald-500/15 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
          }`}
        >
          <Waypoints className="h-3.5 w-3.5" />
          AskSurf
        </button>
      </div>

      {chatMode === "asksurf" ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border bg-background p-1">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onSurfModeChange("instant")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
                surfMode === "instant"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Instant
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onSurfModeChange("research")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
                surfMode === "research"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              Research 2.0
            </button>
          </div>
          <label className="flex h-10 items-center gap-1 rounded-xl border bg-background px-2 text-xs text-muted-foreground">
            Effort
            <select
              value={surfEffort}
              onChange={(event) => onSurfEffortChange(event.target.value as SurfEffort)}
              className="max-w-[112px] bg-transparent text-xs font-medium text-foreground outline-none disabled:text-muted-foreground"
              aria-label="AskSurf effort"
              disabled={isBusy || surfMode === "instant"}
            >
              {surfEffortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <label className="flex h-10 items-center gap-1 rounded-xl border bg-background px-2 text-xs text-muted-foreground">
          <Bot className="h-3.5 w-3.5 text-primary" />
          <select
            value={selectedAiModel}
            onChange={(event) => onAiModelChange(event.target.value)}
            className="max-w-[132px] bg-transparent text-xs font-medium text-foreground outline-none"
            aria-label="AI model"
            disabled={isBusy}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
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
  isLatestExecutionStatus,
  onConfirm,
  onCancel,
  onRelatedQuestion,
}: {
  message: ChatMessage;
  activeDraftId: string | null;
  isLatestExecutionStatus: boolean;
  onConfirm: (messageId: string, draft: ParsedCommand) => void;
  onCancel: (messageId: string) => void;
  onRelatedQuestion: (question: string) => void;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAskSurf = message.provider === "asksurf";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`${isAskSurf ? "max-w-[96%] md:max-w-[92%] lg:max-w-[88%]" : "max-w-[86%] md:max-w-[74%]"} rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : isAskSurf
              ? "rounded-bl-md border border-emerald-400/25 bg-[linear-gradient(135deg,hsl(var(--card))_0%,rgba(16,185,129,0.08)_48%,hsl(var(--card))_100%)]"
            : isSystem
              ? "rounded-bl-md border bg-accent text-accent-foreground"
              : "rounded-bl-md border bg-card"
        }`}
      >
        {!isUser && message.provider ? (
          <ProviderBadge
            provider={message.provider}
            model={message.model}
            surfMode={message.surfMode}
            effort={message.effort}
            durationMs={message.durationMs}
          />
        ) : null}
        {message.kind === "preview" && message.draft ? (
          <CommandPreviewCard
            draft={message.draft}
            state={
              message.draftState ??
              (activeDraftId === message.id ? "active" : "closed")
            }
            isActive={activeDraftId === message.id && message.draftState === "active"}
            onConfirm={(confirmedDraft) => onConfirm(message.id, confirmedDraft)}
            onCancel={() => onCancel(message.id)}
          />
        ) : message.kind === "status" && message.execution ? (
          <ExecutionStatus
            execution={message.execution}
            text={message.text}
            isLatest={isLatestExecutionStatus}
          />
        ) : (
          <div className="space-y-3">
            {message.provider === "asksurf" ? (
              <AskSurfResearchContent
                researchId={message.id}
                text={message.text}
                citations={message.citations ?? []}
                onRelatedQuestion={onRelatedQuestion}
              />
            ) : (
              <span className="block whitespace-pre-wrap">{message.text}</span>
            )}
            {message.actions?.length ? (
              <AssistantActionBar actions={message.actions} onAskSurf={onRelatedQuestion} />
            ) : null}
            {message.provider !== "asksurf" && message.citations?.length ? <CitationList citations={message.citations} /> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantActionBar({
  actions,
  onAskSurf,
}: {
  actions: AssistantAction[];
  onAskSurf: (question: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t pt-3">
      {actions.map((action) => (
        <Button
          key={`${action.kind}_${action.query}`}
          type="button"
          size="sm"
          className="border-emerald-400/50 bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-700"
          onClick={() => onAskSurf(action.query)}
        >
          <Waypoints className="h-3.5 w-3.5" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function ProviderBadge({
  provider,
  model,
  surfMode,
  effort,
  durationMs,
}: {
  provider: AiProvider;
  model?: string;
  surfMode?: SurfMode;
  effort?: SurfEffort;
  durationMs?: number;
}) {
  const Icon = provider === "asksurf" ? Waypoints : provider === "openai" ? Bot : Sparkles;
  const tone =
    provider === "asksurf"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : provider === "openai"
        ? "border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
        : "border-primary/25 bg-primary/10 text-primary";

  return (
    <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium ${tone}`}>
      <Icon className="h-3 w-3" />
      <span>{providerName(provider)}</span>
      {provider === "asksurf" ? (
        <span className="text-muted-foreground">· {surfModeLabel(surfMode)}{surfMode === "instant" ? "" : ` / ${surfEffortLabel(effort)}`}</span>
      ) : null}
      {model ? <span className="text-muted-foreground">· {model}</span> : null}
      {durationMs ? <span className="text-muted-foreground">· {formatDuration(durationMs)}</span> : null}
    </div>
  );
}

function CitationList({ citations }: { citations: ChatCitation[] }) {
  return (
    <div className="flex flex-wrap gap-2 border-t pt-2">
      {citations.slice(0, 4).map((citation, index) => {
        const label = citation.title || citation.url || `Source ${index + 1}`;
        if (!citation.url) {
          return (
            <span key={`${label}_${index}`} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
              {label}
            </span>
          );
        }

        return (
          <a
            key={`${citation.url}_${index}`}
            href={citation.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}

function AskSurfResearchContent({
  researchId,
  text,
  citations,
  onRelatedQuestion,
}: {
  researchId: string;
  text: string;
  citations: ChatCitation[];
  onRelatedQuestion: (question: string) => void;
}) {
  const { bodyText, relatedQuestions } = extractRelatedQuestions(text);
  const sections = extractResearchSections(bodyText, researchId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-emerald-400/15 pb-2 text-[11px] text-muted-foreground">
        <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-300">
          Crypto intelligence
        </span>
        <span>Surf sources/charts requested</span>
      </div>
      <ResearchEntityRail text={bodyText} citations={citations} />
      <div
        data-research-id={researchId}
        className={sections.length ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]" : ""}
      >
        <div className="min-w-0">
          <MarkdownContent researchId={researchId} text={bodyText} citations={citations} />
        </div>
        {sections.length ? <ResearchSectionNav researchId={researchId} sections={sections} /> : null}
      </div>
      {relatedQuestions.length ? (
        <RelatedQuestions questions={relatedQuestions} onSelect={onRelatedQuestion} />
      ) : null}
      {citations.length ? <AskSurfSourceList citations={citations} /> : null}
      <AskSurfResearchActions text={text} />
    </div>
  );
}

type ResearchSection = {
  id: string;
  title: string;
  level: number;
};

function stripMarkdownDecorations(value: string) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function slugifyHeading(value: string) {
  const slug = stripMarkdownDecorations(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}

function nextHeadingId(value: string, counts: Map<string, number>, scope?: string) {
  const base = slugifyHeading(value);
  const count = counts.get(base) ?? 0;
  counts.set(base, count + 1);
  const scopedBase = scope ? `${scope}-${base}` : base;
  return count ? `${scopedBase}-${count + 1}` : scopedBase;
}

function extractResearchSections(text: string, researchId: string) {
  const counts = new Map<string, number>();
  const sections: ResearchSection[] = [];

  text.replace(/\r\n/g, "\n").split("\n").forEach((line, index) => {
    const heading = parseResearchHeading(line, index);
    if (!heading || heading.level === 1) return;

    const title = stripMarkdownDecorations(heading.title);
    if (!title || /^related questions?$/i.test(title)) return;

    sections.push({
      id: nextHeadingId(heading.title, counts, researchId),
      title,
      level: heading.level,
    });
  });

  return sections.slice(0, 10);
}

function parseResearchHeading(line: string, index: number) {
  const trimmed = line.trim();
  const markdownHeading = trimmed.match(/^(#{1,4})\s+(.+)$/);
  if (markdownHeading) {
    return {
      level: markdownHeading[1].length,
      title: markdownHeading[2],
    };
  }

  const boldOnly = trimmed.match(/^\*\*([^*]{2,100})\*\*:?\s*$/);
  if (boldOnly) {
    return {
      level: index === 0 ? 1 : 2,
      title: boldOnly[1],
    };
  }

  return null;
}

function extractRelatedQuestions(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const headingIndex = lines.findIndex((line) => {
    const trimmed = stripMarkdownDecorations(line.replace(/^#{1,4}\s+/, "")).replace(/:$/, "");
    return /^related questions?$/i.test(trimmed);
  });

  if (headingIndex === -1) {
    return { bodyText: text, relatedQuestions: [] as string[] };
  }

  const relatedLines = lines.slice(headingIndex + 1);
  const relatedQuestions = relatedLines
    .map((line) =>
      line
        .replace(/^\s*[-*]\s+/, "")
        .replace(/^\s*\d+\.\s+/, "")
        .trim(),
    )
    .filter((line) => line.length > 4)
    .slice(0, 5);

  return {
    bodyText: lines.slice(0, headingIndex).join("\n").trim(),
    relatedQuestions,
  };
}

function ResearchSectionNav({ researchId, sections }: { researchId: string; sections: ResearchSection[] }) {
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    setActiveSectionId(sections[0]?.id ?? "");
  }, [researchId, sections]);

  useEffect(() => {
    const container = document.querySelector(`[data-research-id="${researchId}"]`);
    const scrollRoot = document.querySelector<HTMLElement>(".paycmd-chat-scrollbar");
    const elements = sections
      .map((section) => container?.querySelector<HTMLElement>(`#${CSS.escape(section.id)}`) ?? null)
      .filter((element): element is HTMLElement => Boolean(element));

    if (!elements.length) return;

    function updateActiveSection() {
      const rootTop = scrollRoot?.getBoundingClientRect().top ?? 0;
      const offset = rootTop + 72;
      let active = elements[0];

      for (const element of elements) {
        if (element.getBoundingClientRect().top <= offset) {
          active = element;
        } else {
          break;
        }
      }

      setActiveSectionId(active.id);
    }

    updateActiveSection();
    scrollRoot?.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      scrollRoot?.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [researchId, sections]);

  function jumpToSection(id: string) {
    const container = document.querySelector(`[data-research-id="${researchId}"]`);
    container?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const items = (
    <div className="space-y-1">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => jumpToSection(section.id)}
          className={`block w-full rounded-md border px-2 py-1.5 text-left text-xs transition hover:bg-emerald-500/10 hover:text-foreground ${
            activeSectionId === section.id
              ? `${section.level > 2 ? "pl-4" : ""} border-emerald-400/50 bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300`
              : section.level > 2
                ? "border-transparent pl-4 text-muted-foreground"
                : "border-transparent font-medium text-foreground/80"
          }`}
        >
          {section.title}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <details className="order-first rounded-xl border bg-background/70 p-3 md:hidden">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Sections of Research
        </summary>
        <div className="mt-2">{items}</div>
      </details>
      <nav className="hidden self-start rounded-xl border bg-background/70 p-3 md:sticky md:top-3 md:block">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
          Sections of Research
        </div>
        {items}
      </nav>
    </>
  );
}

function RelatedQuestions({
  questions,
  onSelect,
}: {
  questions: string[];
  onSelect: (question: string) => void;
}) {
  return (
    <div className="space-y-2 border-t border-emerald-400/15 pt-3">
      <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Related Questions</div>
      <div className="flex flex-wrap gap-2">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onSelect(question)}
            className="rounded-full border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-emerald-400/50 hover:bg-emerald-500/10"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}

function AskSurfResearchActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);

  async function copyAnswer() {
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function printAnswer() {
    const popup = window.open("", "_blank");
    if (!popup) {
      window.print();
      return;
    }

    popup.document.write(
      `<html><head><title>AskSurf Research</title><style>body{font-family:system-ui,sans-serif;line-height:1.5;padding:32px;white-space:pre-wrap;color:#111}</style></head><body>${escapeHtml(text)}</body></html>`,
    );
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-400/15 pt-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copyAnswer}>
          <Clipboard className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadTextFile("asksurf-research.md", text, "text/markdown;charset=utf-8")}
        >
          <Download className="h-3.5 w-3.5" />
          Markdown
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={printAnswer}>
          <Printer className="h-3.5 w-3.5" />
          PDF/Print
        </Button>
      </div>
      <div className="flex gap-1">
        <Button
          type="button"
          variant={feedback === "like" ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          aria-label="Like AskSurf answer"
          onClick={() => setFeedback(feedback === "like" ? null : "like")}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={feedback === "dislike" ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          aria-label="Dislike AskSurf answer"
          onClick={() => setFeedback(feedback === "dislike" ? null : "dislike")}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function AskSurfSourceList({ citations }: { citations: ChatCitation[] }) {
  return (
    <div className="space-y-2 border-t border-emerald-400/15 pt-3">
      <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Sources</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {citations.slice(0, 6).map((citation, index) => {
          const label = citation.title || citation.url || `Source ${index + 1}`;
          if (!citation.url) {
            return (
              <span
                key={`${label}_${index}`}
                className="truncate rounded-md border bg-background/70 px-3 py-2 text-xs text-muted-foreground"
              >
                {label}
              </span>
            );
          }

          return (
            <a
              key={`${citation.url}_${index}`}
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="truncate rounded-md border bg-background/70 px-3 py-2 text-xs text-muted-foreground transition hover:border-emerald-400/40 hover:text-foreground"
            >
              {label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function MarkdownContent({
  researchId,
  text,
  citations = [],
}: {
  researchId: string;
  text: string;
  citations?: ChatCitation[];
}) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  const headingCounts = new Map<string, number>();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const image = line.trim().match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/);
    if (image) {
      blocks.push(
        <figure key={`image_${index}`} className="overflow-hidden rounded-xl border bg-background/70">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image[2]} alt={image[1]} className="max-h-80 w-full object-contain" loading="lazy" />
          {image[1] ? (
            <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">{image[1]}</figcaption>
          ) : null}
        </figure>,
      );
      index += 1;
      continue;
    }

    const heading = parseResearchHeading(line, index);
    if (heading) {
      const level = heading.level;
      const content = renderInlineMarkdown(stripMarkdownDecorations(heading.title), `heading_${index}`, text, citations);
      const id = nextHeadingId(heading.title, headingCounts, researchId);
      const className =
        level === 1
          ? "scroll-mt-6 text-xl font-semibold tracking-normal"
          : level === 2
            ? "scroll-mt-6 text-lg font-semibold tracking-normal"
            : "scroll-mt-6 text-base font-semibold tracking-normal";

      blocks.push(
        <div key={`heading_${index}`} id={id} className={className}>
          {content}
        </div>,
      );
      index += 1;
      continue;
    }

    if (/^\s*>\s+/.test(line)) {
      const start = index;
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s+/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s+/, ""));
        index += 1;
      }

      blocks.push(
        <blockquote key={`quote_${start}`} className="border-l-2 border-emerald-400/50 pl-3 text-muted-foreground">
          {renderInlineMarkdown(quoteLines.join(" "), `quote_${start}`, text, citations)}
        </blockquote>,
      );
      continue;
    }

    if (line.trim().startsWith("```")) {
      const start = index;
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;

      blocks.push(
        <pre key={`code_${start}`} className="overflow-x-auto rounded-xl border bg-background p-3 text-xs leading-5">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const start = index;
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        tableLines.push(lines[index]);
        index += 1;
      }

      blocks.push(<MarkdownTable key={`table_${start}`} lines={tableLines} sourceText={text} citations={citations} />);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const start = index;
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul key={`ul_${start}`} className="list-disc space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`${start}_${itemIndex}`}>{renderInlineMarkdown(item, `${start}_${itemIndex}`, text, citations)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const start = index;
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol key={`ol_${start}`} className="list-decimal space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`${start}_${itemIndex}`}>{renderInlineMarkdown(item, `${start}_${itemIndex}`, text, citations)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const start = index;
    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !parseResearchHeading(lines[index], index) &&
      !lines[index].trim().match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/) &&
      !/^\s*>\s+/.test(lines[index]) &&
      !lines[index].trim().startsWith("```") &&
      !isMarkdownTableStart(lines, index) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(
      <p key={`p_${start}`} className="leading-7 text-foreground/92">
        {renderInlineMarkdown(paragraphLines.join(" "), `p_${start}`, text, citations)}
      </p>,
    );
  }

  return <div className="space-y-4">{blocks}</div>;
}

function isMarkdownTableStart(lines: string[], index: number) {
  return (
    index + 1 < lines.length &&
    lines[index].includes("|") &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
  );
}

function splitMarkdownRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function MarkdownTable({
  lines,
  sourceText,
  citations,
}: {
  lines: string[];
  sourceText: string;
  citations: ChatCitation[];
}) {
  const headers = splitMarkdownRow(lines[0] ?? "");
  const body = lines.slice(2).map(splitMarkdownRow);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  async function copyTable() {
    await navigator.clipboard?.writeText(tableToPlainText(headers, body));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const table = (
    <table className="min-w-full border-collapse text-left text-xs">
      <thead className="bg-muted/60 text-muted-foreground">
        <tr>
          {headers.map((header, index) => (
            <th key={`${header}_${index}`} className="border-b px-3 py-2 font-medium">
              {renderInlineMarkdown(header, `th_${index}`, sourceText, citations)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, rowIndex) => (
          <tr key={`row_${rowIndex}`} className="odd:bg-background/60">
            {headers.map((_, cellIndex) => (
              <td key={`cell_${rowIndex}_${cellIndex}`} className="border-b px-3 py-2 align-top last:border-b-0">
                {renderInlineMarkdown(row[cellIndex] ?? "", `td_${rowIndex}_${cellIndex}`, sourceText, citations)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="overflow-hidden rounded-xl border bg-background/70">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-2 py-1.5">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Table2 className="h-3.5 w-3.5" />
          Table
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Copy table" onClick={copyTable}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Download table CSV"
            onClick={() => downloadTextFile("asksurf-table.csv", tableToCsv(headers, body), "text/csv;charset=utf-8")}
          >
            <FileDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Download table PNG"
            onClick={() => downloadTablePng(headers, body)}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Open table fullscreen"
            onClick={() => setIsFullscreen(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">{table}</div>
      {isFullscreen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/96 p-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-medium">
              <Table2 className="h-4 w-4 text-emerald-600" />
              AskSurf table
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Close table fullscreen" onClick={() => setIsFullscreen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card text-sm">{table}</div>
        </div>
      ) : null}
    </div>
  );
}

function tableToPlainText(headers: string[], body: string[][]) {
  return [headers, ...body].map((row) => row.join("\t")).join("\n");
}

function csvEscape(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function tableToCsv(headers: string[], body: string[][]) {
  return [headers, ...body].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadTablePng(headers: string[], body: string[][]) {
  const rows = [headers, ...body];
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;

  context.font = "14px system-ui, sans-serif";
  const columnWidths = headers.map((_, columnIndex) => {
    const measured = rows.reduce((max, row) => Math.max(max, context.measureText(row[columnIndex] ?? "").width), 80);
    return Math.min(320, Math.max(140, measured + 32));
  });
  const rowHeight = 42;
  const width = columnWidths.reduce((sum, item) => sum + item, 0);
  const height = rows.length * rowHeight;

  canvas.width = Math.max(320, Math.ceil(width));
  canvas.height = Math.max(rowHeight, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = "14px system-ui, sans-serif";

  let y = 0;
  rows.forEach((row, rowIndex) => {
    let x = 0;
    context.fillStyle = rowIndex === 0 ? "#f3f4f6" : rowIndex % 2 ? "#ffffff" : "#fbfbfb";
    context.fillRect(0, y, canvas.width, rowHeight);
    context.strokeStyle = "#d1d5db";
    context.beginPath();
    context.moveTo(0, y + rowHeight);
    context.lineTo(canvas.width, y + rowHeight);
    context.stroke();

    row.forEach((cell, columnIndex) => {
      context.fillStyle = rowIndex === 0 ? "#374151" : "#111827";
      context.font = `${rowIndex === 0 ? "600 " : ""}14px system-ui, sans-serif`;
      context.fillText(String(cell ?? "").slice(0, 80), x + 12, y + 26, columnWidths[columnIndex] - 24);
      x += columnWidths[columnIndex];
    });

    y += rowHeight;
  });

  const link = document.createElement("a");
  link.download = "asksurf-table.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMarkdown(
  value: string,
  keyPrefix: string,
  sourceText = value,
  citations: ChatCitation[] = [],
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(value))) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}_${index}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.92em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        nodes.push(
          <EntityPreviewTrigger
            key={key}
            label={link[1]}
            sourceText={sourceText}
            citations={citations}
            sourceUrl={link[2]}
          />,
        );
      }
    }

    lastIndex = pattern.lastIndex;
    index += 1;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes;
}

type ResearchEntity = {
  label: string;
  sourceUrl?: string;
  sourceTitle?: string;
};

function extractMarkdownLinks(text: string) {
  const links: ResearchEntity[] = [];
  const pattern = /(?<!!)\[([^\]]{2,80})\]\((https?:\/\/[^)\s]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    links.push({
      label: stripMarkdownDecorations(match[1]),
      sourceUrl: match[2],
      sourceTitle: stripMarkdownDecorations(match[1]),
    });
  }

  return links;
}

function extractResearchEntities(text: string, citations: ChatCitation[]) {
  const seen = new Set<string>();
  const entities: ResearchEntity[] = [];

  for (const entity of extractMarkdownLinks(text)) {
    const key = `${entity.label.toLowerCase()}|${entity.sourceUrl ?? ""}`;
    if (!entity.label || seen.has(key)) continue;
    seen.add(key);
    entities.push(entity);
  }

  for (const citation of citations) {
    const label = citation.title?.trim();
    const key = `${label?.toLowerCase() ?? ""}|${citation.url ?? ""}`;
    if (!label || !citation.url || seen.has(key)) continue;
    seen.add(key);
    entities.push({ label, sourceUrl: citation.url, sourceTitle: citation.title });
  }

  return entities.slice(0, 8);
}

function extractEntityContext(sourceText: string, label: string) {
  const lowerText = sourceText.toLowerCase();
  const lowerLabel = label.toLowerCase();
  const index = lowerText.indexOf(lowerLabel);

  if (index === -1) return "";

  const startCandidates = [
    sourceText.lastIndexOf(".", index - 1),
    sourceText.lastIndexOf("?", index - 1),
    sourceText.lastIndexOf("!", index - 1),
    sourceText.lastIndexOf("\n", index - 1),
  ];
  const endCandidates = [
    sourceText.indexOf(".", index + label.length),
    sourceText.indexOf("?", index + label.length),
    sourceText.indexOf("!", index + label.length),
    sourceText.indexOf("\n", index + label.length),
  ].filter((candidate) => candidate !== -1);

  const start = Math.max(0, Math.max(...startCandidates) + 1);
  const end = endCandidates.length ? Math.min(...endCandidates) + 1 : Math.min(sourceText.length, index + 220);
  return sourceText.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 260);
}

function extractEntityTableRows(sourceText: string, label: string) {
  const lowerLabel = label.toLowerCase().replace(/^\$/, "");
  return sourceText
    .split("\n")
    .filter((line) => line.includes("|") && line.toLowerCase().includes(lowerLabel))
    .map((line) => splitMarkdownRow(line).join(" · "))
    .slice(0, 2);
}

function relatedEntityCitations(label: string, citations: ChatCitation[], sourceUrl?: string, sourceTitle?: string) {
  const query = label.toLowerCase().replace(/^\$/, "");
  const directSource = sourceUrl ? [{ title: sourceTitle || label, url: sourceUrl }] : [];
  const citationMatches = citations
    .filter((citation) => `${citation.title ?? ""} ${citation.url ?? ""}`.toLowerCase().includes(query))
    .slice(0, 2);
  const seen = new Set<string>();

  return [...directSource, ...citationMatches].filter((citation) => {
    const key = citation.url || citation.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function EntityPreviewTrigger({
  label,
  sourceText,
  citations,
  sourceUrl,
  sourceTitle,
}: {
  label: string;
  sourceText: string;
  citations: ChatCitation[];
  sourceUrl?: string;
  sourceTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const context = extractEntityContext(sourceText, label);
  const tableRows = extractEntityTableRows(sourceText, label);
  const sourceMatches = relatedEntityCitations(label, citations, sourceUrl, sourceTitle);

  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded bg-emerald-500/10 px-1 font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
      >
        {label}
      </button>
      {open ? (
        <span className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border bg-card p-3 text-left text-xs leading-5 text-foreground shadow-xl">
          <span className="mb-1 flex items-center gap-2 font-semibold">
            <Search className="h-3.5 w-3.5 text-emerald-600" />
            {label}
          </span>
          <span className="mb-2 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            Research-backed
          </span>
          <span className="block text-muted-foreground">
            {context || "Linked from this AskSurf answer. No live price or chart was returned for this entity."}
          </span>
          {tableRows.length ? (
            <span className="mt-2 block space-y-1 border-t pt-2">
              {tableRows.map((row) => (
                <span key={row} className="block rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                  {row}
                </span>
              ))}
            </span>
          ) : null}
          {sourceMatches.length ? (
            <span className="mt-2 block space-y-1 border-t pt-2">
              {sourceMatches.map((citation, index) =>
                citation.url ? (
                  <a
                    key={citation.url}
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[11px] text-primary hover:underline"
                  >
                    {citation.title || `Source ${index + 1}`}
                  </a>
                ) : null,
              )}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function ResearchEntityRail({ text, citations }: { text: string; citations: ChatCitation[] }) {
  const entities = extractResearchEntities(text, citations);
  if (!entities.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entities.map((entity) => (
        <EntityPreviewTrigger
          key={`${entity.label}_${entity.sourceUrl ?? ""}`}
          label={entity.label}
          sourceText={text}
          citations={citations}
          sourceUrl={entity.sourceUrl}
          sourceTitle={entity.sourceTitle}
        />
      ))}
    </div>
  );
}

function AiLoadingBubble({
  provider,
  step,
  surfMode,
  effort,
  elapsedMs,
}: {
  provider: AiProvider;
  step: number;
  surfMode?: SurfMode;
  effort?: SurfEffort;
  elapsedMs?: number;
}) {
  const copy = aiLoadingCopy[provider];
  const text = copy[step % copy.length];
  const elapsed = elapsedMs ? formatDuration(elapsedMs) : "";

  return (
    <div className="flex justify-start">
      <div className="max-w-[86%] rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-sm leading-6 shadow-sm md:max-w-[74%]">
        <ProviderBadge provider={provider} surfMode={surfMode} effort={effort} />
        {provider === "asksurf" ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-300">
              {surfModeLabel(surfMode)}
            </span>
            {surfMode !== "instant" ? <span>{surfEffortLabel(effort)} effort</span> : null}
            {elapsed ? <span>Elapsed {elapsed}</span> : null}
          </div>
        ) : null}
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>{text}</span>
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:160ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:320ms]" />
          </span>
        </div>
      </div>
    </div>
  );
}

function SlowAskSurfNotice({
  mode,
  effort,
  elapsedMs,
  onDismiss,
}: {
  mode: SurfMode;
  effort: SurfEffort;
  elapsedMs?: number;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-24 z-20 flex justify-center md:bottom-28">
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-400/30 bg-card/95 px-4 py-3 text-sm shadow-xl shadow-emerald-950/10 backdrop-blur dark:shadow-black/30">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border bg-background">
          <Image src="/brand/paycmd-login-mascot.svg" alt="" fill className="object-cover p-1" />
        </div>
        <div className="min-w-0">
          <div className="font-medium">AskSurf đang đọc hơi sâu</div>
          <div className="text-xs leading-5 text-muted-foreground">
            {surfModeLabel(mode)}{mode === "instant" ? "" : ` / ${surfEffortLabel(effort)}`} đang chạy
            {elapsedMs ? ` ${formatDuration(elapsedMs)}` : ""}. Bạn có thể đóng thông báo này.
          </div>
        </div>
        <div className="flex shrink-0 gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:180ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:360ms]" />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 h-8 w-8 shrink-0"
          onClick={onDismiss}
          aria-label="Ẩn thông báo AskSurf"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function OnboardingGuide({ onSelect }: { onSelect: (sample: string) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center">
        <div className="relative mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-2xl border bg-background md:mx-0">
          <Image src="/brand/paycmd-login-mascot.svg" alt="PayCMD mascot" fill className="object-cover p-2" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            First run guide
          </div>
          <h2 className="text-xl font-semibold tracking-normal">Bắt đầu với PayCMD chat</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Gõ lệnh trực tiếp bằng dấu / hoặc nói tự nhiên. PayCMD sẽ preview trước khi có giao dịch thật.
          </p>
        </div>
      </div>
      <div className="grid gap-2 border-t bg-background/45 p-3 md:grid-cols-2">
        {onboardingCommands.map((item) => (
          <button
            key={item.sample}
            type="button"
            className="group rounded-xl border bg-card p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-sm"
            onClick={() => onSelect(item.sample)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium">{item.title}</div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <div className="mt-1 font-mono text-xs text-primary">{item.sample}</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CommandPreviewCard({
  draft,
  state,
  isActive,
  onConfirm,
  onCancel,
}: {
  draft: ParsedCommand;
  state: PreviewDisplayState;
  isActive: boolean;
  onConfirm: (draft: ParsedCommand) => void;
  onCancel: () => void;
}) {
  const statusLabel =
    state === "cancelled"
      ? "Cancelled"
      : state === "confirmed"
        ? "Confirmed"
        : state === "closed"
          ? "Closed"
          : "Ready";
  const previewRail = inferRailFromCommand(draft.command);
  const previewSourceChain = draft.fields.sourceChain || draft.fields.chain;
  const previewDestinationChain = draft.fields.destinationChain;
  const hasMintGasChoice = draft.command === "transfer" || draft.command === "pay";
  const [selectedMintGasMode, setSelectedMintGasMode] = useState(
    draft.fields.mintGasMode === "manual" ? "manual" : "auto_forwarding",
  );
  const mintGasModeText =
    selectedMintGasMode === "manual"
      ? " · Mint gas: Manual; cần SCA/signer có native gas ở chain đích"
      : " · Mint gas: Auto, pay in USDC; không cần gas ở chain đích";
  const mintGasHelpText =
    hasMintGasChoice
      ? selectedMintGasMode === "manual"
        ? "Manual: phí USDC thấp hơn, nhưng ví thực thi mint cần native gas ở chain đích."
        : "Auto forwarding: phí USDC cao hơn vì gồm forwarding fee. Circle/forwarder mint hộ ở chain đích."
      : "";
  const confirmedDraft: ParsedCommand = {
    ...draft,
    fields: hasMintGasChoice
      ? {
          ...draft.fields,
          mintGasMode: selectedMintGasMode,
        }
      : draft.fields,
  };

  return (
    <div className="min-w-[260px] space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase text-muted-foreground">Preview</div>
          <div className="font-semibold">{draft.summary}</div>
        </div>
        {isActive ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 h-8 w-8 shrink-0"
            onClick={onCancel}
            aria-label="Cancel command preview"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            {statusLabel}
          </Badge>
        )}
      </div>
      <div className="grid gap-2 text-xs">
        <Row label="Command" value={`/${draft.command}`} />
        {Object.entries(draft.fields).map(([key, value]) =>
          value && key !== "mintGasMode" ? <Row key={key} label={key} value={value} /> : null,
        )}
      </div>
      <div className="space-y-2 rounded-lg border bg-background p-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <RailBadge rail={previewRail} />
          {previewSourceChain ? (
            <ChainRoute
              sourceChain={previewSourceChain}
              destinationChain={previewDestinationChain}
              compact
            />
          ) : null}
        </div>
        <div>
          Mode: real
          {draft.command === "transfer" ? " · Auto-deposit nếu Gateway balance thiếu" : ""}
          {hasMintGasChoice ? mintGasModeText : ""}
          {draft.command === "withdraw" ? " · Rút Gateway balance về Circle SCA wallet cùng chain" : ""}
          {draft.command === "fund" ? " · Giữ chat mở để ký MetaMask" : ""}
        </div>
        {hasMintGasChoice ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={!isActive}
              onClick={() => setSelectedMintGasMode("auto_forwarding")}
              className={`rounded-md border px-3 py-2 text-left transition ${
                selectedMintGasMode === "auto_forwarding"
                  ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-300"
                  : "bg-card hover:border-primary/60"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="block font-medium text-foreground">Auto forwarding</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                Trả thêm USDC fee. Không cần gas ở chain đích.
              </span>
            </button>
            <button
              type="button"
              disabled={!isActive}
              onClick={() => setSelectedMintGasMode("manual")}
              className={`rounded-md border px-3 py-2 text-left transition ${
                selectedMintGasMode === "manual"
                  ? "border-amber-500/70 bg-amber-500/10 text-amber-300"
                  : "bg-card hover:border-primary/60"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="block font-medium text-foreground">Manual gas</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                Phí USDC thấp hơn. SCA/signer cần native gas ở chain đích.
              </span>
            </button>
          </div>
        ) : null}
        {mintGasHelpText ? <div>{mintGasHelpText}</div> : null}
      </div>
      <Button className="w-full" disabled={!isActive} onClick={() => onConfirm(confirmedDraft)}>
        <Check className="mr-2 h-4 w-4" />
        {isActive ? "Confirm command" : statusLabel}
      </Button>
    </div>
  );
}

function ExecutionStatus({
  execution,
  text,
  isLatest,
}: {
  execution: ExecutionItem;
  text: string;
  isLatest: boolean;
}) {
  const done = execution.status === "success";
  const failed = execution.status === "failed";
  const active = isLatest && !done && !failed;
  const sourceChain = executionSourceChain(execution);
  const destinationChain = executionDestinationChain(execution);
  const txLinks = executionTxLinks(execution);
  const rail = inferRailFromCommand(execution.command);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-medium">
        {done ? (
          <Check className="h-4 w-4 text-primary" />
        ) : failed ? (
          <Clock3 className="h-4 w-4 text-destructive" />
        ) : active ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Check className="h-4 w-4 text-muted-foreground" />
        )}
        {statusLabel(execution.status)}
      </div>
      <div className="whitespace-pre-wrap leading-7">{text}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <RailBadge rail={rail} />
        {sourceChain ? (
          <ChainRoute sourceChain={sourceChain} destinationChain={destinationChain} compact />
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {execution.gateway.network}
          </span>
        )}
      </div>
      {txLinks.length ? (
        <div className="space-y-1 rounded-lg bg-background p-2 text-xs text-muted-foreground">
          {txLinks.map((link) => (
            <div key={`${link.label}-${link.txHash}`} className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
              <span>{link.label}</span>
              <ExplorerTxLink chain={link.chain} txHash={link.txHash} compact />
            </div>
          ))}
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
