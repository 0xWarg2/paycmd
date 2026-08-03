"use client";

import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { BridgeKit } from "@circle-fin/bridge-kit";
import {
  BadgeDollarSign,
  Bot,
  Brain,
  Check,
  Clipboard,
  Copy,
  ChevronRight,
  Clock3,
  Info,
  ArrowRightLeft,
  Download,
  FileDown,
  Link2,
  History,
  Loader2,
  Maximize2,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Table2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  WalletCards,
  Waypoints,
  Zap,
  X,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, KeyboardEvent, ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { decodeFunctionResult, encodeFunctionData, erc20Abi, formatUnits, parseUnits } from "viem";

import {
  ChainRoute,
  ExplorerTxLink,
  RailBadge,
  inferRailFromCommand,
  getChainMeta,
} from "@/components/chain-identity";
import { PayCmdShell } from "@/components/paycmd-shell";
import {
  balanceBreakdown,
  balanceBreakdownText,
  bridgeErrorWithFaucet,
  isForegroundOnlyCommand,
  partialBalanceSuffix,
  usePayCmdRuntime,
} from "@/components/paycmd-runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { localeRequestHeaders, translateClient, useI18n } from "@/lib/i18n";
import {
  cctpBridgeChainMap,
  bridgeModeFrom,
  bridgeSpeedFrom,
  CIRCLE_TESTNET_FAUCET_URL,
  getSupportedCctpBridgeChains,
  normalizeCctpBridgeChain,
  type CctpBridgeChainKey,
  type CctpBridgeRuntimeChain,
  type CctpBridgeMintMode,
  type CctpBridgeTransferSpeed,
} from "@/lib/paycmd/cctp-bridge";
import {
  parsePayCmd,
  ParsedCommand,
  requiresConfirmation,
} from "@/lib/paycmd/commands";
import { chainCommandAlias, isSupportedChain } from "@/lib/paycmd/chains";
import { web3Chains } from "@/lib/paycmd/web3-chains";
import {
  getSwapAdapterAddress,
  paynaSwapAdapterAbi,
  paynaSwapTokens,
  PAYNA_SWAP_CHAIN,
  PAYNA_SWAP_SLIPPAGE_BPS,
  type PaynaSwapTokenSymbol,
} from "@/lib/paycmd/swap";

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

// These are legacy wire values, not display names. They are persisted in `chat_messages.metadata`
// and read back through the hard allowlist in `normalizeAiProvider`, so every row already in the
// database says "asksurf" — renaming the value would drop that history out of the rich research
// renderer and show it as raw markdown. Rename what the user sees, not these.
type AiProvider = "openai" | "asksurf" | "paycmd";
type ChatMode = "paycmd" | "asksurf";
type SurfMode = "instant" | "research";
// Two tiers, matching the two models available. `extended` and `maximum` were the pre-merge values;
// `normalizeSurfEffort` folds them into `deep` when reading persisted rows.
type SurfEffort = "standard" | "deep";

type ChatCitation = {
  title?: string;
  url?: string;
};

type AssistantAction =
  | {
      kind: "switch_to_asksurf";
      label: string;
      query: string;
      surfMode?: SurfMode;
      effort?: SurfEffort;
    }
  | {
      // Offered only when the command failed without moving funds, so re-running it
      // is safe. Never attached after a bridge burn — that would burn a second time.
      kind: "retry_command";
      label: string;
      draft: ParsedCommand;
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
  // Chain-of-thought from the model, when it ran with thinking on. Capped to 4000 chars by the
  // transport before it ever reaches here.
  reasoning?: string;
  quota?: AiQuota;
};

type AiQuota = {
  enabled: boolean;
  unlimited: boolean;
  limit: 10 | null;
  used: number | null;
  remaining: number | null;
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
  // Which chain the user asked about, when they named one. The balance route always reads all 12
  // chains, so this is the only record of "/balance on base" being narrower than "/balance" — the
  // renderer cannot recover it from the response.
  chainFilter?: string;
};

type AiCommandResult = {
  intent: "command" | "answer" | "clarify" | "crypto_research";
  canonicalCommand: string;
  assistantText: string;
  missingFields: string[];
  suggestions: string[];
  parsedCommand: ParsedCommand | null;
  modelProfile?: string;
  // Always absent in practice: the router runs with thinking off so its token budget goes entirely
  // to the JSON it has to return. Typed anyway because the route does forward it if enabled.
  reasoning?: string;
  quota?: AiQuota;
};

type CryptoResearchResult = {
  assistantText: string;
  citations?: ChatCitation[];
  provider: "asksurf";
  model?: string;
  surfMode?: SurfMode;
  effort?: SurfEffort;
  durationMs?: number;
  reasoning?: string;
  quota?: AiQuota;
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

type ChatThreadSummary = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  last_message_role?: string | null;
  last_message_kind?: string | null;
  message_count?: number | null;
};

const MESSAGE_PAGE_SIZE = 10;
const THREAD_LIST_PAGE_SIZE = 30;
// Kept tight: at 160px a user who scrolled up a short way still counted as "at the bottom",
// so the next message yanked them back down mid-read.
const AUTO_SCROLL_BOTTOM_THRESHOLD = 56;
const METAMASK_CONFIRMATION_TIMEOUT_MS = 90_000;
const METAMASK_CHAIN_TIMEOUT_MS = 60_000;
const METAMASK_RPC_TIMEOUT_MS = 15_000;
const aiLoadingKeys: Record<AiProvider, string[]> = {
  openai: ["chat.loading.openai.0", "chat.loading.openai.1", "chat.loading.openai.2"],
  asksurf: ["chat.loading.asksurf.0", "chat.loading.asksurf.1", "chat.loading.asksurf.2"],
  paycmd: ["chat.loading.paycmd.0"],
};

const surfEffortOptions: { id: SurfEffort; label: string; description: string }[] = [
  { id: "standard", label: "Standard", description: "deepseek-v4-flash, reasoning on" },
  { id: "deep", label: "Deep", description: "deepseek-v4-pro, reasoning on" },
];

function surfModeLabel(mode?: SurfMode) {
  return mode === "instant" ? "Instant" : "Research";
}

// Folds the pre-merge tiers into the two that remain. Without this, a stored `extended`/`maximum`
// would miss the lookup below and fall through to "Standard" — mislabelling a heavier answer as the
// cheapest tier, with nothing to indicate anything went wrong.
function normalizeSurfEffort(value: unknown): SurfEffort {
  return value === "deep" || value === "extended" || value === "maximum" ? "deep" : "standard";
}

function surfEffortLabel(effort?: SurfEffort) {
  return surfEffortOptions.find((option) => option.id === effort)?.label ?? "Standard";
}

// Deliberately longer than the server's own timeout for the same mode (60s instant, 240s research),
// so the server gives up first and the user sees its real error instead of a client-side abort. Both
// stay under the route's 300s platform ceiling.
function surfClientTimeoutMs(mode: SurfMode) {
  return mode === "instant" ? 120_000 : 270_000;
}

function formatDuration(ms?: number) {
  if (!ms || ms < 0) return "";
  const seconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${String(remainder).padStart(2, "0")}s` : `${seconds}s`;
}

function threadSortTime(thread: ChatThreadSummary) {
  return new Date(thread.last_message_at ?? thread.updated_at ?? thread.created_at).getTime();
}

function isGenericThreadTitle(title?: string | null) {
  return !title || /^(payna chat|payna main thread|new chat)$/i.test(title.trim());
}

function inferThreadTitle(input: string) {
  const clean = input
    .replace(/^\/+/, "")
    .replace(/0x[a-fA-F0-9]{40}/g, "0x...")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "New chat";

  const title = clean.length > 58 ? `${clean.slice(0, 55).trim()}...` : clean;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function formatThreadTimestamp(value: string | null | undefined, locale: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isNearViewportBottom(viewport: HTMLDivElement) {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < AUTO_SCROLL_BOTTOM_THRESHOLD;
}

function normalizeAiProvider(value: unknown): AiProvider | undefined {
  return value === "openai" || value === "asksurf" || value === "paycmd" ? value : undefined;
}

function normalizeAiQuota(value: unknown): AiQuota | undefined {
  if (!value || typeof value !== "object") return undefined;
  const quota = value as Record<string, unknown>;
  if (typeof quota.enabled !== "boolean" || typeof quota.unlimited !== "boolean") return undefined;
  const numberOrNull = (entry: unknown) => (typeof entry === "number" || entry === null ? entry : null);
  return {
    enabled: quota.enabled,
    unlimited: quota.unlimited,
    limit: numberOrNull(quota.limit) === 10 ? 10 : null,
    used: numberOrNull(quota.used),
    remaining: numberOrNull(quota.remaining),
  };
}

function normalizeAssistantActions(value: unknown): AssistantAction[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const actions: AssistantAction[] = value
    .map((item) => recordFrom(item))
    .flatMap((item): AssistantAction[] => {
      if (item.kind === "retry_command" && item.draft && typeof item.draft === "object") {
        return [
          {
            kind: "retry_command" as const,
            label:
              typeof item.label === "string" && item.label.trim()
                ? item.label.trim()
                : translateClient("action.retryCommand"),
            draft: item.draft as ParsedCommand,
          },
        ];
      }

      if (item.kind !== "switch_to_asksurf" || typeof item.query !== "string" || !item.query.trim()) {
        return [];
      }

      return [
        {
          kind: "switch_to_asksurf" as const,
          label:
            typeof item.label === "string" && item.label.trim()
              ? item.label.trim()
              : translateClient("asksurf.askButton"),
          query: item.query.trim(),
          surfMode: item.surfMode === "instant" || item.surfMode === "research" ? item.surfMode : "research",
          effort: normalizeSurfEffort(item.effort),
        },
      ];
    });

  return actions.length ? actions : undefined;
}

// Maps the legacy wire values above to what the user actually sees.
function providerName(provider?: AiProvider) {
  if (provider === "openai") return "DeepSeek Router";
  if (provider === "asksurf") return "AskPayna · DeepSeek";
  if (provider === "paycmd") return "Payna";
  return "";
}

const commandTemplates = [
  {
    groupKey: "commandPalette.group.wallet",
    items: [
      {
        sample: "/link metamask",
        titleKey: "commandPalette.linkMetamask.title",
        descriptionKey: "commandPalette.linkMetamask.description",
        badge: "write",
        icon: Link2,
      },
      {
        sample: "/fund 50 from metamask on base",
        titleKey: "commandPalette.fundWallet.title",
        descriptionKey: "commandPalette.fundWallet.description",
        badge: "confirm",
        icon: Wallet,
      },
      {
        sample: "/wallet create",
        titleKey: "commandPalette.walletCreate.title",
        descriptionKey: "commandPalette.walletCreate.description",
        badge: "write",
        icon: Wallet,
      },
      {
        sample: "/wallet status",
        titleKey: "commandPalette.walletStatus.title",
        descriptionKey: "commandPalette.walletStatus.description",
        badge: "read",
        icon: WalletCards,
      },
      {
        sample: "/wallet balance",
        titleKey: "commandPalette.walletBalance.title",
        descriptionKey: "commandPalette.walletBalance.description",
        badge: "read",
        icon: WalletCards,
      },
    ],
  },
  {
    groupKey: "commandPalette.group.balance",
    items: [
      {
        sample: "/balance",
        titleKey: "commandPalette.balance.title",
        descriptionKey: "commandPalette.balance.description",
        badge: "read",
        icon: BadgeDollarSign,
      },
      {
        sample: "/balance arc",
        titleKey: "commandPalette.balanceArc.title",
        descriptionKey: "commandPalette.balanceArc.description",
        badge: "read",
        icon: BadgeDollarSign,
      },
      {
        sample: "/balance base",
        titleKey: "commandPalette.balanceBase.title",
        descriptionKey: "commandPalette.balanceBase.description",
        badge: "read",
        icon: BadgeDollarSign,
      },
      {
        sample: "/balance avalanche",
        titleKey: "commandPalette.balanceAvalanche.title",
        descriptionKey: "commandPalette.balanceAvalanche.description",
        badge: "read",
        icon: BadgeDollarSign,
      },
      {
        sample: "/gateway balance",
        titleKey: "commandPalette.gatewayBalance.title",
        descriptionKey: "commandPalette.gatewayBalance.description",
        badge: "read",
        icon: BadgeDollarSign,
      },
    ],
  },
  {
    groupKey: "commandPalette.group.gateway",
    items: [
      {
        sample: "/deposit 50 from arc",
        titleKey: "commandPalette.deposit.title",
        descriptionKey: "commandPalette.deposit.description",
        badge: "confirm",
        icon: Waypoints,
      },
      {
        sample: "/withdraw 5 from base",
        titleKey: "commandPalette.withdraw.title",
        descriptionKey: "commandPalette.withdraw.description",
        badge: "confirm",
        icon: Download,
      },
      {
        sample: "/transfer 10 from base to arc",
        titleKey: "commandPalette.transfer.title",
        descriptionKey: "commandPalette.transfer.description",
        badge: "confirm",
        icon: Waypoints,
      },
      {
        sample: "/bridge 10 USDC from base to arc",
        titleKey: "commandPalette.bridge.title",
        descriptionKey: "commandPalette.bridge.description",
        badge: "confirm",
        icon: Waypoints,
      },
      {
        sample: "/swap 1 USDC to EURC",
        titleKey: "commandPalette.swap.title",
        descriptionKey: "commandPalette.swap.description",
        badge: "confirm",
        icon: ArrowRightLeft,
      },
      {
        sample: "/gas check arc",
        titleKey: "commandPalette.gasArc.title",
        descriptionKey: "commandPalette.gasArc.description",
        badge: "read",
        icon: Clock3,
      },
      {
        sample: "/gas check base",
        titleKey: "commandPalette.gasBase.title",
        descriptionKey: "commandPalette.gasBase.description",
        badge: "read",
        icon: Clock3,
      },
      {
        sample: "/gas check avalanche",
        titleKey: "commandPalette.gasAvalanche.title",
        descriptionKey: "commandPalette.gasAvalanche.description",
        badge: "read",
        icon: Clock3,
      },
      {
        sample: "/gateway info",
        titleKey: "commandPalette.gatewayInfo.title",
        descriptionKey: "commandPalette.gatewayInfo.description",
        badge: "read",
        icon: Sparkles,
      },
    ],
  },
  {
    groupKey: "commandPalette.group.payments",
    items: [
      {
        sample: "/pay 25 to Minh on arc from base",
        titleKey: "commandPalette.pay.title",
        descriptionKey: "commandPalette.pay.description",
        badge: "confirm",
        icon: Send,
      },
      {
        sample: "/request 25 from Minh on arc",
        titleKey: "commandPalette.request.title",
        descriptionKey: "commandPalette.request.description",
        badge: "write",
        icon: ReceiptText,
      },
      {
        sample: "/payroll run team 25 from base",
        titleKey: "commandPalette.payroll.title",
        descriptionKey: "commandPalette.payroll.description",
        badge: "confirm",
        icon: Users,
      },
      {
        sample: "/contacts add Minh 0x0000000000000000000000000000000000000000 on arc",
        titleKey: "commandPalette.contactsAdd.title",
        descriptionKey: "commandPalette.contactsAdd.description",
        badge: "write",
        icon: UserPlus,
      },
    ],
  },
  {
    groupKey: "commandPalette.group.history",
    items: [
      {
        sample: "/history",
        titleKey: "commandPalette.history.title",
        descriptionKey: "commandPalette.history.description",
        badge: "read",
        icon: History,
      },
      {
        sample: "/history deposit",
        titleKey: "commandPalette.historyDeposit.title",
        descriptionKey: "commandPalette.historyDeposit.description",
        badge: "read",
        icon: History,
      },
      {
        sample: "/history transfer",
        titleKey: "commandPalette.historyTransfer.title",
        descriptionKey: "commandPalette.historyTransfer.description",
        badge: "read",
        icon: History,
      },
    ],
  },
];

const onboardingCommands = [
  {
    sample: "/wallet create",
    titleKey: "onboarding.walletCreate.title",
    descriptionKey: "onboarding.walletCreate.description",
  },
  {
    sample: "/wallet status",
    titleKey: "onboarding.walletStatus.title",
    descriptionKey: "onboarding.walletStatus.description",
  },
  {
    sample: "/balance",
    titleKey: "onboarding.balance.title",
    descriptionKey: "onboarding.balance.description",
  },
  {
    sample: "/fund 10 from metamask on base",
    titleKey: "onboarding.fund.title",
    descriptionKey: "onboarding.fund.description",
  },
  {
    sample: "/transfer 5 from base to arc",
    titleKey: "onboarding.transfer.title",
    descriptionKey: "onboarding.transfer.description",
  },
  {
    sample: "/contacts add Minh 0x0000000000000000000000000000000000000000 on arc",
    titleKey: "onboarding.contacts.title",
    descriptionKey: "onboarding.contacts.description",
  },
];

function missingFieldQuestion(
  field: string,
  t: (key: string, params?: Record<string, string | number | undefined | null>) => string,
) {
  const key = `missing.${field}`;
  const translated = t(key);
  return translated === key ? t("missing.default", { field }) : translated;
}

function statusLabel(status: ExecutionItem["status"], t?: (key: string) => string) {
  return t?.(`status.${status}`) ?? status;
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
  return /\b(chuyển|chuyen|gửi|gui|trả|tra|pay|send|transfer|swap|đổi|doi|convert|bridge|cctp|nạp|nap|fund|deposit|withdraw|rút|rut|balance|số dư|so du|wallet|ví|vi|contact|liên hệ|lien he|payroll|request)\b/i.test(
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

function executionTxLinks(execution: ExecutionItem, t: TranslateFn) {
  const { result, transfer } = executionResultRecords(execution);
  const sourceChain = executionSourceChain(execution);
  const destinationChain = executionDestinationChain(execution);
  const transaction =
    [result.transaction, transfer.transaction, result.recordedTransaction]
      .map(recordFrom)
      .find((record) => Object.keys(record).length > 0) ?? {};
  const primaryHash =
    stringFrom(execution.txHash) ??
    stringFrom(result.txHash) ??
    stringFrom(result.mintTxHash) ??
    stringFrom(transfer.txHash) ??
    stringFrom(transfer.mintTxHash);
  const autoDepositHash = stringFrom(result.autoDepositTxHash) ?? stringFrom(transfer.autoDepositTxHash);
  const links: Array<{ label: string; txHash: string; chain: string | null }> = [];

  if (autoDepositHash) {
    links.push({ label: t("runtime.tx.autoDeposit"), txHash: autoDepositHash, chain: sourceChain });
  }

  if (primaryHash && primaryHash !== autoDepositHash) {
    const chain =
      execution.command === "transfer" || execution.command === "pay" || execution.command === "bridge"
        ? destinationChain ?? sourceChain
        : sourceChain ?? destinationChain;
    const label =
      execution.command === "transfer" || execution.command === "pay" || execution.command === "withdraw" || execution.command === "bridge"
        ? t("runtime.tx.mint")
        : t("runtime.tx.transaction");

    links.push({ label, txHash: primaryHash, chain });
  }

  const bridgeSourceHash = stringFrom(result.sourceTxHash);
  if (execution.command === "bridge" && bridgeSourceHash && bridgeSourceHash !== primaryHash) {
    links.unshift({ label: t("runtime.tx.source"), txHash: bridgeSourceHash, chain: sourceChain });
  }

  const proofHash =
    stringFrom(result.proofTxHash) ??
    stringFrom(transfer.proofTxHash) ??
    stringFrom(transaction?.proof_tx_hash);
  if (proofHash && !links.some((link) => link.txHash === proofHash)) {
    links.push({ label: t("receipt.paynaProof"), txHash: proofHash, chain: "arcTestnet" });
  }

  return links;
}

type ExecutionReceiptMetric = {
  label: string;
  value: string;
};

type ExecutionReceiptLink = {
  label: string;
  txHash: string;
  chain: string | null;
};

type ExecutionReceipt = {
  title: string;
  primary: string;
  secondary?: string;
  sourceChain: string | null;
  destinationChain: string | null;
  metrics: ExecutionReceiptMetric[];
  links: ExecutionReceiptLink[];
  details: ExecutionReceiptMetric[];
};

type TranslateFn = ReturnType<typeof useI18n>["t"];

function shortChainLabel(chain?: string | null) {
  return getChainMeta(chain)?.shortLabel ?? getChainMeta(chain)?.label ?? chain ?? "";
}

function metric(label: string, value?: string | number | null): ExecutionReceiptMetric | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return { label, value: String(value) };
}

function receiptLinks(...links: Array<ExecutionReceiptLink | null | undefined>) {
  const seen = new Set<string>();

  return links.filter((link): link is ExecutionReceiptLink => {
    if (!link?.txHash || seen.has(link.txHash)) {
      return false;
    }
    seen.add(link.txHash);
    return true;
  });
}

/**
 * "What now?" after a command lands. Derived from the execution at render time rather than stored
 * on the message, for the same reason buildExecutionReceipt is: the execution is already persisted
 * whole, so deriving costs nothing, needs no new metadata field in either writer, and applies to
 * statuses written before this existed.
 *
 * Every suggestion here is deliberately read-only (/balance, /history). A chip is one click with
 * no preview step behind it, so offering /deposit or /transfer would put a funds-moving command a
 * single stray click away — those stay in the composer where the confirm card guards them.
 */
function executionFollowUps(execution: ExecutionItem, t: TranslateFn) {
  if (execution.status !== "success") return [];

  // Where the money ended up is the chain worth looking at, so destination wins over source.
  // Anything not in the supported list degrades to the unscoped /balance rather than emitting a
  // command that would parse with no chain and silently mean something else.
  const rawChain = executionDestinationChain(execution) ?? executionSourceChain(execution);
  const chain = rawChain && isSupportedChain(rawChain) ? rawChain : "";
  const balanceOnChain = chain
    ? {
        // chainCommandAlias round-trips through normalizeChain, so the text this produces parses
        // back to the same chain it came from.
        command: `/balance on ${chainCommandAlias(chain)}`,
        label: t("action.checkBalanceOn", { chain: getChainMeta(chain)?.label ?? chain }),
      }
    : { command: "/balance", label: t("action.checkBalance") };
  const history = { command: "/history", label: t("action.viewHistory") };

  switch (execution.command) {
    case "deposit":
    case "withdraw":
    case "transfer":
    case "bridge":
    case "swap":
      return [balanceOnChain];
    case "pay":
    case "payroll":
      return [balanceOnChain, history];
    case "fund":
    case "wallet":
      return [{ command: "/balance", label: t("action.checkBalance") }];
    // No chip after /balance or /history: the answer is already on screen, and suggesting the
    // command the user just ran reads like the UI lost track of what happened.
    default:
      return [];
  }
}

function buildExecutionReceipt(execution: ExecutionItem, t: TranslateFn): ExecutionReceipt | null {
  if (execution.status !== "success") {
    return null;
  }

  const { result, transfer, payment } = executionResultRecords(execution);
  const sourceChain = executionSourceChain(execution);
  const destinationChain = executionDestinationChain(execution);
  const proofTxHash =
    stringFrom(result.proofTxHash) ??
    stringFrom(transfer.proofTxHash) ??
    stringFrom(recordFrom(result.recordedTransaction).proof_tx_hash);

  if (execution.command === "swap") {
    const tokenIn = stringFrom(result.tokenIn) ?? "USDC";
    const tokenOut = stringFrom(result.tokenOut) ?? "";
    const amountIn = stringFrom(result.amountIn) ?? "";
    const estimatedOut = formatDecimalAmount(result.estimatedAmountOut, 8);
    const minOut = formatDecimalAmount(result.minimumAmountOut, 8);
    const route = Array.isArray(result.route) ? result.route.join(" -> ") : "";
    const txHash = stringFrom(result.txHash) ?? execution.txHash ?? null;
    const approvalTxHash = stringFrom(result.approvalTxHash);

    return {
      title: t("receipt.swapComplete"),
      primary: `${amountIn} ${tokenIn} -> ~${estimatedOut} ${tokenOut}`.trim(),
      secondary: t("receipt.swapSecondary"),
      sourceChain: "arcTestnet",
      destinationChain: "arcTestnet",
      metrics: [
        metric(t("receipt.minimum"), `${minOut} ${tokenOut}`),
        metric(t("receipt.slippage"), `${PAYNA_SWAP_SLIPPAGE_BPS / 100}%`),
        metric(t("receipt.route"), route),
      ].filter(Boolean) as ExecutionReceiptMetric[],
      links: receiptLinks(
        txHash ? { label: t("receipt.swapTx"), txHash, chain: "arcTestnet" } : null,
        proofTxHash ? { label: t("receipt.paynaProof"), txHash: proofTxHash, chain: "arcTestnet" } : null,
      ),
      details: [
        metric(t("receipt.approveTx"), approvalTxHash),
        metric(t("receipt.adapter"), stringFrom(result.adapterAddress)),
      ].filter(Boolean) as ExecutionReceiptMetric[],
    };
  }

  if (execution.command === "bridge") {
    const amount = formatDecimalAmount(result.amount);
    const recipient =
      result.recipientMode === "external"
        ? stringFrom(result.recipientAddress)
        : t("receipt.myWallet");
    const sourceSpend = Number(result.sourceDebit ?? 0);
    const bridgeFee = Number(result.estimatedFeeTotal ?? 0);
    const sourceTxHash = stringFrom(result.sourceTxHash);
    const mintTxHash = stringFrom(result.mintTxHash) ?? execution.txHash ?? null;

    return {
      title: t("receipt.bridgeComplete"),
      primary: `${amount} USDC ${shortChainLabel(sourceChain)} -> ${shortChainLabel(destinationChain)}`,
      sourceChain,
      destinationChain,
      metrics: [
        metric(t("receipt.receives"), `${amount} USDC`),
        sourceSpend > 0 ? metric(t("receipt.sourceSpend"), `~${formatDecimalAmount(sourceSpend)} USDC`) : null,
        bridgeFee > 0 ? metric(t("receipt.fees"), `~${formatDecimalAmount(bridgeFee)} USDC`) : null,
        metric(t("receipt.destinationGas"), result.mintMode === "manual_mint" ? t("receipt.manual") : t("receipt.forwarderPaid")),
      ].filter(Boolean) as ExecutionReceiptMetric[],
      links: receiptLinks(
        sourceTxHash ? { label: t("receipt.sourceTx"), txHash: sourceTxHash, chain: sourceChain } : null,
        mintTxHash ? { label: t("receipt.mintTx"), txHash: mintTxHash, chain: destinationChain ?? sourceChain } : null,
        proofTxHash ? { label: t("receipt.paynaProof"), txHash: proofTxHash, chain: "arcTestnet" } : null,
      ),
      details: [
        metric(t("receipt.recipient"), recipient),
        metric(t("receipt.transferId"), stringFrom(result.transferId)),
        metric(t("receipt.mode"), stringFrom(result.mintMode)),
      ].filter(Boolean) as ExecutionReceiptMetric[],
    };
  }

  if (execution.command === "transfer") {
    const amount = formatDecimalAmount(result.amount);
    const txHash = stringFrom(result.mintTxHash) ?? stringFrom(result.txHash) ?? execution.txHash ?? null;
    const fees = recordFrom(result.fees);
    const fee = Number(result.estimatedGatewayFee ?? fees.total ?? 0);
    const required = Number(result.requiredGatewayBalance ?? 0);

    return {
      title: t("receipt.transferComplete"),
      primary: `${amount} USDC ${shortChainLabel(sourceChain)} -> ${shortChainLabel(destinationChain)}`,
      sourceChain,
      destinationChain,
      metrics: [
        result.autoDeposit ? metric(t("receipt.autoDeposit"), `${formatDecimalAmount(result.autoDepositedAmount)} USDC`) : null,
        result.forwarding ? metric(t("receipt.forwarding"), t("receipt.enabled")) : metric(t("receipt.destinationGas"), t("receipt.manual")),
        fee > 0 ? metric(t("receipt.fees"), `${formatDecimalAmount(fee)} USDC`) : null,
      ].filter(Boolean) as ExecutionReceiptMetric[],
      links: receiptLinks(
        txHash ? { label: t("receipt.transferTx"), txHash, chain: destinationChain ?? sourceChain } : null,
        proofTxHash ? { label: t("receipt.paynaProof"), txHash: proofTxHash, chain: "arcTestnet" } : null,
      ),
      details: [
        required > 0 ? metric(t("receipt.sourceDebit"), `~${formatDecimalAmount(required)} USDC`) : null,
        metric(t("receipt.mode"), result.forwarding ? t("transfer.autoForwarding") : t("transfer.manualGas")),
        metric(t("receipt.transferId"), stringFrom(result.transferId)),
      ].filter(Boolean) as ExecutionReceiptMetric[],
    };
  }

  if (execution.command === "pay") {
    const amount = formatDecimalAmount(payment.amount ?? result.amount);
    const recipient = stringFrom(recordFrom(payment.recipient).label) ?? stringFrom(result.recipient) ?? t("receipt.recipient");
    const txHash =
      stringFrom(transfer.mintTxHash) ??
      stringFrom(transfer.txHash) ??
      stringFrom(payment.txHash) ??
      execution.txHash ??
      null;
    const fees = recordFrom(transfer.fees);
    const fee = Number(transfer.estimatedGatewayFee ?? fees.total ?? 0);
    const required = Number(transfer.requiredGatewayBalance ?? 0);

    return {
      title: t("receipt.paymentSent"),
      primary: `${amount} USDC to ${recipient}`,
      secondary: destinationChain ? t("receipt.deliveredOn", { chain: getChainMeta(destinationChain)?.label ?? destinationChain }) : undefined,
      sourceChain,
      destinationChain,
      metrics: [
        metric(t("receipt.recipient"), recipient),
        transfer.forwarding ? metric(t("receipt.forwarding"), t("receipt.enabled")) : metric(t("receipt.destinationGas"), t("receipt.manual")),
        fee > 0 ? metric(t("receipt.fees"), `${formatDecimalAmount(fee)} USDC`) : null,
      ].filter(Boolean) as ExecutionReceiptMetric[],
      links: receiptLinks(
        txHash ? { label: t("receipt.paymentTx"), txHash, chain: destinationChain ?? sourceChain } : null,
        proofTxHash ? { label: t("receipt.paynaProof"), txHash: proofTxHash, chain: "arcTestnet" } : null,
      ),
      details: [
        metric(t("receipt.recipientAddress"), stringFrom(payment.recipient_address) ?? stringFrom(payment.recipientAddress)),
        required > 0 ? metric(t("receipt.sourceDebit"), `~${formatDecimalAmount(required)} USDC`) : null,
        metric(t("receipt.mode"), transfer.forwarding ? t("transfer.autoForwarding") : t("transfer.manualGas")),
      ].filter(Boolean) as ExecutionReceiptMetric[],
    };
  }

  return null;
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
      ...localeRequestHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
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

async function getConnectedMetaMaskAccount() {
  const accounts = await requestMetaMask(
    { method: "eth_accounts" },
    { label: "MetaMask connected account lookup" },
  );
  const address = Array.isArray(accounts) ? String(accounts[0] ?? "") : "";
  return address ? normalizeAddress(address) : "";
}

async function linkMetaMaskWallet() {
  const address = await requestMetaMaskAccount();
  const message = [
    "Link this MetaMask wallet to Payna.",
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

    const confirmed = window.confirm(
      translateClient("metamask.addNetworkPrompt", {
        chain: chain.name,
        action: translateClient("metamask.bridgeFundAction"),
      }),
    );

    if (!confirmed) {
      throw new Error(translateClient("metamask.addNetworkCancelled", { chain: chain.name }));
    }

    await requestMetaMask(
      {
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chain.hexChainId,
            chainName: chain.name,
            nativeCurrency: metaMaskNativeCurrency(chain.nativeCurrency),
            rpcUrls: [chain.rpcUrl],
            blockExplorerUrls: [chain.blockExplorerUrl],
          },
        ],
      },
      { timeoutMs: METAMASK_CHAIN_TIMEOUT_MS, label: `Add ${chain.name} to MetaMask` },
    );
  }
}

type MetaMaskChainSwitchConfig = {
  id: number;
  hexChainId: `0x${string}`;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
};

function metaMaskNativeCurrency(currency: MetaMaskChainSwitchConfig["nativeCurrency"]) {
  return {
    ...currency,
    // MetaMask rejects wallet_addEthereumChain on EVM chains when nativeCurrency.decimals is not 18.
    // Keep app-level Arc metadata as USDC/6 for display, but send MetaMask-compatible metadata here.
    decimals: 18,
  };
}

function metaMaskBridgeChainConfig(chainKey: CctpBridgeChainKey): MetaMaskChainSwitchConfig {
  const chain = cctpBridgeChainMap[chainKey].viemChain;
  return {
    id: chain.id,
    hexChainId: `0x${chain.id.toString(16)}`,
    name: chain.name,
    rpcUrl: chain.rpcUrls.default.http[0] ?? "",
    blockExplorerUrl: chain.blockExplorers?.default.url ?? "",
    nativeCurrency: chain.nativeCurrency,
  };
}

async function switchMetaMaskChainByKey(chainKey: string) {
  const chain =
    isCctpBridgeKey(chainKey)
      ? metaMaskBridgeChainConfig(chainKey)
      : chainKey in web3Chains
        ? web3Chains[chainKey as keyof typeof web3Chains]
        : null;

  if (!chain) {
    throw new Error(`Unsupported MetaMask chain: ${chainKey}`);
  }

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

    const confirmed = window.confirm(
      translateClient("metamask.addNetworkPrompt", {
        chain: chain.name,
        action: translateClient("metamask.bridgeAction"),
      }),
    );

    if (!confirmed) {
      throw new Error(translateClient("metamask.addNetworkCancelled", { chain: chain.name }));
    }

    await requestMetaMask(
      {
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chain.hexChainId,
            chainName: chain.name,
            nativeCurrency: metaMaskNativeCurrency(chain.nativeCurrency),
            rpcUrls: [chain.rpcUrl],
            blockExplorerUrls: chain.blockExplorerUrl ? [chain.blockExplorerUrl] : [],
          },
        ],
      },
      { timeoutMs: METAMASK_CHAIN_TIMEOUT_MS, label: `Add ${chain.name} to MetaMask` },
    );
  }
}

// Arc receipts are read server-side, not through the wallet. `waitForMetaMaskReceipt` below polls
// MetaMask 30 times at a fixed 2s interval, and a swap sends two transactions — up to 60 wallet
// requests per swap, which is most of what was tripping Arc's rate limit. It stays as-is because the
// fund flow on other chains still uses it.
const ARC_RECEIPT_ATTEMPTS = 10;

async function waitForArcReceipt(txHash: string): Promise<"success" | "failed" | "pending"> {
  for (let attempt = 0; attempt < ARC_RECEIPT_ATTEMPTS; attempt += 1) {
    try {
      // The route holds each request open for several seconds while it waits, so it paces itself and
      // needs no sleep in between. It answers `pending` instead of failing when that wait elapses,
      // which is what makes asking again safe.
      const result = await requestJson("/api/swap/receipt", {
        method: "POST",
        body: JSON.stringify({ txHash }),
      });

      if (result?.status === "success" || result?.status === "failed") {
        return result.status;
      }
    } catch {
      // A failed round trip says nothing about the transaction — only that this one read did not
      // land. Keep waiting rather than reporting a swap the user already signed as broken.
      //
      // The sleep only matters here. A `pending` answer already cost the route's own wait, so the
      // loop paces itself; a request that fails fast (auth, bad payload) does not, and without this
      // the ten attempts would fire back-to-back — the tight loop this whole change exists to remove.
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }

  // Ten waits is far past Arc's ~1s block time. Still report pending, not failed: the transaction is
  // on-chain either way, and calling it failed would assert something we did not observe.
  return "pending";
}

function isCctpBridgeKey(value: string): value is CctpBridgeChainKey {
  return value in cctpBridgeChainMap;
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

type SwapEstimate = {
  tokenIn: PaynaSwapTokenSymbol;
  tokenOut: PaynaSwapTokenSymbol;
  amountIn: bigint;
  amountOut: bigint;
  amountOutMin: bigint;
  route: PaynaSwapTokenSymbol[];
  pairs: `0x${string}`[];
};

// Quotes are priced server-side. Two client-side approaches were tried first and both broke:
//
// 1. Reading through the wallet (`eth_call` on the injected provider) resolves against whatever
//    chain the user currently has selected, and this runs from a preview effect on every keystroke —
//    long before `swapWithMetaMask` switches to Arc. With the wallet elsewhere the Payna factory
//    address holds no code, `eth_call` returns `0x`, and viem throws `Cannot decode zero data
//    ("0x")`. Reproduced by `/deposit … from base` (leaves MetaMask on Base Sepolia) then `/swap`.
// 2. A viem public client pinned to the Arc RPC fixed the chain but hit CORS: that endpoint sits
//    behind a load balancer whose nodes disagree about it. Measured over 10 requests each, 6/10
//    POSTs came back with no `access-control-allow-origin` and 6/10 `OPTIONS` preflights returned
//    400. viem sends `Content-Type: application/json`, which is not CORS-safelisted, so a preflight
//    is mandatory and about half fail — surfacing as `Failed to fetch`. MetaMask never hit this
//    because extension-originated requests are not subject to CORS at all.
//
// Same-origin has neither problem, and it collapses what were up to 5 sequential round trips from
// the browser into one request. `/api/swap/quote` owns the pricing math now; this only decodes it.
// `fresh` re-reads reserves instead of using the route's few-second cache. Pass it when the result
// becomes the `amountOutMin` in a real transaction; leave it off for the preview, which is what
// keeps the keystroke path inside the RPC's 4 req/s limit.
async function estimateSwapDraft(
  draft: ParsedCommand,
  options: { fresh?: boolean } = {},
): Promise<SwapEstimate> {
  const tokenIn = draft.fields.tokenIn as PaynaSwapTokenSymbol;
  const tokenOut = draft.fields.tokenOut as PaynaSwapTokenSymbol;

  const quote = await requestJson("/api/swap/quote", {
    method: "POST",
    body: JSON.stringify({
      tokenIn,
      tokenOut,
      amount: draft.fields.amount,
      fresh: options.fresh ?? false,
    }),
  });

  // Atomic units arrive as strings because JSON has no bigint. Re-widening here rather than having
  // the route send decimals keeps `amountOutMin` — the value the user actually signs — exact.
  return {
    tokenIn: quote.tokenIn as PaynaSwapTokenSymbol,
    tokenOut: quote.tokenOut as PaynaSwapTokenSymbol,
    amountIn: BigInt(quote.amountIn),
    amountOut: BigInt(quote.amountOut),
    amountOutMin: BigInt(quote.amountOutMin),
    route: quote.route as PaynaSwapTokenSymbol[],
    pairs: quote.pairs as `0x${string}`[],
  };
}

async function approveErc20IfNeeded(params: {
  tokenAddress: `0x${string}`;
  owner: string;
  spender: `0x${string}`;
  amount: bigint;
  // Passed in rather than read here: the only caller already has it from `/api/swap/preflight`, and
  // reading it again would put back one of the wallet `eth_call`s that preflight exists to remove.
  currentAllowance: bigint;
}) {
  if (params.currentAllowance >= params.amount) {
    return null;
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [params.spender, params.amount],
  });
  const txHash = await requestMetaMask(
    {
      method: "eth_sendTransaction",
      params: [
        {
          from: params.owner,
          to: params.tokenAddress,
          value: "0x0",
          data,
        },
      ],
    },
    { label: "MetaMask token approval" },
  );

  if (typeof txHash !== "string") {
    throw new Error("MetaMask did not return an approval transaction hash.");
  }

  // Only an observed revert aborts here, same as before: a receipt we could not read yet is not
  // grounds to refuse to continue.
  if ((await waitForArcReceipt(txHash)) === "failed") {
    throw new Error("Token approval failed on-chain.");
  }

  return txHash;
}

async function swapWithMetaMask(draft: ParsedCommand) {
  const adapterAddress = getSwapAdapterAddress();
  if (!adapterAddress) {
    throw new Error("Payna swap adapter address is not configured.");
  }

  const account = await requestMetaMaskAccount();
  await switchMetaMaskChain(PAYNA_SWAP_CHAIN);
  // `fresh`: this estimate becomes the `amountOutMin` encoded into the transaction, so it must come
  // from reserves read now, not from the preview's short-lived cache.
  const estimate = await estimateSwapDraft(draft, { fresh: true });
  const inputToken = paynaSwapTokens[estimate.tokenIn];
  const outputToken = paynaSwapTokens[estimate.tokenOut];

  // One server call replaces three reads that used to go through MetaMask (`eth_getBalance` plus two
  // `eth_call`s). The wallet is not a read layer: it forwards to the same Arc RPC while adding its
  // own background polling, and reads through it resolve against whatever chain the user currently
  // has selected — which is how a wallet left on Base Sepolia made the Arc token address hold no
  // code and `eth_call` return `0x`. Server-side the chain is pinned and the three reads collapse
  // into one multicall plus one balance lookup, both behind the shared Arc throttle.
  const preflight = await requestJson("/api/swap/preflight", {
    method: "POST",
    body: JSON.stringify({ account, tokenIn: estimate.tokenIn }),
  });

  if (!preflight?.hasNativeGas) {
    throw new Error(
      translateClient("fund.noNativeGas", {
        address: account,
        symbol: web3Chains.arcTestnet.nativeCurrency.symbol,
        chain: web3Chains.arcTestnet.name,
      }),
    );
  }

  // Atomic units arrive as strings because JSON has no bigint.
  const inputBalance = BigInt(preflight.balance ?? "0");
  if (inputBalance < estimate.amountIn) {
    throw new Error(`Insufficient ${inputToken.symbol}. Required ${draft.fields.amount}, current ${formatUnits(inputBalance, inputToken.decimals)}.`);
  }

  const approvalTxHash = await approveErc20IfNeeded({
    tokenAddress: inputToken.address,
    owner: account,
    spender: adapterAddress,
    amount: estimate.amountIn,
    // Already read by the preflight above, so approving does not pay for a second allowance call.
    currentAllowance: BigInt(preflight.allowance ?? "0"),
  });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const data = encodeFunctionData({
    abi: paynaSwapAdapterAbi,
    functionName: "swapExactTokensForTokens",
    args: [
      inputToken.address,
      outputToken.address,
      estimate.amountIn,
      estimate.amountOutMin,
      account as `0x${string}`,
      deadline,
    ],
  });
  const txHash = await requestMetaMask(
    {
      method: "eth_sendTransaction",
      params: [
        {
          from: account,
          to: adapterAddress,
          value: "0x0",
          data,
        },
      ],
    },
    { label: "MetaMask Payna swap confirmation" },
  );

  if (typeof txHash !== "string") {
    throw new Error("MetaMask did not return a swap transaction hash.");
  }

  const status = await waitForArcReceipt(txHash);
  const recorded = await requestJson("/api/swap/record", {
    method: "POST",
    body: JSON.stringify({
      txHash,
      userAddress: account,
      recipientAddress: account,
      tokenIn: estimate.tokenIn,
      tokenOut: estimate.tokenOut,
      amountIn: formatUnits(estimate.amountIn, inputToken.decimals),
      amountOut: formatUnits(estimate.amountOut, outputToken.decimals),
      amountOutMin: formatUnits(estimate.amountOutMin, outputToken.decimals),
      route: estimate.route,
      status,
    }),
  }).catch(() => null);

  return {
    sourceChain: "arcTestnet",
    destinationChain: "arcTestnet",
    tokenIn: estimate.tokenIn,
    tokenOut: estimate.tokenOut,
    amountIn: formatUnits(estimate.amountIn, inputToken.decimals),
    estimatedAmountOut: formatUnits(estimate.amountOut, outputToken.decimals),
    minimumAmountOut: formatUnits(estimate.amountOutMin, outputToken.decimals),
    route: estimate.route,
    pairs: estimate.pairs,
    approvalTxHash,
    txHash,
    status,
    recordedTransaction: recorded?.transaction,
    proofTxHash: recorded?.transaction?.proof_tx_hash,
  };
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
      translateClient("fund.gasEstimateFailed", { chain: params.chainName, message }),
    );
  }
}

async function fundCircleWalletFromMetaMask(draft: ParsedCommand) {
  const chainKey = draft.fields.chain as keyof typeof web3Chains;
  const chain = web3Chains[chainKey];

  if (!chain) {
    throw new Error("Unsupported fund chain.");
  }

  // Concurrent, not sequential: the server lookup and the MetaMask connect prompt need
  // nothing from each other, and step 3 below needs both. Serialising them meant the
  // wallet prompt could not even start until a round-trip finished, so every millisecond
  // of server latency was added directly to how long `fund` felt before MetaMask appeared.
  const [context, account] = await Promise.all([
    requestJson(`/api/user/fund?chain=${encodeURIComponent(chainKey)}`),
    requestMetaMaskAccount(),
  ]);
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

  // Two independent reads against the same chain, so issue them together. Keep the checks
  // themselves in order below: when a wallet fails both, "no gas" is the more useful thing
  // to report, because funding gas is the prerequisite for fixing the USDC shortfall.
  const [nativeBalance, usdcBalance] = await Promise.all([
    getNativeBalance(account),
    getErc20Balance(chain.usdcAddress, account),
  ]);

  if (nativeBalance === 0n) {
    throw new Error(
      translateClient("fund.noNativeGas", {
        address: account,
        symbol: chain.nativeCurrency.symbol,
        chain: chain.name,
      }),
    );
  }

  if (usdcBalance < amount) {
    throw new Error(
      translateClient("fund.insufficientUsdc", {
        chain: chain.name,
        required: draft.fields.amount,
        current: formatUnits(usdcBalance, 6),
      }),
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

type BridgeEstimateSummary = {
  amount: string;
  sourceDebit: string;
  estimatedFeeTotal: string;
  feeItems: Array<{ token: string; amount: string; type: string }>;
  gasItems: Array<{ blockchain: string; token: string; fee: string; name: string }>;
};

type BridgeExecutionResult = {
  sourceChain: string;
  destinationChain: string;
  sourceChainLabel?: string;
  destinationChainLabel?: string;
  amount: string;
  recipientAddress: string;
  recipientMode: "self" | "external";
  mintMode: CctpBridgeMintMode;
  transferSpeed: CctpBridgeTransferSpeed;
  sourceDebit: string;
  estimatedFeeTotal: string;
  estimate: BridgeEstimateSummary;
  sourceTxHash?: string;
  mintTxHash?: string;
  transferId?: string;
  recordedTransaction?: unknown;
  proofTxHash?: string;
};

function bridgeFeeTotal(estimate: any) {
  return (estimate?.fees ?? []).reduce((sum: number, fee: any) => sum + Number(fee?.amount ?? 0), 0);
}

function bridgeEstimateSummary(estimate: any, amount: string): BridgeEstimateSummary {
  const totalFee = bridgeFeeTotal(estimate);
  const sourceDebit = Number(amount) + totalFee;
  return {
    amount,
    sourceDebit: sourceDebit.toString(),
    estimatedFeeTotal: totalFee.toString(),
    feeItems: (estimate?.fees ?? []).map((fee: any) => ({
      token: fee?.token ?? "USDC",
      amount: String(fee?.amount ?? "0"),
      type: String(fee?.type ?? "provider"),
    })),
    gasItems: (estimate?.gasFees ?? []).map((fee: any) => ({
      blockchain: String(fee?.blockchain ?? ""),
      token: String(fee?.token ?? ""),
      fee: String(fee?.fees?.fee ?? "0"),
      name: String(fee?.name ?? ""),
    })),
  };
}

function bridgeTxHashFromSteps(steps: any[], match: RegExp) {
  const step = steps.find((item) => match.test(String(item?.name ?? item?.method ?? "")));
  return step?.txHash ?? step?.values?.txHash ?? step?.receipt?.transactionHash ?? undefined;
}

async function buildBridgeContext(draft: ParsedCommand, options?: { promptForAccount?: boolean }) {
  const sourceChain = normalizeCctpBridgeChain(draft.fields.sourceChain);
  const destinationChain = normalizeCctpBridgeChain(draft.fields.destinationChain);

  if (!sourceChain || !destinationChain) {
    throw new Error(translateClient("bridge.error.invalidRoute"));
  }

  if (sourceChain === destinationChain) {
    throw new Error(translateClient("bridge.error.sameChain"));
  }

  const amount = draft.fields.amount;
  if (!amount) {
    throw new Error(translateClient("bridge.error.missingAmount"));
  }

  const mintMode = (draft.fields.bridgeMintMode as CctpBridgeMintMode) || bridgeModeFrom(draft.raw);
  const transferSpeed =
    (draft.fields.transferSpeed as CctpBridgeTransferSpeed) || bridgeSpeedFrom(draft.raw);
  const recipientMode: "self" | "external" =
    draft.fields.recipientMode === "external" ? "external" : "self";
  const recipientAddress = draft.fields.recipientAddress?.trim() ?? "";

  if (recipientMode === "external" && mintMode === "manual_mint") {
    throw new Error(translateClient("bridge.error.externalManual"));
  }

  const account = options?.promptForAccount === false ? await getConnectedMetaMaskAccount() : await requestMetaMaskAccount();
  if (!account) {
    throw new Error(translateClient("bridge.error.connectMetamask"));
  }
  const adapter = await createAdapterFromProvider({ provider: window.ethereum as any });
  const runtimeChains = await getSupportedCctpBridgeChains();
  const runtimeMap = Object.fromEntries(runtimeChains.map((chain) => [chain.key, chain])) as Record<
    string,
    CctpBridgeRuntimeChain
  >;
  const sourceRuntime = runtimeMap[sourceChain];
  const destinationRuntime = runtimeMap[destinationChain];

  if (!sourceRuntime || !destinationRuntime) {
    throw new Error(translateClient("bridge.error.unsupportedRoute"));
  }

  if (mintMode === "auto_forwarding" && !destinationRuntime.canForwardToDestination) {
    throw new Error(translateClient("bridge.error.forwardingUnsupported", { chain: destinationRuntime.label }));
  }

  const resolvedRecipient =
    recipientMode === "external" ? recipientAddress : account;

  if (!resolvedRecipient || !/^0x[a-fA-F0-9]{40}$/.test(resolvedRecipient)) {
    throw new Error(translateClient("bridge.error.invalidRecipient"));
  }

  const sourceParams = {
    adapter,
    chain: sourceRuntime.bridgeKitChain,
  };
  const destinationParams =
    ({
      adapter,
      chain: destinationRuntime.bridgeKitChain,
      recipientAddress:
        recipientMode === "external" || mintMode === "auto_forwarding" ? resolvedRecipient : undefined,
    } as any);

  return {
    account,
    amount,
    mintMode,
    transferSpeed,
    recipientMode,
    recipientAddress: resolvedRecipient,
    sourceChain,
    destinationChain,
    sourceRuntime,
    destinationRuntime,
    sourceParams,
    destinationParams,
  };
}

async function estimateBridgeDraft(draft: ParsedCommand) {
  const context = await buildBridgeContext(draft, { promptForAccount: false });
  const kit = new BridgeKit();
  const estimate = await kit.estimate({
    from: context.sourceParams as any,
    to: context.destinationParams,
    amount: context.amount,
    token: "USDC",
    config: {
      transferSpeed: context.transferSpeed,
    } as any,
  });

  return {
    ...context,
    estimate,
    summary: bridgeEstimateSummary(estimate, context.amount),
  };
}

async function bridgeUsdcWithMetaMask(draft: ParsedCommand): Promise<BridgeExecutionResult> {
  // The burn is irreversible while the mint still needs a signature, so these are
  // captured outside the try block: the catch has to report where the funds stopped.
  let burnTxHash: string | undefined;
  let burnRecordPromise: Promise<any> | null = null;

  try {
    const context = await buildBridgeContext(draft, { promptForAccount: true });
    const kit = new BridgeKit();

    // BridgeKit emits `burn` with the source tx hash before the mint step runs
    // (provider-cctp-v2 dispatchStepEvent). Persist it as `pending_mint` right then,
    // so a rejected or failed mint still leaves a row that can be traced and claimed.
    kit.on("burn", (payload: any) => {
      const step = payload?.values ?? payload;
      const txHash = step?.txHash;
      if (step?.state !== "success" || !txHash || burnRecordPromise) {
        return;
      }
      burnTxHash = txHash;
      burnRecordPromise = requestJson("/api/cctp/bridge/record", {
        method: "POST",
        body: JSON.stringify({
          sourceChain: context.sourceChain,
          destinationChain: context.destinationChain,
          amount: context.amount,
          sourceTxHash: txHash,
          userAddress: context.account,
          recipientAddress: context.recipientAddress,
          recipientMode: context.recipientMode,
          mintMode: context.mintMode,
          transferSpeed: context.transferSpeed,
          status: "pending_mint",
        }),
      }).catch(() => null);
    });

    const estimate = await kit.estimate({
      from: context.sourceParams as any,
      to: context.destinationParams,
      amount: context.amount,
      token: "USDC",
      config: {
        transferSpeed: context.transferSpeed,
      } as any,
    });
    const estimateSummary = bridgeEstimateSummary(estimate, context.amount);

    await switchMetaMaskChainByKey(context.sourceChain);

    // Preflight after the chain switch, so eth_getBalance/eth_call read the source
    // chain: a burn that fails halfway is far more expensive than an early refusal.
    const nativeBalance = await getNativeBalance(context.account);
    if (nativeBalance === 0n) {
      throw new Error(
        translateClient("fund.noNativeGas", {
          address: context.account,
          symbol: context.sourceRuntime.viemChain.nativeCurrency.symbol,
          chain: context.sourceRuntime.label,
        }),
      );
    }

    // The source chain is debited amount + fees, so the estimate is the real requirement.
    // Fixed to 6 decimals (USDC precision) because sourceDebit is a stringified float:
    // values below 1e-6 stringify as exponential notation, which parseUnits rejects.
    const requiredUsdc = parseUnits(Number(estimateSummary.sourceDebit).toFixed(6), 6);
    const usdcBalance = await getErc20Balance(context.sourceRuntime.usdcAddress, context.account);
    if (usdcBalance < requiredUsdc) {
      throw new Error(
        translateClient("fund.insufficientUsdc", {
          chain: context.sourceRuntime.label,
          required: estimateSummary.sourceDebit,
          current: formatUnits(usdcBalance, 6),
        }),
      );
    }

    const result = await kit.bridge({
      from: context.sourceParams as any,
      to: context.destinationParams,
      amount: context.amount,
      token: "USDC",
      config: {
        transferSpeed: context.transferSpeed,
      } as any,
    });

    if (result?.state !== "success") {
      throw new Error(translateClient("bridge.error.incomplete"));
    }

    const steps = Array.isArray(result?.steps) ? result.steps : [];
    const sourceTxHash = bridgeTxHashFromSteps(steps, /burn/i) ?? burnTxHash;
    const mintTxHash = bridgeTxHashFromSteps(steps, /mint/i);
    const transferId =
      (steps.find((step: any) => /attestation|mint/i.test(String(step?.name ?? step?.method ?? ""))) as any)
        ?.transferId ?? (result as any)?.transferId;

    const recorded = await requestJson("/api/cctp/bridge/record", {
      method: "POST",
      body: JSON.stringify({
        sourceChain: context.sourceChain,
        destinationChain: context.destinationChain,
        amount: context.amount,
        sourceTxHash,
        mintTxHash,
        userAddress: context.account,
        recipientAddress: context.recipientAddress,
        recipientMode: context.recipientMode,
        mintMode: context.mintMode,
        transferSpeed: context.transferSpeed,
        transferId,
        status: "success",
      }),
    }).catch(() => null);

    return {
      sourceChain: context.sourceChain,
      destinationChain: context.destinationChain,
      sourceChainLabel: context.sourceRuntime.label,
      destinationChainLabel: context.destinationRuntime.label,
      amount: context.amount,
      recipientAddress: context.recipientAddress,
      recipientMode: context.recipientMode,
      mintMode: context.mintMode,
      transferSpeed: context.transferSpeed,
      sourceDebit: estimateSummary.sourceDebit,
      estimatedFeeTotal: estimateSummary.estimatedFeeTotal,
      estimate: estimateSummary,
      sourceTxHash,
      mintTxHash,
      transferId,
      recordedTransaction: recorded?.transaction,
      proofTxHash: recorded?.transaction?.proof_tx_hash,
    };
  } catch (error) {
    // Make sure the pending_mint row is actually written before surfacing the failure,
    // otherwise a burn can be lost when the page navigates away on error.
    if (burnRecordPromise) {
      await burnRecordPromise;
    }

    const raw = error as { code?: number; message?: string };
    const baseMessage = error instanceof Error ? error.message : "Bridge failed";
    const message = burnTxHash
      ? `${baseMessage} ${translateClient("bridge.error.burnedAwaitingMint", { txHash: burnTxHash })}`
      : baseMessage;

    // Keep `code` (4001 user-rejected, -32002 pending request) and the burn hash on the
    // error so the chat layer can offer the right recovery action instead of a plain retry.
    throw Object.assign(
      new Error(
        bridgeErrorWithFaucet(message, [
          draft.fields.sourceChain,
          draft.fields.bridgeMintMode === "manual_mint" ? draft.fields.destinationChain : null,
        ]),
      ),
      { code: raw?.code, burnTxHash, mintPending: Boolean(burnTxHash) },
    );
  }
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

  if (draft.command === "bridge") {
    return bridgeUsdcWithMetaMask(draft);
  }

  if (draft.command === "swap") {
    return swapWithMetaMask(draft);
  }

  if (draft.command === "wallet") {
    if (draft.fields.action === "create") {
      return requestJson("/api/wallet-set", { method: "POST", body: JSON.stringify({}) });
    }
    if (draft.fields.action === "balance") {
      return requestJson("/api/gateway/balance", { method: "POST", body: JSON.stringify({ chain: draft.fields.chain || undefined }) });
    }
    return requestJson("/api/wallet/status");
  }

  if (draft.command === "balance") {
    return requestJson("/api/gateway/balance", { method: "POST", body: JSON.stringify({ chain: draft.fields.chain || undefined }) });
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
      return requestJson("/api/gateway/balance", { method: "POST", body: JSON.stringify({ chain: draft.fields.chain || undefined }) });
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
  const { t, locale } = useI18n();
  const { registerStatusWriter, runServerCommand, refreshBalance } = usePayCmdRuntime();
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [chatThreads, setChatThreads] = useState<ChatThreadSummary[]>([]);
  const [isThreadListOpen, setIsThreadListOpen] = useState(false);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>("paycmd");
  const [selectedSurfMode, setSelectedSurfMode] = useState<SurfMode>("research");
  const [selectedSurfEffort, setSelectedSurfEffort] = useState<SurfEffort>("standard");
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
  const scrollMetricsRef = useRef(scrollMetrics);
  const scrollMetricsFrameRef = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previousScrollHeightRef = useRef<number | null>(null);
  // Set by the anchor-restore layout effect, consumed by the auto-scroll effect below it.
  const didRestoreAnchorRef = useRef(false);
  const isLoadingOlderRef = useRef(false);
  const skipNextAutoScrollRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
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
      // Normalized rather than allowlisted, so rows written under the old three-tier scheme keep
      // their tier. Still undefined when the key is absent: most messages have no effort at all and
      // should show no badge, which is different from having one that defaults to standard.
      effort: typeof metadata.effort === "string" ? normalizeSurfEffort(metadata.effort) : undefined,
      durationMs: typeof metadata.durationMs === "number" ? metadata.durationMs : undefined,
      actions: normalizeAssistantActions(metadata.actions),
      reasoning:
        typeof metadata.reasoning === "string" && metadata.reasoning.trim()
          ? metadata.reasoning
          : undefined,
      quota: normalizeAiQuota(metadata.quota),
    };
  }

  function addMessage(message: Omit<ChatMessage, "id"> & { id?: string }) {
    setMessages((current) => [
      ...current,
      { ...message, id: message.id ?? `${message.role}_${Date.now()}_${current.length}` },
    ]);
  }

  function touchThreadPreview(activeThreadId: string, message: Omit<ChatMessage, "id">) {
    const timestamp = new Date().toISOString();
    setChatThreads((current) => {
      const existing = current.find((thread) => thread.id === activeThreadId);
      const updatedThread: ChatThreadSummary =
        existing != null
          ? {
              ...existing,
              last_message_preview: message.text,
              last_message_at: timestamp,
              last_message_role: message.role,
              last_message_kind: message.kind ?? "text",
              message_count: (existing.message_count ?? 0) + 1,
              updated_at: timestamp,
            }
          : {
              id: activeThreadId,
              user_id: userId ?? "",
              title: "New chat",
              status: "active",
              created_at: timestamp,
              updated_at: timestamp,
              last_message_preview: message.text,
              last_message_at: timestamp,
              last_message_role: message.role,
              last_message_kind: message.kind ?? "text",
              message_count: 1,
            };

      return [updatedThread, ...current.filter((thread) => thread.id !== activeThreadId)].sort(
        (left, right) => threadSortTime(right) - threadSortTime(left),
      );
    });
  }

  async function maybeUpdateThreadTitleFromMessage(activeThreadId: string, text: string) {
    if (!userId) return;
    const existing = chatThreads.find((thread) => thread.id === activeThreadId);
    if (existing && !isGenericThreadTitle(existing.title)) return;

    const title = inferThreadTitle(text);
    setChatThreads((current) =>
      current.map((thread) => (thread.id === activeThreadId ? { ...thread, title } : thread)),
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("chat_threads")
      .update({ title })
      .eq("id", activeThreadId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to update chat thread title", error);
    }
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
      // Any key added here must also be added to the metadata object in `updateDraftState` below,
      // which rewrites this whole object field by field. Omitting it there silently drops the value.
      reasoning: message.reasoning ?? null,
      quota: message.quota ?? null,
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
    touchThreadPreview(threadId, savedMessage);
    if (savedMessage.role === "user") {
      void maybeUpdateThreadTitleFromMessage(threadId, savedMessage.text);
    }
    return savedMessage;
  }

  async function addSystemStatus(text: string, execution: ExecutionItem, actions?: AssistantAction[]) {
    await saveMessage({ role: "system", text, kind: "status", execution, actions });
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
          // This update replaces `metadata` wholesale rather than patching it, so every field
          // `saveMessage` writes has to be repeated here or confirming a draft erases it.
          reasoning: target.reasoning ?? null,
          quota: target.quota ?? null,
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
          locale,
        }),
      })) as CryptoResearchResult;

      await saveMessage({
        role: "assistant",
        text: result.assistantText,
        provider: "asksurf",
        citations: result.citations ?? [],
        model: result.model,
        surfMode: result.surfMode ?? surfMode,
        effort: normalizeSurfEffort(result.effort ?? effort),
        durationMs: result.durationMs,
        reasoning: result.reasoning,
        quota: result.quota,
      });
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") {
        if (timedOut) {
          await saveMessage({
            role: "assistant",
            text: `Research timed out after ${Math.round(surfClientTimeoutMs(surfMode) / 1000)} seconds.`,
            provider: "asksurf",
            surfMode,
            effort,
          });
        }
        return;
      }

      const message = error instanceof Error ? error.message : "Research failed";
      await saveMessage({
        role: "assistant",
        text: (error as { code?: string })?.code === "AI_QUOTA_EXHAUSTED" ? t("ai.quotaExhausted") : t("asksurf.failed", { message }),
        provider: "asksurf",
        surfMode,
        effort,
        quota: normalizeAiQuota((error as { data?: { quota?: unknown } })?.data?.quota),
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
          reasoning: result.reasoning,
          quota: result.quota,
        });
        setActiveDraftId(previewMessage?.id ?? null);
        return;
      }

      await saveMessage({
        role: "assistant",
        text: result.assistantText || t("ai.needsMoreInfo"),
        provider: "openai",
        model: result.modelProfile,
        reasoning: result.reasoning,
        quota: result.quota,
      });
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") {
        return;
      }

      const message = error instanceof Error ? error.message : "AI command parsing failed";
      await saveMessage({
        role: "assistant",
        text: (error as { code?: string })?.code === "AI_QUOTA_EXHAUSTED"
          ? t("ai.quotaExhausted")
          : looksLikeResearchQuestion(value)
          ? t("ai.researchModeHint")
          : t("ai.unhandled", { message }),
        provider: "openai",
        quota: normalizeAiQuota((error as { data?: { quota?: unknown } })?.data?.quota),
        actions: looksLikeResearchQuestion(value)
          ? [
              {
                kind: "switch_to_asksurf",
                label: t("asksurf.askButton"),
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
      chainFilter: draft.fields.chain || undefined,
      gateway: {
        network: "Circle Gateway testnets",
        rail: "Circle Gateway",
        mode: "real",
      },
    };
  }

  function resultText(draft: ParsedCommand, result: any) {
    if (draft.command === "link") {
      const address = result?.externalWallet?.wallet_address;
      return address ? t("runtime.linkedMetamask", { address }) : t("runtime.linkedMetamaskNoAddress");
    }

    if (draft.command === "fund") {
      return t("runtime.fundSuccess", {
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
          : t("bridge.myWallet");
      const sourceDebit = Number(result?.sourceDebit ?? 0);
      const bridgeFee = Number(result?.estimatedFeeTotal ?? 0);
      const sourceChain = result?.sourceChain ?? draft.fields.sourceChain;
      const destinationChain = result?.destinationChain ?? draft.fields.destinationChain;
      const sourceMeta = getChainMeta(sourceChain);
      const destinationMeta = getChainMeta(destinationChain);
      const sourceGasSymbol = sourceMeta?.nativeSymbol ?? "ETH";
      return [
        t("bridge.success", {
          source: sourceMeta?.label ?? sourceChain,
          destination: destinationMeta?.label ?? destinationChain,
        }),
        `${t("bridge.recipient")}: ${recipientLabel}`,
        t("bridge.recipientReceives", { amount: formatDecimalAmount(result?.amount ?? draft.fields.amount) }),
        sourceDebit > 0 ? t("bridge.sourceSpend", { amount: formatDecimalAmount(sourceDebit) }) : "",
        bridgeFee > 0 ? t("bridge.bridgeFees", { amount: formatDecimalAmount(bridgeFee) }) : "",
        t("bridge.sourceGas", { symbol: sourceGasSymbol, chain: sourceMeta?.label ?? sourceChain }),
        result?.mintMode === "manual_mint"
          ? t("bridge.destinationGasManual", {
              symbol: destinationMeta?.nativeSymbol ?? "native",
              chain: destinationMeta?.label ?? destinationChain,
            })
          : t("bridge.destinationGasForwarder"),
        result?.sourceTxHash ? t("bridge.sourceTx", { hash: result.sourceTxHash }) : "",
        result?.mintTxHash ? t("bridge.mintTx", { hash: result.mintTxHash }) : "",
        result?.transferId ? t("bridge.transferId", { id: result.transferId }) : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (draft.command === "swap") {
      return [
        `Swap success: ${result.amountIn ?? draft.fields.amount} ${result.tokenIn ?? draft.fields.tokenIn} -> ${result.tokenOut ?? draft.fields.tokenOut}`,
        `Estimated receive: ${formatDecimalAmount(result.estimatedAmountOut, 8)} ${result.tokenOut ?? draft.fields.tokenOut}`,
        `Minimum receive: ${formatDecimalAmount(result.minimumAmountOut, 8)} ${result.tokenOut ?? draft.fields.tokenOut}`,
        `Route: ${(result.route ?? []).join(" -> ")}`,
        result.approvalTxHash ? `Approve tx: ${result.approvalTxHash}` : "",
        result.txHash ? `Swap tx: ${result.txHash}` : "",
        result.proofTxHash ? `Payna proof: ${result.proofTxHash}` : "",
      ].filter(Boolean).join("\n");
    }

    if (draft.command === "wallet") {
      if (draft.fields.action === "create") {
        const wallet = result?.wallets?.[0];
        const address = wallet?.address ?? wallet?.wallet_address;
        const alreadyExists = String(result?.message ?? "").toLowerCase().includes("already exists");

        return address
          ? alreadyExists
            ? t("runtime.walletExists", { address })
            : t("runtime.walletReady", { address })
          : t("runtime.walletReadyNoAddress");
      }
      if (draft.fields.action === "balance") {
        const chain = draft.fields.chain;
        const total = totalBalanceSource(result?.balances ?? [], "wallet", chain);
        const partial = partialBalanceSuffix(result, t, "wallet", chain);

        return chain
          ? t("runtime.walletBalance", { chain, amount: formatDecimalAmount(total) }) + partial
          : t("runtime.walletBalanceAll", { amount: formatDecimalAmount(total) }) + partial;
      }
      return result?.hasWallet
        ? t("runtime.walletActive", { address: result.scaWallet?.address ?? result.scaWallet?.wallet_address })
        : t("runtime.walletMissing");
    }

    if (draft.command === "balance") {
      return balanceBreakdownText(result, t, draft.fields.chain || undefined);
    }

    if (draft.command === "deposit") {
      if (result?.status === "pending_gateway_finality") {
        return t("runtime.depositPending", { amount: result.amount, chain: result.chain });
      }
      return t("runtime.depositSuccess", { amount: result.amount, chain: result.chain });
    }

    if (draft.command === "withdraw") {
      const fee = Number(result?.estimatedGatewayFee ?? 0);
      const feeText = fee > 0 ? ` Fee: ${formatDecimalAmount(fee)} USDC.` : "";
      return t("runtime.withdrawSuccess", { amount: result.amount, chain: result.chain, fee: feeText });
    }

    function gatewayFeeText(transfer: any) {
      const amount = Number(transfer?.amount ?? 0);
      const estimatedFee = Number(transfer?.estimatedGatewayFee ?? transfer?.fees?.total ?? 0);
      const required = Number(transfer?.requiredGatewayBalance ?? amount + estimatedFee);
      const txRef = transfer?.mintTxHash ?? transfer?.txHash ?? transfer?.transferId;
      const manualHint =
        transfer?.forwarding
          ? t("runtime.gatewayFeeAutoHint")
          : t("runtime.gatewayFeeManualHint");

      if (!amount && !estimatedFee) {
        return txRef ? `ID: ${txRef}\nMode: ${manualHint}` : `Mode: ${manualHint}`;
      }

      const feeLine =
        estimatedFee > 0
          ? `${formatDecimalAmount(estimatedFee)} USDC`
          : t("runtime.gatewayNoBreakdown");

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
        ? t("runtime.autoDeposit", { amount: result.autoDepositedAmount })
        : "";
      const forwarding = result.forwarding
        ? t("runtime.forwardingMint")
        : "";
      return [
        t("runtime.transferSuccess", { source: result.sourceChain, destination: result.destinationChain }),
        autoDeposit.trim(),
        forwarding.trim(),
        gatewayFeeText(result),
      ].filter(Boolean).join("\n");
    }

    if (draft.command === "pay") {
      const payment = result.payment;
      const recipient = payment?.recipient?.label ?? draft.fields.recipient;
      const forwarding = result.transfer?.forwarding ? t("runtime.forwardingMint") : "";
      return [
        `Paid ${payment?.amount ?? draft.fields.amount} USDC to ${recipient} on ${payment?.destinationChain}`,
        forwarding.trim(),
        gatewayFeeText(result.transfer),
      ].filter(Boolean).join("\n");
    }

    if (draft.command === "request") {
      return t("runtime.paymentRequestCreated", {
        url: result.paymentUrl,
        qr: result.qrImageUrl ? ` · QR: ${result.qrImageUrl}` : "",
      });
    }

    if (draft.command === "payroll") {
      const results = result.results ?? [];
      const successCount = results.filter((item: any) => item.status === "success").length;
      return t("runtime.payrollResult", { status: result.status, success: successCount, total: results.length });
    }

    if (draft.command === "contacts") {
      if (draft.fields.action === "list") {
        return t("runtime.contactsCount", { count: (result.contacts ?? []).length });
      }
      const resolution = result.resolution === "internal" ? "internal Payna user" : "external wallet";
      const name = result.contact?.display_name ?? draft.fields.name;
      return result.warning?.message
        ? t("runtime.contactSavedWarning", { name, resolution, warning: result.warning.message })
        : t("runtime.contactSaved", { name, resolution });
    }

    if (draft.command === "gas") {
      const sca = result?.wallets?.sca;
      const signer = result?.wallets?.gatewaySigner;

      if (sca || signer || result?.gatewaySignerError) {
        const scaText = sca
          ? sca.hasGas
            ? t("runtime.gasScaHas", { balance: formatNativeGasBalance(sca.balance, result.chain) })
            : t("runtime.gasScaMissing", { address: sca.address })
          : t("runtime.gasScaNoWallet");
        const signerText = signer
          ? signer.hasGas
            ? t("runtime.gasSignerHas", { balance: formatNativeGasBalance(signer.balance, result.chain) })
            : t("runtime.gasSignerMissing", { address: signer.address })
          : t("runtime.gasSignerUnknown", { error: result?.gatewaySignerError ? `: ${result.gatewaySignerError}` : "" });

        return `${result.chain}: ${scaText}. ${signerText}.`;
      }

      return result?.hasGas
        ? t("runtime.gasHas", { chain: result.chain, balance: formatNativeGasBalance(result.balance, result.chain) })
        : t("runtime.gasMissing", { chain: result.chain, address: result.address });
    }

    if (draft.command === "gateway") {
      if (draft.fields.action === "balance") {
        const chain = draft.fields.chain;
        const balances = result?.balances ?? [];
        const total = totalBalanceSource(balances, "gateway", chain);
        const partial = partialBalanceSuffix(result, t, "gateway", chain);

        if (!chain && Array.isArray(balances) && balances.length) {
          const lines = balances
            .filter((row) => row?.source === "gateway")
            .map((row) => `${row.chain}: ${formatDecimalAmount(row.amount ?? "0")} USDC`);
          if (lines.length) {
            return `${t("runtime.gatewayBalanceResultAll", { amount: formatDecimalAmount(total) })}${partial}\n${lines.join("\n")}`;
          }
        }

        return chain
          ? t("runtime.gatewayBalanceResult", { chain, amount: formatDecimalAmount(total) }) + partial
          : t("runtime.gatewayBalanceResultAll", { amount: formatDecimalAmount(total) }) + partial;
      }
      return `Gateway online. Domains: ${(result?.domains ?? []).length}.`;
    }

    if (draft.command === "history") {
      const rows = Array.isArray(result) ? result : [];
      if (!rows.length) return t("runtime.historyEmpty");
      return t("runtime.historySummary", {
        count: rows.length,
        type: rows[0].tx_type,
        amount: rows[0].amount,
        chain: rows[0].chain,
      });
    }

    return t("runtime.commandDone");
  }

  async function runForegroundCommand(draft: ParsedCommand) {
    if (draft.missingFields.length) return;
    shouldAutoScrollRef.current = true;

    const execution = createExecution(draft);
    const title =
      draft.command === "bridge"
        ? t("bridge.title", {
            amount: draft.fields.amount,
            source: draft.fields.sourceChain,
            destination: draft.fields.destinationChain,
          })
        : draft.command === "transfer"
          ? t("transfer.title", {
              amount: draft.fields.amount,
              source: draft.fields.sourceChain,
              destination: draft.fields.destinationChain,
            })
          : execution.title;
    setActiveDraftId(null);

    const running = { ...execution, status: "running" as const };
    const waiting = { ...execution, status: "waiting_gateway" as const };

    if (usesGatewayPipeline(draft)) {
      setExecutions((current) => [execution, ...current]);
      await addSystemStatus(t("runtime.queued", { title }), execution);

      setExecutions((current) =>
        current.map((item) => (item.id === execution.id ? running : item)),
      );
      await addSystemStatus(t("runtime.running", { title }), running);

      setExecutions((current) =>
        current.map((item) => (item.id === execution.id ? waiting : item)),
      );
      await addSystemStatus(t("runtime.gateway", { title }), waiting);
    } else {
      setExecutions((current) => [running, ...current]);
      await addSystemStatus(t("runtime.checking", { title }), running);
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

      if (usesGatewayPipeline(draft) || draft.command === "balance" || draft.command === "bridge" || draft.command === "swap") {
        void refreshBalance();
        window.setTimeout(() => void refreshBalance(), 5_000);
        window.setTimeout(() => void refreshBalance(), 15_000);
        window.dispatchEvent(new Event("ra:balance-changed"));
      }
    } catch (error) {
      const raw = error as { code?: string | number; mintPending?: boolean };
      const message = error instanceof Error ? error.message : "Command failed";
      const errorCode = raw?.code;
      const waitingGateway = errorCode === "GATEWAY_FINALITY_PENDING";
      const failed = {
        ...execution,
        status: waitingGateway ? "waiting_gateway" as const : "failed" as const,
        error: message,
      };
      setExecutions((current) =>
        current.map((item) => (item.id === execution.id ? failed : item)),
      );

      // Retry is only offered when nothing moved on-chain: a rejected signature
      // (4001) or a stuck MetaMask request (-32002). Once a bridge burn landed,
      // `mintPending` is set and re-running would burn a second time.
      const canRetrySafely =
        !waitingGateway && !raw?.mintPending && (errorCode === 4001 || errorCode === -32002);

      await addSystemStatus(
        message,
        failed,
        canRetrySafely
          ? [{ kind: "retry_command" as const, label: t("action.retryCommand"), draft }]
          : undefined,
      );
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
        text: t("runtime.chatNotReady"),
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

  function mappedMessagesFromRows(rows: ChatMessageRow[]) {
    return rows.map((row) => ({
      ...mapRowToMessage(row),
      createdAt: row.created_at,
    }));
  }

  async function loadChatThreads(nextUserId = userId) {
    if (!nextUserId) return;

    setIsLoadingThreads(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("chat_threads")
      .select("id,user_id,title,status,created_at,updated_at,last_message_preview,last_message_at,last_message_role,last_message_kind,message_count")
      .eq("user_id", nextUserId)
      .eq("status", "active")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(THREAD_LIST_PAGE_SIZE);

    if (error) {
      console.error("Failed to load chat threads", error);
      setIsLoadingThreads(false);
      return;
    }

    setChatThreads((data ?? []) as ChatThreadSummary[]);
    setIsLoadingThreads(false);
  }

  async function loadThreadMessages(nextThreadId: string, nextUserId = userId) {
    if (!nextUserId) return;

    shouldAutoScrollRef.current = true;
    setIsLoadingHistory(true);
    setThreadId(nextThreadId);
    setMessages([]);
    setActiveDraftId(null);
    previousScrollHeightRef.current = null;
    skipNextAutoScrollRef.current = false;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("thread_id", nextThreadId)
      .eq("user_id", nextUserId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);

    if (error) {
      console.error("Failed to load chat messages", error);
      setIsLoadingHistory(false);
      return;
    }

    const recentRows = ((data ?? []) as ChatMessageRow[]).reverse();
    const mappedMessages = mappedMessagesFromRows(recentRows);
    setHasOlderMessages(recentRows.length === MESSAGE_PAGE_SIZE);
    setMessages(mappedMessages);
    setActiveDraftId(
      [...mappedMessages]
        .reverse()
        .find((message) => message.kind === "preview" && message.draftState === "active")
        ?.id ?? null,
    );
    setIsLoadingHistory(false);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("thread", nextThreadId);
    window.history.replaceState(null, "", nextUrl.toString());
  }

  async function createNewChatThread() {
    if (!userId || isLoadingThreads) return;

    shouldAutoScrollRef.current = true;
    setIsLoadingThreads(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: userId, title: "New chat" })
      .select("*")
      .single();

    if (error || !data) {
      console.error("Failed to create chat thread", error);
      setIsLoadingThreads(false);
      return;
    }

    const createdThread = data as ChatThreadSummary;
    setChatThreads((current) => [createdThread, ...current]);
    setThreadId(createdThread.id);
    setMessages([]);
    setHasOlderMessages(false);
    setActiveDraftId(null);
    setIsLoadingHistory(false);
    setIsThreadListOpen(false);
    setIsLoadingThreads(false);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("thread", createdThread.id);
    window.history.replaceState(null, "", nextUrl.toString());
  }

  async function renameChatThread(targetThreadId: string, nextTitle: string) {
    const title = nextTitle.trim();
    if (!userId || !title) return;

    // Optimistic: the sidebar is the only reader of this title, so a failed write just
    // reverts on the next loadChatThreads() rather than corrupting anything.
    setChatThreads((current) =>
      current.map((thread) => (thread.id === targetThreadId ? { ...thread, title } : thread)),
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("chat_threads")
      .update({ title })
      .eq("id", targetThreadId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to rename chat thread", error);
      void loadChatThreads();
    }
  }

  async function deleteChatThread(targetThreadId: string) {
    if (!userId) return;

    const supabase = createClient();
    // Archive rather than delete. Threads carry the record of real transactions — the
    // status message with a tx hash lives in chat_messages — so hard-deleting a thread
    // would destroy the only in-app trace of money that actually moved.
    const { error } = await supabase
      .from("chat_threads")
      .update({ status: "archived" })
      .eq("id", targetThreadId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to delete chat thread", error);
      return;
    }

    const remaining = chatThreads.filter((thread) => thread.id !== targetThreadId);
    setChatThreads(remaining);

    if (targetThreadId !== threadId) return;

    // The open thread just vanished. Fall back to the next most recent one, or start a
    // fresh thread so the composer is never pointing at an archived id.
    if (remaining.length) {
      await loadThreadMessages(remaining[0].id);
      return;
    }

    await createNewChatThread();
  }

  function updateScrollMetricsFromViewport(viewport: HTMLDivElement) {
    const nextMetrics = {
      top: Math.round(viewport.scrollTop),
      height: viewport.scrollHeight,
      client: viewport.clientHeight,
    };
    const previousMetrics = scrollMetricsRef.current;

    if (
      previousMetrics.top === nextMetrics.top &&
      previousMetrics.height === nextMetrics.height &&
      previousMetrics.client === nextMetrics.client
    ) {
      return;
    }

    scrollMetricsRef.current = nextMetrics;
    setScrollMetrics(nextMetrics);
  }

  function scheduleScrollMetricsUpdate() {
    if (scrollMetricsFrameRef.current !== null) return;

    scrollMetricsFrameRef.current = window.requestAnimationFrame(() => {
      scrollMetricsFrameRef.current = null;
      const viewport = viewportRef.current;
      if (!viewport) return;
      updateScrollMetricsFromViewport(viewport);
    });
  }

  function handleViewportScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    shouldAutoScrollRef.current = isNearViewportBottom(viewport);
    scheduleScrollMetricsUpdate();
    // Single entry point for pagination. The wheel handler used to fire this too, which
    // meant one gesture could start two loads and land two anchor restores on top of
    // each other — the position jump users were seeing when scrolling up.
    if (viewport.scrollTop < 48) {
      void loadOlderMessages();
    }
  }

  function scrollToLatest() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }

  async function submitValue(value: string, options?: { forceAskSurf?: boolean }) {
    shouldAutoScrollRef.current = true;
    await saveMessage({ role: "user", text: value });
    setInput("");
    setHistoryIndex(null);
    draftInputBeforeHistoryRef.current = "";
    setSuggestionChips([]);

    const recentMessages = messages.slice(-8).map((message) => ({
      role: message.role,
      text: message.text,
    }));

    if (!value.startsWith("/") && (options?.forceAskSurf || (chatMode === "asksurf" && !looksLikePayCmdAction(value)))) {
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

    const parsed = parsePayCmd(value, locale);

    if (parsed.missingFields.length) {
      await saveMessage({
        role: "assistant",
        text: missingFieldQuestion(parsed.missingFields[0], t),
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

  // Runs a follow-up chip from a finished execution. Goes through submitValue rather than
  // runCommand so the chip behaves exactly like the user typing it: the command lands in the
  // transcript, and anything needing confirmation still gets its preview card. executionFollowUps
  // only offers read-only commands today, but routing through the same path means that stays true
  // by construction rather than by remembering.
  function submitSuggestedCommand(command: string) {
    const value = command.trim();
    if (!value || submitLockRef.current) return;

    void (async () => {
      submitLockRef.current = true;
      setIsSubmitting(true);
      // A slash command must not be rerouted into research by a leftover AskSurf mode.
      setChatMode("paycmd");

      try {
        await submitValue(value);
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    })();
  }

  // Re-runs a command that failed before any on-chain state changed. The retry action
  // is only attached to such failures (see runForegroundCommand's catch), so this never
  // re-submits a bridge whose burn already landed.
  function retryCommand(draft: ParsedCommand) {
    if (submitLockRef.current) return;

    void (async () => {
      submitLockRef.current = true;
      setIsSubmitting(true);
      try {
        await runCommand(draft);
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

  // A deposit's card sits at `waiting_gateway` for the ~10 minutes Circle needs, and nothing here
  // ever revisited it: `saveMessage`'s id is dropped by `addSystemStatus`, so the writer keeps no
  // handle on the row it wrote. `/api/gateway/deposit/sync` persists the flip and then fires this
  // event with the settled deposits, so the open thread repaints in place instead of waiting for
  // a reload. Join on `txHash` — `deposit/route.ts` writes the same string into the execution
  // metadata and into `transaction_history`.
  useEffect(() => {
    function handleSettledDeposits(event: Event) {
      const settled = (event as CustomEvent).detail;
      if (!Array.isArray(settled)) return;

      const bodyByTxHash = new Map<string, string>();
      for (const item of settled) {
        if (typeof item?.txHash === "string" && typeof item?.message === "string") {
          bodyByTxHash.set(item.txHash, item.message);
        }
      }

      if (bodyByTxHash.size === 0) return;

      setMessages((current) =>
        current.map((message) => {
          const execution = message.execution;
          // Only the final card carries `txHash`; the queued/running lines above it are history
          // and keep their own status.
          if (!execution || execution.status !== "waiting_gateway" || !execution.txHash) {
            return message;
          }

          const body = bodyByTxHash.get(execution.txHash);
          if (!body) return message;

          // Swapping the text matters as much as the status: `buildExecutionReceipt` has no
          // deposit branch, so this string renders verbatim and would otherwise pair a green
          // check with "waiting for Circle Gateway finality".
          return { ...message, text: body, execution: { ...execution, status: "success" } };
        }),
      );
    }

    window.addEventListener("ra:gateway-deposit-settled", handleSettledDeposits);
    return () => window.removeEventListener("ra:gateway-deposit-settled", handleSettledDeposits);
  }, []);

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

    // Hold the user's reading position after older messages are prepended above it.
    viewport.scrollTop = viewport.scrollHeight - previousHeight;
    previousScrollHeightRef.current = null;
    // Explicit handoff to the auto-scroll effect below. It used to infer "a restore just
    // happened" from previousScrollHeightRef, but this effect nulls that ref before the
    // passive effect reads it, so a prepend arriving in the same commit as an append
    // could still scroll to the bottom and undo the restore.
    didRestoreAnchorRef.current = true;
  }, [messages.length, activeAiProvider]);

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
    if (didRestoreAnchorRef.current) {
      didRestoreAnchorRef.current = false;
      return;
    }
    if (!shouldAutoScrollRef.current) return;
    window.requestAnimationFrame(scrollToLatest);
  }, [messages.length, activeAiProvider]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateScrollMetricsFromViewport(viewport);
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (scrollMetricsFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollMetricsFrameRef.current);
      }
    };
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

      const requestedThreadId = new URLSearchParams(window.location.search).get("thread");
      let requestedThread: ChatThreadSummary | null = null;

      if (requestedThreadId) {
        const { data, error } = await supabase
          .from("chat_threads")
          .select("*")
          .eq("id", requestedThreadId)
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (!error && data) {
          requestedThread = data as ChatThreadSummary;
        }
      }

      const { data: existingThread, error: threadError } = requestedThread
        ? { data: requestedThread, error: null }
        : await supabase
            .from("chat_threads")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("last_message_at", { ascending: false, nullsFirst: false })
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
          .insert({ user_id: user.id, title: "Payna chat" })
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
      void loadChatThreads(user.id);

      const { data: recentMessages, error: messagesError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", activeThreadId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

      if (messagesError) {
        console.error("Failed to load chat messages", messagesError);
        setIsLoadingHistory(false);
        return;
      }

      const recentRows = ((recentMessages ?? []) as ChatMessageRow[]).reverse();
      const mappedMessages = mappedMessagesFromRows(recentRows);
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
    <PayCmdShell
      sidebarPanel={
        <ChatThreadSidebar
          threads={chatThreads}
          activeThreadId={threadId}
          locale={locale}
          isLoading={isLoadingThreads}
          canCreate={Boolean(userId) && !isLoadingThreads}
          onSelect={(nextThreadId) => {
            if (nextThreadId === threadId) return;
            void loadThreadMessages(nextThreadId);
          }}
          onCreate={createNewChatThread}
          onRename={(nextThreadId, title) => void renameChatThread(nextThreadId, title)}
          onDelete={(nextThreadId) => void deleteChatThread(nextThreadId)}
        />
      }
    >
      <div className="payna-shell-bg relative flex h-full min-h-0 flex-col">
        {showSlowAskSurfNotice ? (
          <SlowAskSurfNotice
            mode={activeAskSurfMode}
            effort={activeAskSurfEffort}
            elapsedMs={activeAskSurfElapsedMs || undefined}
            onDismiss={() => setIsSlowAskSurfNoticeDismissed(true)}
          />
        ) : null}
        <div className="shrink-0 border-b border-border/50 bg-background/35 px-3 py-2 backdrop-blur-xl md:px-6">
          <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {t("chat.workspace")}
              </p>
              <p className="truncate text-sm text-foreground">
                {chatThreads.find((thread) => thread.id === threadId)?.title ?? t("chat.untitled")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Desktop-only duplicate: the sidebar thread list covers this on lg+, but the
                  sidebar is `hidden lg:flex`, so on mobile this dropdown is the only way to
                  reach past conversations. */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-full lg:hidden"
                onClick={() => setIsThreadListOpen((current) => !current)}
              >
                <History className="h-4 w-4" />
                {t("chat.history")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-2 rounded-full"
                onClick={createNewChatThread}
                disabled={!userId || isLoadingThreads}
              >
                <Plus className="h-4 w-4" />
                {t("chat.newChat")}
              </Button>
            </div>
            {isThreadListOpen ? (
              <ChatThreadMenu
                threads={chatThreads}
                activeThreadId={threadId}
                locale={locale}
                isLoading={isLoadingThreads}
                onSelect={(nextThreadId) => {
                  setIsThreadListOpen(false);
                  void loadThreadMessages(nextThreadId);
                }}
              />
            ) : null}
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <div
            ref={viewportRef}
            onScroll={handleViewportScroll}
            className="paycmd-chat-scrollbar h-full overflow-y-scroll scroll-pb-44 px-3 py-5 pb-40 md:px-6 md:pb-48"
          >
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
              {isLoadingHistory ? (
                <div className="payna-glass mx-auto rounded-full px-4 py-2 text-sm text-muted-foreground">
                  Loading chat history...
                </div>
              ) : messages.length ? (
                <>
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      activeDraftId={activeDraftId}
                      isLatestExecutionStatus={
                        message.kind === "status" && message.execution
                          ? latestStatusMessageIdByExecution[message.execution.id] === message.id
                          : false
                      }
                      isLastMessage={index === messages.length - 1}
                      onConfirm={confirmDraft}
                      onCancel={cancelDraft}
                      onRelatedQuestion={submitRelatedQuestion}
                      onRetryCommand={retryCommand}
                      onSuggestedCommand={submitSuggestedCommand}
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

          <div className="pointer-events-none absolute bottom-5 right-2 top-5 w-2 rounded-full bg-border/45 dark:bg-border/45">
            <div
              className="absolute left-0 w-2 rounded-full bg-primary shadow-[0_0_18px_rgba(99,244,200,.34)] transition-[top,height]"
              style={{
                height: `${scrollThumbHeight}%`,
                top: `${scrollThumbTop}%`,
              }}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-card/65 px-3 py-3 backdrop-blur-xl md:px-6">
          <div className="mx-auto w-full max-w-3xl">
            {showPalette ? <CommandPalette query={input} onSelect={selectCommand} /> : null}
            {suggestionChips.length ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {suggestionChips.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="payna-subtle-lift rounded-full border bg-background/75 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition hover:border-primary hover:text-foreground"
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
              isBusy={isInputBusy}
              onChatModeChange={setChatMode}
              onSurfModeChange={(mode) => {
                setSelectedSurfMode(mode);
                if (mode === "instant") setSelectedSurfEffort("standard");
              }}
              onSurfEffortChange={setSelectedSurfEffort}
            />

            <form
              className="payna-composer flex items-center gap-2 rounded-[1.35rem] p-2"
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
                    ? t("chat.placeholderAskSurf")
                    : activeAiProvider === "openai"
                      ? t("chat.placeholderOpenAI")
                      : t("chat.placeholderDefault")
                }
                className="min-w-0 flex-1 border-0 bg-transparent text-[15px] shadow-none focus-visible:ring-0"
                disabled={isInputBusy}
              />
              <Button type="submit" size="icon" aria-label="Send command" disabled={isInputBusy || !input.trim()} className="h-11 w-11 shrink-0 rounded-2xl">
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

// Sidebar twin of ChatThreadMenu. The dropdown stays for the mobile header, where there is
// no sidebar to dock into; on desktop this is always visible so history and "New chat" are
// reachable without discovering a button buried in the chat header.
function ChatThreadSidebar({
  threads,
  activeThreadId,
  locale,
  isLoading,
  canCreate,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  threads: ChatThreadSummary[];
  activeThreadId: string | null;
  locale: string;
  isLoading: boolean;
  canCreate: boolean;
  onSelect: (threadId: string) => void;
  onCreate: () => void;
  onRename: (threadId: string, title: string) => void;
  onDelete: (threadId: string) => void;
}) {
  const { t } = useI18n();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  function beginRename(thread: ChatThreadSummary) {
    setRenamingId(thread.id);
    setDraftTitle(thread.title || "");
  }

  function commitRename() {
    if (renamingId && draftTitle.trim()) {
      onRename(renamingId, draftTitle);
    }
    setRenamingId(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 pb-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          {t("chat.history")}
        </div>
        <span className="text-[11px] text-muted-foreground">{threads.length}</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mx-1 mb-2 justify-start gap-2 rounded-xl"
        onClick={onCreate}
        disabled={!canCreate}
      >
        <Plus className="h-4 w-4" />
        {t("chat.newChat")}
      </Button>
      <div className="paycmd-command-palette-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">{t("chat.loadingThreads")}</div>
        ) : threads.length ? (
          threads.map((thread) => {
            const isActive = thread.id === activeThreadId;

            if (renamingId === thread.id) {
              return (
                <div key={thread.id} className="rounded-xl bg-accent/50 p-1.5">
                  <Input
                    autoFocus
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitRename();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setRenamingId(null);
                      }
                    }}
                    aria-label={t("chat.rename")}
                    className="h-8 bg-background/80 text-sm"
                  />
                </div>
              );
            }

            return (
              // A row, not a <button>: the rename/delete controls are themselves buttons and
              // cannot legally nest inside one. The title stays a real button so keyboard
              // and screen-reader users still get a single activatable target per thread.
              <div
                key={thread.id}
                className={`group/thread relative rounded-xl transition ${
                  isActive
                    ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
                }`}
              >
                <button
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  className="w-full rounded-xl px-3 py-2 pr-16 text-left"
                  onClick={() => onSelect(thread.id)}
                >
                  <div className="truncate text-sm font-medium">{thread.title || t("chat.untitled")}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{thread.last_message_preview || t("chat.emptyThread")}</span>
                    <span className="shrink-0">
                      {formatThreadTimestamp(thread.last_message_at ?? thread.updated_at, locale)}
                    </span>
                  </div>
                </button>
                {/* Hover-only on pointer devices, but focus-within keeps them reachable by
                    keyboard, and they stay visible on the active thread. */}
                <div
                  className={`absolute right-1.5 top-1.5 flex items-center gap-0.5 transition group-hover/thread:opacity-100 group-focus-within/thread:opacity-100 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <button
                    type="button"
                    aria-label={`${t("chat.rename")}: ${thread.title || t("chat.untitled")}`}
                    className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-background/80 hover:text-foreground"
                    onClick={() => beginRename(thread)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${t("chat.delete")}: ${thread.title || t("chat.untitled")}`}
                    className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(t("chat.deleteConfirm"))) onDelete(thread.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-3 py-3 text-xs text-muted-foreground">{t("chat.historyEmpty")}</div>
        )}
      </div>
    </div>
  );
}

function ChatThreadMenu({
  threads,
  activeThreadId,
  locale,
  isLoading,
  onSelect,
}: {
  threads: ChatThreadSummary[];
  activeThreadId: string | null;
  locale: string;
  isLoading: boolean;
  onSelect: (threadId: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="payna-glass absolute right-0 top-full z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border/70 shadow-2xl">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="h-4 w-4 text-primary" />
          {t("chat.history")}
        </div>
        <span className="text-xs text-muted-foreground">{threads.length}</span>
      </div>
      <div className="max-h-96 overflow-y-auto p-2">
        {isLoading ? (
          <div className="rounded-xl px-3 py-4 text-sm text-muted-foreground">{t("chat.loadingThreads")}</div>
        ) : threads.length ? (
          threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <button
                key={thread.id}
                type="button"
                className={`w-full rounded-xl px-3 py-3 text-left transition ${
                  isActive
                    ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
                onClick={() => onSelect(thread.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {thread.title || t("chat.untitled")}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatThreadTimestamp(thread.last_message_at ?? thread.updated_at, locale)}
                  </span>
                </div>
                <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {thread.last_message_preview || t("chat.emptyThread")}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{t("chat.messageCount", { count: thread.message_count ?? 0 })}</span>
                  {isActive ? <span className="text-primary">{t("chat.currentThread")}</span> : null}
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-xl px-3 py-4 text-sm text-muted-foreground">{t("chat.historyEmpty")}</div>
        )}
      </div>
    </div>
  );
}

function ComposerModeControls({
  chatMode,
  surfMode,
  surfEffort,
  isBusy,
  onChatModeChange,
  onSurfModeChange,
  onSurfEffortChange,
}: {
  chatMode: ChatMode;
  surfMode: SurfMode;
  surfEffort: SurfEffort;
  isBusy: boolean;
  onChatModeChange: (mode: ChatMode) => void;
  onSurfModeChange: (mode: SurfMode) => void;
  onSurfEffortChange: (effort: SurfEffort) => void;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="inline-flex rounded-2xl border bg-background/70 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onChatModeChange("paycmd")}
          className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition ${
            chatMode === "paycmd"
              ? "bg-primary text-primary-foreground shadow-sm shadow-emerald-500/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Bot className="h-3.5 w-3.5" />
          Payna
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onChatModeChange("asksurf")}
          className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition ${
            chatMode === "asksurf"
              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-600"
              : "border border-emerald-400/45 bg-emerald-500/10 text-emerald-700 shadow-sm shadow-emerald-500/10 hover:bg-emerald-500/15 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
          }`}
        >
          <Waypoints className="h-3.5 w-3.5" />
          AskPayna
        </button>
      </div>

      {chatMode === "asksurf" ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-2xl border bg-background/70 p-1 shadow-sm backdrop-blur">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onSurfModeChange("instant")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition ${
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
              className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition ${
                surfMode === "research"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              Research
            </button>
          </div>
          <label className="flex h-10 items-center gap-1 rounded-2xl border bg-background/70 px-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
            Effort
            <select
              value={surfEffort}
              onChange={(event) => onSurfEffortChange(event.target.value as SurfEffort)}
              className="max-w-[112px] bg-transparent text-xs font-medium text-foreground outline-none disabled:text-muted-foreground"
              aria-label="Research effort"
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
        <div className="flex h-10 items-center gap-1 rounded-2xl border bg-background/70 px-3 text-xs text-muted-foreground shadow-sm backdrop-blur" title="deepseek-v4-flash is the fixed command-router model">
          <Bot className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">DeepSeek Flash</span>
        </div>
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
  const { t } = useI18n();
  const normalizedQuery = normalizePaletteQuery(query);
  const filteredSections = commandTemplates
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!normalizedQuery) return true;

        const sample = item.sample.replace(/^\/+/, "").toLowerCase();
        const firstToken = sample.split(/\s+/)[0] ?? "";
        const searchable = `${sample} ${t(item.titleKey)} ${t(item.descriptionKey)}`.toLowerCase();

        return firstToken.startsWith(normalizedQuery) || searchable.includes(normalizedQuery);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="payna-glass mb-2 overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="text-sm font-medium">{t("commandPalette.commands")}</div>
        <div className="text-xs text-muted-foreground">
          {normalizedQuery ? t("commandPalette.filter", { query: normalizedQuery }) : t("commandPalette.fillSample")}
        </div>
      </div>
      <div className="paycmd-command-palette-scrollbar max-h-[42vh] overflow-y-auto p-2">
        {filteredSections.length ? (
          <div className="grid gap-3">
            {filteredSections.map((section) => (
            <section key={section.groupKey} className="space-y-2">
              <div className="px-1 text-xs font-semibold uppercase text-muted-foreground">
                {t(section.groupKey)}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.sample}
                      className="payna-subtle-lift group min-w-0 rounded-xl border bg-card/78 p-3 text-left backdrop-blur transition hover:border-primary hover:bg-accent/80"
                      onClick={() => onSelect(item.sample)}
                      type="button"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 rounded-lg border bg-background/80 p-1.5 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="flex min-w-0 items-center justify-between gap-2">
                            <span className="truncate font-medium">{t(item.titleKey)}</span>
                            <Badge
                              variant={item.badge === "confirm" ? "default" : "secondary"}
                              className="shrink-0 text-[10px]"
                            >
                              {item.badge}
                            </Badge>
                          </span>
                          <code className="block break-words rounded-lg bg-muted/80 px-2 py-1 text-xs text-foreground">
                            {item.sample}
                          </code>
                          <span className="block text-xs leading-5 text-muted-foreground">
                            {t(item.descriptionKey)}
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
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            {t("commandPalette.noMatch", { query: normalizedQuery })}
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
  isLastMessage,
  onConfirm,
  onCancel,
  onRelatedQuestion,
  onRetryCommand,
  onSuggestedCommand,
}: {
  message: ChatMessage;
  activeDraftId: string | null;
  isLatestExecutionStatus: boolean;
  // Distinct from isLatestExecutionStatus, which is per-execution: a transfer's success card stays
  // "latest" for that execution forever. Follow-up chips need "last thing in the thread" so they
  // do not pile up under every past transaction.
  isLastMessage: boolean;
  onConfirm: (messageId: string, draft: ParsedCommand) => void;
  onCancel: (messageId: string) => void;
  onRelatedQuestion: (question: string) => void;
  onRetryCommand: (draft: ParsedCommand) => void;
  onSuggestedCommand: (command: string) => void;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAskSurf = message.provider === "asksurf";
  const statusTone =
    message.kind === "status" && message.execution
      ? executionStatusTone(message.execution, isLatestExecutionStatus)
      : "";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`payna-message ${isAskSurf ? "max-w-[96%] md:max-w-[92%] lg:max-w-[88%]" : "max-w-[88%] md:max-w-[76%]"} rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground shadow-emerald-500/20"
            : isAskSurf
              ? "rounded-bl-md border border-emerald-400/25 bg-card/82 shadow-[0_18px_60px_rgba(0,0,0,.16)] backdrop-blur-xl"
            : statusTone
              ? statusTone
            : isSystem
              ? "rounded-bl-md border bg-accent/85 text-accent-foreground backdrop-blur"
              : "rounded-bl-md border bg-card/82 backdrop-blur-xl"
        }`}
      >
        {!isUser && message.provider ? (
          <ProviderBadge
            provider={message.provider}
            model={message.model}
            surfMode={message.surfMode}
            effort={message.effort}
            durationMs={message.durationMs}
            quota={message.quota}
          />
        ) : null}
        {/* Above the content branches rather than inside them, so one placement covers the research
            renderer, the plain-text branch, previews and statuses alike. */}
        {!isUser && message.reasoning ? <ReasoningDisclosure reasoning={message.reasoning} /> : null}
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
            showFollowUps={isLastMessage}
            onSuggestedCommand={onSuggestedCommand}
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
              <span className="block whitespace-pre-wrap break-words">{message.text}</span>
            )}
            {message.actions?.length ? (
              <AssistantActionBar
                actions={message.actions}
                onAskSurf={onRelatedQuestion}
                onRetry={onRetryCommand}
              />
            ) : null}
            {message.provider !== "asksurf" && message.citations?.length ? <CitationList citations={message.citations} /> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function executionStatusTone(execution: ExecutionItem, isLatest: boolean) {
  if (execution.status === "failed") {
    return "rounded-bl-md border border-destructive/40 bg-destructive/10 text-foreground";
  }

  if (execution.status === "success") {
    return "rounded-bl-md border border-emerald-400/45 bg-emerald-500/12 text-foreground";
  }

  if (isLatest || execution.status === "running" || execution.status === "waiting_gateway") {
    return "rounded-bl-md border border-border bg-muted/30 text-foreground";
  }

  return "rounded-bl-md border border-border bg-muted/20 text-foreground";
}

function AssistantActionBar({
  actions,
  onAskSurf,
  onRetry,
}: {
  actions: AssistantAction[];
  onAskSurf: (question: string) => void;
  onRetry: (draft: ParsedCommand) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t pt-3">
      {actions.map((action, index) =>
        action.kind === "retry_command" ? (
          <Button
            key={`retry_${action.draft.command}_${index}`}
            type="button"
            size="sm"
            variant="outline"
            className="border-amber-400/60 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
            onClick={() => onRetry(action.draft)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {action.label}
          </Button>
        ) : (
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
        ),
      )}
    </div>
  );
}

function ProviderBadge({
  provider,
  model,
  surfMode,
  effort,
  durationMs,
  quota,
}: {
  provider: AiProvider;
  model?: string;
  surfMode?: SurfMode;
  effort?: SurfEffort;
  durationMs?: number;
  quota?: AiQuota;
}) {
  const { t } = useI18n();
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
      {quota ? (
        <span className="text-muted-foreground">
          · {quota.unlimited ? t("ai.quotaUnlimited") : t("ai.quotaRemaining", { remaining: quota.remaining ?? 0, limit: quota.limit ?? 10 })}
        </span>
      ) : null}
    </div>
  );
}

// Native <details> rather than a custom toggle: it handles keyboard operation and announces its own
// expanded state, which a div with an onClick would need rebuilt by hand.
function ReasoningDisclosure({ reasoning }: { reasoning: string }) {
  const { t } = useI18n();

  return (
    <details className="mb-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-[11px] leading-5">
      <summary className="flex cursor-pointer select-none items-center gap-1.5 font-medium text-muted-foreground">
        <Brain className="h-3 w-3" />
        {t("chat.reasoning.toggle")}
      </summary>
      {/* Capped height with its own scroll: a trace runs to thousands of characters and would
          otherwise push the answer it belongs to off the screen. */}
      <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
        {reasoning}
      </div>
    </details>
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
  const { t } = useI18n();
  const { bodyText, relatedQuestions } = extractRelatedQuestions(text);
  // Build the anchor ids once and share them, so the nav links and the rendered heading ids can't drift.
  const outline = buildResearchOutline(bodyText, researchId);
  const sections = extractResearchSections(outline);

  return (
    <div className="space-y-4">
      {/* The second badge here used to read "Surf sources/charts requested". There is no chart
          renderer in this app, so it promised the user output that could never arrive. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-emerald-400/15 pb-2 text-[11px] text-muted-foreground">
        <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-300">
          {t("research.badge")}
        </span>
      </div>
      <ResearchEntityRail text={bodyText} citations={citations} />
      <div
        data-research-id={researchId}
        className={sections.length ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]" : ""}
      >
        <div className="min-w-0">
          <MarkdownContent text={bodyText} citations={citations} outline={outline} />
        </div>
        {sections.length ? <ResearchSectionNav researchId={researchId} sections={sections} /> : null}
      </div>
      {relatedQuestions.length ? (
        <RelatedQuestions questions={relatedQuestions} onSelect={onRelatedQuestion} />
      ) : null}
      {citations.length ? <AskSurfSourceList citations={citations} /> : null}
      {/* `bodyText`, not `text`: the Related Questions block is rendered as pills above, so copying
          or printing the raw `text` handed the user a trailing markdown list they never saw. */}
      <AskSurfResearchActions researchId={researchId} text={bodyText} />
    </div>
  );
}

type ResearchSection = {
  id: string;
  title: string;
  level: number;
};

// Superset of ResearchSection, so an outline can be handed straight to ResearchSectionNav.
type ResearchOutlineEntry = ResearchSection & {
  lineIndex: number;
};

function stripMarkdownDecorations(value: string) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

// Fold a heading down to bare ASCII lowercase so Vietnamese text survives both slugifying and
// comparison. NFD splits most Vietnamese vowels into base + combining mark, but `đ` (U+0111) is its
// own letter with no decomposition, so it needs the explicit map or it gets dropped like punctuation.
function normalizeHeadingText(value: string) {
  return stripMarkdownDecorations(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

function isRelatedQuestionsHeading(value: string) {
  const normalized = normalizeHeadingText(value).replace(/[:?]+$/, "").trim();
  return normalized === "related questions" || normalized === "related question" || normalized === "cau hoi lien quan";
}

function slugifyHeading(value: string) {
  // Without the fold above, `[^a-z0-9]+` ate every accented character: "Đề xuất" collapsed to "xu-t",
  // and a heading with no ASCII letters at all became the literal "section" for every such heading.
  const slug = normalizeHeadingText(value)
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

// Every consumer has to agree on line numbering for `lineIndex` to be a usable join key.
function researchLines(text: string) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

// One pass over the document assigning every heading its anchor id. The nav and the renderer each
// used to run their own `nextHeadingId` counter over the same text, but they disagree about which
// headings to skip — the nav drops level 1 and the Related Questions block — so the two dedupe
// counters drifted: an H1 and an H2 sharing a slug got `-x` then `-x-2` from the renderer while the
// nav independently computed `-x` for that H2, and clicking it scrolled back to the title. Sharing
// one pass is what keeps them in agreement; don't split this back into two counters.
function buildResearchOutline(text: string, researchId: string): ResearchOutlineEntry[] {
  const counts = new Map<string, number>();
  const outline: ResearchOutlineEntry[] = [];
  let inCodeFence = false;

  researchLines(text).forEach((line, index) => {
    // MarkdownContent consumes fenced blocks whole, so a `#` line inside one never becomes a
    // heading there. Skipping them here too keeps the nav from listing a section with no anchor.
    if (line.trim().startsWith("```")) {
      inCodeFence = !inCodeFence;
      return;
    }
    if (inCodeFence) return;

    const heading = parseResearchHeading(line, index);
    if (!heading) return;

    outline.push({
      lineIndex: index,
      id: nextHeadingId(heading.title, counts, researchId),
      title: stripMarkdownDecorations(heading.title),
      level: heading.level,
    });
  });

  return outline;
}

function extractResearchSections(outline: ResearchOutlineEntry[]) {
  return outline
    .filter((entry) => entry.level > 1 && entry.title && !isRelatedQuestionsHeading(entry.title))
    .slice(0, 10);
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
  const headingIndex = lines.findIndex((line) => isRelatedQuestionsHeading(line.replace(/^#{1,4}\s+/, "")));

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
  const { t } = useI18n();
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? "");
  const activeSectionIdRef = useRef(sections[0]?.id ?? "");
  const activeSectionFrameRef = useRef<number | null>(null);
  const sectionSignature = sections.map((section) => section.id).join("|");
  const firstSectionId = sections[0]?.id ?? "";

  useEffect(() => {
    activeSectionIdRef.current = firstSectionId;
    setActiveSectionId((current) => (current === firstSectionId ? current : firstSectionId));
  }, [researchId, firstSectionId]);

  useEffect(() => {
    const container = document.querySelector(`[data-research-id="${researchId}"]`);
    const scrollRoot = document.querySelector<HTMLElement>(".paycmd-chat-scrollbar");
    const elements = sections
      .map((section) => container?.querySelector<HTMLElement>(`#${CSS.escape(section.id)}`) ?? null)
      .filter((element): element is HTMLElement => Boolean(element));

    if (!elements.length) return;

    function updateActiveSection() {
      const rootTop = scrollRoot?.getBoundingClientRect().top ?? 0;
      const offset = rootTop + 96;
      let active = elements[0];

      for (const element of elements) {
        if (element.getBoundingClientRect().top <= offset) {
          active = element;
        } else {
          break;
        }
      }

      if (activeSectionIdRef.current === active.id) return;
      activeSectionIdRef.current = active.id;
      setActiveSectionId(active.id);
    }

    function scheduleActiveSectionUpdate() {
      if (activeSectionFrameRef.current !== null) return;

      activeSectionFrameRef.current = window.requestAnimationFrame(() => {
        activeSectionFrameRef.current = null;
        updateActiveSection();
      });
    }

    updateActiveSection();
    scrollRoot?.addEventListener("scroll", scheduleActiveSectionUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveSectionUpdate);

    return () => {
      scrollRoot?.removeEventListener("scroll", scheduleActiveSectionUpdate);
      window.removeEventListener("resize", scheduleActiveSectionUpdate);
      if (activeSectionFrameRef.current !== null) {
        window.cancelAnimationFrame(activeSectionFrameRef.current);
        activeSectionFrameRef.current = null;
      }
    };
  }, [researchId, sectionSignature]);

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
          className={`payna-subtle-lift block w-full rounded-lg border px-2.5 py-2 text-left text-xs leading-5 transition hover:bg-emerald-500/10 hover:text-foreground ${
            activeSectionId === section.id
              ? `${section.level > 2 ? "pl-5" : ""} border-emerald-400/60 bg-emerald-500/15 font-semibold text-emerald-700 shadow-[0_0_22px_rgba(16,185,129,.12)] dark:text-emerald-300`
              : section.level > 2
                ? "border-transparent pl-5 text-muted-foreground"
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
      <details className="order-first rounded-2xl border bg-background/70 p-3 shadow-sm backdrop-blur md:hidden">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          {t("research.sections")}
        </summary>
        <div className="mt-2">{items}</div>
      </details>
      <nav className="payna-glass hidden self-start rounded-2xl p-3 md:sticky md:top-5 md:block">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
          {t("research.sections")}
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
  const { t } = useI18n();

  return (
    <div className="space-y-2 border-t border-emerald-400/15 pt-3">
      <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
        {t("research.relatedQuestions")}
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onSelect(question)}
            className="payna-subtle-lift max-w-full rounded-full border bg-background/80 px-3 py-1.5 text-left text-xs font-medium text-foreground transition hover:border-emerald-400/50 hover:bg-emerald-500/10"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}

function AskSurfResearchActions({ researchId, text }: { researchId: string; text: string }) {
  const { t } = useI18n();
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

    // Print the rendered article, not the markdown source. This used to dump `escapeHtml(text)` into
    // a `white-space:pre-wrap` body, so the printout showed literal `## Heading` and `| a | b |` rows.
    // Cloning is the only cheap way to get the real thing: MarkdownContent emits styled `<div>`s
    // rather than `<h2>`/`<table>` semantics, so the markup carries no formatting without its
    // stylesheets, and re-serializing markdown here would mean a second renderer to keep in sync.
    const rendered = document
      .querySelector(`[data-research-id="${researchId}"]`)
      ?.querySelector(".min-w-0");
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join("");
    // Falls back to the markdown source if the container is somehow not in the DOM, so a failed
    // lookup degrades to plain text instead of printing a blank sheet.
    const head = rendered
      ? `${styles}<style>body{padding:32px;background:#fff}</style>`
      : "<style>body{font-family:system-ui,sans-serif;line-height:1.5;padding:32px;white-space:pre-wrap;color:#111}</style>";
    const body = rendered ? rendered.innerHTML : escapeHtml(text);

    popup.document.write(
      `<html><head><title>${escapeHtml(t("research.printTitle"))}</title>${head}</head><body>${body}</body></html>`,
    );
    popup.document.close();
    popup.focus();
    // Stylesheets are fetched asynchronously, so printing synchronously here raced them and produced
    // an unstyled page. Waiting for load is what makes the cloned CSS actually apply.
    popup.onload = () => popup.print();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-400/15 pt-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copyAnswer}>
          <Clipboard className="h-3.5 w-3.5" />
          {copied ? t("research.copied") : t("research.copy")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadTextFile("payna-research.md", text, "text/markdown;charset=utf-8")}
        >
          <Download className="h-3.5 w-3.5" />
          {t("research.markdown")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={printAnswer}>
          <Printer className="h-3.5 w-3.5" />
          {t("research.print")}
        </Button>
      </div>
      <div className="flex gap-1">
        <Button
          type="button"
          variant={feedback === "like" ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          aria-label={t("research.like")}
          onClick={() => setFeedback(feedback === "like" ? null : "like")}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={feedback === "dislike" ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          aria-label={t("research.dislike")}
          onClick={() => setFeedback(feedback === "dislike" ? null : "dislike")}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function AskSurfSourceList({ citations }: { citations: ChatCitation[] }) {
  const { t } = useI18n();

  return (
    <div className="space-y-2 border-t border-emerald-400/15 pt-3">
      <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
        {t("research.sources")}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {/* Matches the server-side cap in lib/paycmd/ai/research.ts, which keeps 8. This used to
            slice to 6, so two extracted sources were dropped with nothing indicating it. */}
        {citations.slice(0, 8).map((citation, index) => {
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
  text,
  citations = [],
  outline,
}: {
  text: string;
  citations?: ChatCitation[];
  // Anchor ids come from the caller's single `buildResearchOutline` pass rather than being recounted
  // here. Omitted when there is no nav to link into, in which case headings render without ids.
  outline?: ResearchOutlineEntry[];
}) {
  const lines = researchLines(text);
  const blocks: ReactNode[] = [];
  // Keyed by line index, which is why `researchLines` has to be the only line splitter in play.
  const headingIds = new Map<number, string>();
  outline?.forEach((entry) => headingIds.set(entry.lineIndex, entry.id));
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
      const id = headingIds.get(index);
      const className =
        level === 1
          ? "scroll-mt-24 text-xl font-semibold tracking-normal"
          : level === 2
            ? "scroll-mt-24 text-lg font-semibold tracking-normal"
            : "scroll-mt-24 text-base font-semibold tracking-normal";

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
      // Header and alignment rows are already validated by isMarkdownTableStart.
      const tableLines: string[] = [lines[index], lines[index + 1]];
      index += 2;
      // A body row has to look like a row, not merely contain a pipe. This loop used to absorb any
      // non-blank line containing "|", so a sentence with a pipe in it right after the table was
      // pulled in as a row. Tables written without leading pipes still work: the test follows
      // whatever style the header used.
      const headerHasLeadingPipe = /^\s*\|/.test(lines[start]);
      while (index < lines.length && lines[index].trim()) {
        const isRow = headerHasLeadingPipe ? /^\s*\|/.test(lines[index]) : lines[index].includes("|");
        if (!isRow) break;
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
  const { t } = useI18n();
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
          {t("research.table")}
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={t("research.table.copy")} onClick={copyTable}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t("research.table.csv")}
            onClick={() => downloadTextFile("payna-table.csv", tableToCsv(headers, body), "text/csv;charset=utf-8")}
          >
            <FileDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t("research.table.png")}
            onClick={() => downloadTablePng(headers, body)}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t("research.table.expand")}
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
              {t("research.table.fullscreenTitle")}
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label={t("research.table.close")} onClick={() => setIsFullscreen(false)}>
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
  link.download = "payna-table.png";
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
  const { t } = useI18n();
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
            {t("research.entity.backed")}
          </span>
          {/* The old fallback here explained that "no live price or chart was returned", which framed
              a feature this app has never had as a missing result. */}
          <span className="block text-muted-foreground">
            {context || t("research.entity.noContext")}
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
  const { t } = useI18n();
  const copy = aiLoadingKeys[provider];
  const text = t(copy[step % copy.length]);
  const elapsed = elapsedMs ? formatDuration(elapsedMs) : "";
  const title =
    provider === "asksurf"
      ? surfMode === "instant"
        ? "Surfing..."
        : "Researching..."
      : "Thinking...";

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[96%] rounded-3xl rounded-bl-md border border-white/6 bg-transparent px-3 py-3 text-sm leading-6 md:max-w-[86%]">
        <div className="flex items-start gap-4">
          <div className="relative h-14 w-14 shrink-0">
            <div className="payna-thinking-orbit absolute inset-0 rounded-full border border-white/22 border-t-emerald-400 border-r-white/50 shadow-[0_0_28px_rgba(99,244,200,.16)]" />
            <div className="payna-logo-frame absolute inset-1.5 overflow-hidden rounded-full border border-white/10">
              <Image src="/brand/antlers_transparent.png" alt="" fill className="object-contain p-1" />
            </div>
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-medium text-foreground">{title}</div>
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:160ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:320ms]" />
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <ProviderBadge provider={provider} surfMode={surfMode} effort={effort} />
              {provider === "asksurf" ? (
                <>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-300">
                    {surfModeLabel(surfMode)}
                  </span>
                  {surfMode !== "instant" ? <span>{surfEffortLabel(effort)} {t("chat.effort")}</span> : null}
                  {elapsed ? <span>{t("chat.elapsed", { duration: elapsed })}</span> : null}
                </>
              ) : null}
            </div>

            <div className="mt-4 space-y-3" aria-label={text}>
              <div className="payna-skeleton-line h-3.5 w-[82%] rounded-full" />
              <div className="payna-skeleton-line h-3.5 w-[55%] rounded-full [animation-delay:120ms]" />
              <div className="payna-skeleton-line h-3.5 w-[94%] rounded-full [animation-delay:240ms]" />
            </div>
          </div>
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
  const { t } = useI18n();
  const effortText = mode === "instant" ? "" : ` / ${surfEffortLabel(effort)}`;
  const durationText = elapsedMs ? ` ${formatDuration(elapsedMs)}` : "";

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-24 z-20 flex justify-center md:bottom-28">
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-400/30 bg-card/95 px-4 py-3 text-sm shadow-xl shadow-emerald-950/10 backdrop-blur dark:shadow-black/30">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-emerald-400/30 bg-[#07090d]">
          <Image src="/brand/antlers_transparent.png" alt="" fill className="object-contain p-1" />
        </div>
        <div className="min-w-0">
          <div className="font-medium">{t("asksurf.slowTitle")}</div>
          <div className="text-xs leading-5 text-muted-foreground">
            {t("asksurf.slowBody", {
              mode: surfModeLabel(mode),
              effort: effortText,
              duration: durationText,
            })}
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
          aria-label={t("asksurf.hideNotice")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function OnboardingGuide({ onSelect }: { onSelect: (sample: string) => void }) {
  const { t } = useI18n();

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center">
        <div className="relative mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-emerald-400/30 bg-[#07090d] md:mx-0">
          <Image src="/brand/antlers_transparent.png" alt="Payna AI Copilot" fill className="object-contain p-2" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("onboarding.badge")}
          </div>
          <h2 className="text-xl font-semibold tracking-normal">{t("onboarding.title")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("onboarding.description")}
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
              <div className="font-medium">{t(item.titleKey)}</div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <div className="mt-1 font-mono text-xs text-primary">{item.sample}</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">{t(item.descriptionKey)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

type PreviewMetric = {
  label: string;
  value: ReactNode;
  title?: string;
  tone?: "default" | "success" | "warning";
};

function PreviewMetricPill({ metric }: { metric: PreviewMetric }) {
  const toneClass =
    metric.tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : metric.tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
        : "border-border/80 bg-background/70 text-foreground";

  return (
    <div className={`min-w-0 rounded-md border px-3 py-2 ${toneClass}`} title={metric.title}>
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {metric.label}
        {metric.title ? <Info className="h-3 w-3" aria-hidden="true" /> : null}
      </div>
      <div className="mt-1 truncate text-sm font-semibold">{metric.value}</div>
    </div>
  );
}

function TransactionPreviewSummary({
  title,
  subtitle,
  route,
  metrics,
  details,
  loading,
  error,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  route?: ReactNode;
  metrics: PreviewMetric[];
  details: ReactNode[];
  loading?: boolean;
  error?: string;
  footer?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-md border border-border/80 bg-card/80 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {subtitle ? <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{subtitle}</div> : null}
        </div>
        {route ? <div className="shrink-0">{route}</div> : null}
      </div>

      {loading ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3" aria-live="polite">
          <div className="h-12 rounded-md bg-muted/40" />
          <div className="h-12 rounded-md bg-muted/30" />
          <div className="h-12 rounded-md bg-muted/20" />
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {error}
        </div>
      ) : null}

      {!loading && metrics.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {metrics.map((metric) => (
            <PreviewMetricPill key={metric.label} metric={metric} />
          ))}
        </div>
      ) : null}

      {details.length || footer ? (
        <details className="mt-3 rounded-md border border-border/70 bg-background/60 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground">{t("receipt.details")}</summary>
          <div className="mt-2 space-y-2">
            {details.map((detail, index) => (
              <div key={index}>{detail}</div>
            ))}
            {footer ? <div>{footer}</div> : null}
          </div>
        </details>
      ) : null}
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
  const { t } = useI18n();
  const previewStatusLabel =
    state === "cancelled"
      ? t("status.cancelled")
      : state === "confirmed"
          ? t("status.confirmed")
        : state === "closed"
          ? t("preview.closed")
          : t("preview.ready");
  const previewRail = inferRailFromCommand(draft.command);
  const previewSourceChain = draft.fields.sourceChain || draft.fields.chain;
  const previewDestinationChain = draft.fields.destinationChain;
  const hasMintGasChoice = draft.command === "transfer" || draft.command === "pay";
  const isBridge = draft.command === "bridge";
  const isSwap = draft.command === "swap";
  const [selectedMintGasMode, setSelectedMintGasMode] = useState(
    draft.fields.mintGasMode === "manual" || (draft.command === "pay" && !draft.fields.mintGasMode)
      ? "manual"
      : "auto_forwarding",
  );
  const [bridgeSourceChain, setBridgeSourceChain] = useState(
    normalizeCctpBridgeChain(draft.fields.sourceChain) || "baseSepolia",
  );
  const [bridgeDestinationChain, setBridgeDestinationChain] = useState(
    normalizeCctpBridgeChain(draft.fields.destinationChain) || "arcTestnet",
  );
  const [bridgeMintMode, setBridgeMintMode] = useState<CctpBridgeMintMode>(
    (draft.fields.bridgeMintMode as CctpBridgeMintMode) || "auto_forwarding",
  );
  const [bridgeTransferSpeed, setBridgeTransferSpeed] = useState<CctpBridgeTransferSpeed>(
    (draft.fields.transferSpeed as CctpBridgeTransferSpeed) || "FAST",
  );
  const [bridgeRecipientMode, setBridgeRecipientMode] = useState<"self" | "external">(
    draft.fields.recipientMode === "external" ? "external" : "self",
  );
  const [bridgeRecipientAddress, setBridgeRecipientAddress] = useState(draft.fields.recipientAddress ?? "");
  const [supportedBridgeChains, setSupportedBridgeChains] = useState<CctpBridgeRuntimeChain[]>([]);
  const [bridgeEstimate, setBridgeEstimate] = useState<BridgeEstimateSummary | null>(null);
  const [bridgeEstimateError, setBridgeEstimateError] = useState("");
  const [bridgeEstimateLoading, setBridgeEstimateLoading] = useState(false);
  const [swapEstimate, setSwapEstimate] = useState<SwapEstimate | null>(null);
  const [swapEstimateError, setSwapEstimateError] = useState("");
  const [swapEstimateLoading, setSwapEstimateLoading] = useState(false);

  useEffect(() => {
    if (!isBridge) return;

    let cancelled = false;
    void getSupportedCctpBridgeChains()
      .then((chains) => {
        if (!cancelled) {
          setSupportedBridgeChains(chains);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBridgeEstimateError(error instanceof Error ? error.message : t("bridge.cctpLoadFailed"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isBridge]);

  useEffect(() => {
    if (bridgeRecipientMode === "external" && bridgeMintMode === "manual_mint") {
      setBridgeMintMode("auto_forwarding");
    }
  }, [bridgeRecipientMode, bridgeMintMode]);

  useEffect(() => {
    if (!isBridge || !supportedBridgeChains.length || !draft.fields.amount) return;

    const bridgeDraft: ParsedCommand = {
      ...draft,
      fields: {
        ...draft.fields,
        sourceChain: bridgeSourceChain,
        destinationChain: bridgeDestinationChain,
        bridgeMintMode,
        transferSpeed: bridgeTransferSpeed,
        recipientMode: bridgeRecipientMode,
        recipientAddress: bridgeRecipientMode === "external" ? bridgeRecipientAddress.trim() : "",
      },
    };

    let cancelled = false;
    setBridgeEstimateLoading(true);
    setBridgeEstimateError("");

    void estimateBridgeDraft(bridgeDraft)
      .then((result) => {
        if (!cancelled) {
          setBridgeEstimate(result.summary);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBridgeEstimate(null);
          setBridgeEstimateError(error instanceof Error ? error.message : t("preview.bridgeEstimateFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBridgeEstimateLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    bridgeDestinationChain,
    bridgeMintMode,
    bridgeRecipientAddress,
    bridgeRecipientMode,
    bridgeSourceChain,
    bridgeTransferSpeed,
    draft,
    isBridge,
    supportedBridgeChains,
    t,
  ]);

  useEffect(() => {
    if (!isSwap || !draft.fields.amount || !draft.fields.tokenIn || !draft.fields.tokenOut) return;

    let cancelled = false;
    // Spinner goes up immediately even though the request is delayed, so the preview does not sit
    // showing a stale figure while the debounce runs.
    setSwapEstimateLoading(true);
    setSwapEstimateError("");

    // `draft` is a fresh object per keystroke, so this effect used to fire a quote per character.
    // The Arc RPC allows 4 requests/second and a quote costs several, so typing "100" was enough to
    // get HTTP 429 back — which viem raises as a transport error and the route reported as "could
    // not reach Arc Testnet". Cancelling the pending timer on each keystroke means only the last
    // one in a burst actually asks.
    const timer = window.setTimeout(() => {
      void estimateSwapDraft(draft)
        .then((result) => {
          if (!cancelled) {
            setSwapEstimate(result);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setSwapEstimate(null);
            setSwapEstimateError(
              error instanceof Error ? error.message : t("preview.swapEstimateFailed"),
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSwapEstimateLoading(false);
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft, isSwap, t]);
  const mintGasModeText =
    selectedMintGasMode === "manual"
      ? ` · ${t("transfer.mintGasManual")}`
      : ` · ${t("transfer.mintGasAuto")}`;
  const mintGasHelpText =
    hasMintGasChoice
      ? selectedMintGasMode === "manual"
        ? t("transfer.manualHelp")
        : t("transfer.autoHelp")
      : "";
  const previewTitle =
    draft.command === "transfer"
      ? t("transfer.title", {
          amount: draft.fields.amount,
          source: draft.fields.sourceChain,
          destination: draft.fields.destinationChain,
        })
      : draft.summary;
  const confirmedDraft: ParsedCommand = {
    ...draft,
    summary: isBridge
      ? bridgeRecipientMode === "external"
        ? t("bridge.titleExternal", {
            amount: draft.fields.amount,
            source: bridgeSourceChain,
            destination: bridgeDestinationChain,
            recipient: bridgeRecipientAddress || "recipient",
          })
        : t("bridge.title", {
            amount: draft.fields.amount,
            source: bridgeSourceChain,
            destination: bridgeDestinationChain,
          })
      : draft.summary,
    fields: isBridge
      ? {
          ...draft.fields,
          sourceChain: bridgeSourceChain,
          destinationChain: bridgeDestinationChain,
          bridgeMintMode,
          transferSpeed: bridgeTransferSpeed,
          recipientMode: bridgeRecipientMode,
          recipientAddress: bridgeRecipientMode === "external" ? bridgeRecipientAddress.trim() : "",
        }
      : hasMintGasChoice
        ? {
            ...draft.fields,
            mintGasMode: selectedMintGasMode,
          }
        : draft.fields,
  };
  const bridgeChainChoices = supportedBridgeChains.length ? supportedBridgeChains : Object.values(cctpBridgeChainMap).map((chain) => ({
    ...chain,
    canFastFromSource: true,
    canForwardToDestination: true,
  }));
  const currentBridgeSource = bridgeChainChoices.find((chain) => chain.key === bridgeSourceChain);
  const currentBridgeDestination = bridgeChainChoices.find((chain) => chain.key === bridgeDestinationChain);
  const bridgeConfirmDisabled =
    !isActive ||
    !draft.fields.amount ||
    !bridgeSourceChain ||
    !bridgeDestinationChain ||
    bridgeSourceChain === bridgeDestinationChain ||
    bridgeEstimateLoading ||
    (bridgeRecipientMode === "external" && !/^0x[a-fA-F0-9]{40}$/.test(bridgeRecipientAddress.trim()));
  const swapConfirmDisabled =
    !isActive ||
    !swapEstimate ||
    swapEstimateLoading ||
    Boolean(swapEstimateError);
  const hiddenFieldKeys = new Set([
    "mintGasMode",
    "bridgeMintMode",
    "transferSpeed",
    "recipientMode",
  ]);

  return (
    <div className="min-w-[260px] space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase text-muted-foreground">{t("chat.preview")}</div>
          <div className="font-semibold">{previewTitle}</div>
        </div>
        {isActive ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 h-8 w-8 shrink-0"
            onClick={onCancel}
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            {previewStatusLabel}
          </Badge>
        )}
      </div>
      <div className="grid gap-2 text-xs">
        <Row label={t("chat.command")} value={`/${draft.command}`} />
        {Object.entries(draft.fields).map(([key, value]) =>
          value && !hiddenFieldKeys.has(key) ? <Row key={key} label={key} value={value} /> : null,
        )}
      </div>
      <div className="space-y-2 rounded-lg border bg-background p-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <RailBadge rail={previewRail} />
          {isBridge ? (
            <ChainRoute sourceChain={bridgeSourceChain} destinationChain={bridgeDestinationChain} compact />
          ) : previewSourceChain ? (
            <ChainRoute
              sourceChain={previewSourceChain}
              destinationChain={previewDestinationChain}
              compact
            />
          ) : null}
        </div>
        <div>
          {t("chat.modeReal")}
          {draft.command === "transfer" ? ` · ${t("transfer.modeAutoDeposit")}` : ""}
          {draft.command === "bridge" ? ` · ${t("bridge.metaMaskDirect")}` : ""}
          {hasMintGasChoice ? mintGasModeText : ""}
          {draft.command === "withdraw" ? ` · ${t("withdraw.previewHint")}` : ""}
          {draft.command === "fund" || draft.command === "bridge" ? ` · ${t("chat.keepOpenMetaMask")}` : ""}
        </div>
        {isBridge ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("bridge.from")}</span>
                <select
                  value={bridgeSourceChain}
                  onChange={(event) => setBridgeSourceChain(event.target.value as CctpBridgeChainKey)}
                  disabled={!isActive}
                  className="h-9 rounded-md border bg-card px-2 text-sm text-foreground outline-none"
                >
                  {bridgeChainChoices.map((chain) => (
                    <option key={chain.key} value={chain.key}>
                      {chain.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("bridge.to")}</span>
                <select
                  value={bridgeDestinationChain}
                  onChange={(event) => setBridgeDestinationChain(event.target.value as CctpBridgeChainKey)}
                  disabled={!isActive}
                  className="h-9 rounded-md border bg-card px-2 text-sm text-foreground outline-none"
                >
                  {bridgeChainChoices
                    .filter((chain) => chain.key !== bridgeSourceChain)
                    .map((chain) => (
                      <option key={chain.key} value={chain.key}>
                        {chain.label}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!isActive}
                onClick={() => setBridgeRecipientMode("self")}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  bridgeRecipientMode === "self"
                    ? "border-sky-500/70 bg-sky-500/10"
                    : "bg-card hover:border-primary/60"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="block font-medium text-foreground">{t("bridge.myWallet")}</span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                  {t("bridge.myWalletHelp")}
                </span>
              </button>
              <button
                type="button"
                disabled={!isActive}
                onClick={() => setBridgeRecipientMode("external")}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  bridgeRecipientMode === "external"
                    ? "border-sky-500/70 bg-sky-500/10"
                    : "bg-card hover:border-primary/60"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="block font-medium text-foreground">{t("bridge.anotherAddress")}</span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                  {t("bridge.anotherAddressHelp")}
                </span>
              </button>
            </div>
            {bridgeRecipientMode === "external" ? (
              <label className="grid gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("bridge.recipient")}</span>
                <Input
                  value={bridgeRecipientAddress}
                  onChange={(event) => setBridgeRecipientAddress(event.target.value)}
                  placeholder="0xRecipient"
                  disabled={!isActive}
                  className="h-9"
                />
              </label>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!isActive || !currentBridgeDestination?.canForwardToDestination}
                onClick={() => setBridgeMintMode("auto_forwarding")}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  bridgeMintMode === "auto_forwarding"
                    ? "border-emerald-500/70 bg-emerald-500/10"
                    : "bg-card hover:border-primary/60"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="block font-medium text-foreground">{t("bridge.autoForwarding")}</span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                  {t("bridge.autoForwardingHelp")}
                </span>
              </button>
              <button
                type="button"
                disabled={!isActive || bridgeRecipientMode === "external"}
                onClick={() => setBridgeMintMode("manual_mint")}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  bridgeMintMode === "manual_mint"
                    ? "border-amber-500/70 bg-amber-500/10"
                    : "bg-card hover:border-primary/60"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="block font-medium text-foreground">{t("bridge.manualMint")}</span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                  {t("bridge.manualMintHelp")}
                </span>
              </button>
            </div>
            {bridgeRecipientMode === "external" ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-4 text-amber-200">
                {t("bridge.externalAutoOnly")}
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!isActive || !currentBridgeSource?.canFastFromSource}
                onClick={() => setBridgeTransferSpeed("FAST")}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  bridgeTransferSpeed === "FAST"
                    ? "border-indigo-500/70 bg-indigo-500/10"
                    : "bg-card hover:border-primary/60"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="block font-medium text-foreground">{t("bridge.fast")}</span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                  {t("bridge.fastHelp")}
                </span>
              </button>
              <button
                type="button"
                disabled={!isActive}
                onClick={() => setBridgeTransferSpeed("SLOW")}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  bridgeTransferSpeed === "SLOW"
                    ? "border-indigo-500/70 bg-indigo-500/10"
                    : "bg-card hover:border-primary/60"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="block font-medium text-foreground">{t("bridge.standard")}</span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                  {t("bridge.standardHelp")}
                </span>
              </button>
            </div>
            {!currentBridgeSource?.canFastFromSource ? (
              <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-[11px] leading-4 text-muted-foreground">
                {t("bridge.standardOnly")}
              </div>
            ) : null}
            <TransactionPreviewSummary
              title={
                bridgeEstimate
                  ? t("preview.bridgeReceive", { amount: formatDecimalAmount(bridgeEstimate.amount) })
                  : t("bridge.feePreview")
              }
              subtitle={
                bridgeEstimate
                  ? t("preview.bridgeSpend", {
                      amount: formatDecimalAmount(bridgeEstimate.sourceDebit),
                      chain: currentBridgeSource?.label ?? bridgeSourceChain,
                    })
                  : undefined
              }
              route={<ChainRoute sourceChain={bridgeSourceChain} destinationChain={bridgeDestinationChain} compact />}
              loading={bridgeEstimateLoading}
              error={bridgeEstimateError}
              metrics={
                bridgeEstimate
                  ? [
                      {
                        label: t("preview.fee"),
                        value: Number(bridgeEstimate.estimatedFeeTotal) === 0
                          ? t("preview.noProtocolFee")
                          : `~${formatDecimalAmount(bridgeEstimate.estimatedFeeTotal)} USDC`,
                        tone: Number(bridgeEstimate.estimatedFeeTotal) === 0 ? "success" : "default",
                        title: t("bridge.zeroFeeNote"),
                      },
                      {
                        label: t("preview.sourceGas"),
                        value: currentBridgeSource?.viemChain.nativeCurrency.symbol ?? "ETH",
                        title: t("bridge.sourceGas", {
                          symbol: currentBridgeSource?.viemChain.nativeCurrency.symbol ?? "ETH",
                          chain: currentBridgeSource?.label ?? bridgeSourceChain,
                        }),
                      },
                      {
                        label: t("preview.destinationGas"),
                        value: bridgeMintMode === "manual_mint" ? t("preview.youPay") : t("preview.forwarderPays"),
                        title:
                          bridgeMintMode === "manual_mint"
                            ? t("bridge.destinationGasManual", {
                                symbol: currentBridgeDestination?.viemChain.nativeCurrency.symbol ?? "native",
                                chain: currentBridgeDestination?.label ?? bridgeDestinationChain,
                              })
                            : t("bridge.destinationGasForwarder"),
                      },
                    ]
                  : []
              }
              details={[
                t("bridge.approveAllowanceNote"),
                t("bridge.raProofNote"),
                t("bridge.usesMetaMask"),
              ]}
              footer={
                <>
                  {t("bridge.needFunds")}{" "}
                  <a href={CIRCLE_TESTNET_FAUCET_URL} target="_blank" rel="noreferrer" className="text-primary underline">
                    {t("bridge.circleFaucet")}
                  </a>
                </>
              }
            />
          </div>
        ) : null}
        {isSwap ? (
          <TransactionPreviewSummary
            title={
              swapEstimate
                ? `${draft.fields.amount} ${swapEstimate.tokenIn} -> ~${formatDecimalAmount(
                    formatUnits(swapEstimate.amountOut, paynaSwapTokens[swapEstimate.tokenOut].decimals),
                    8,
                  )} ${swapEstimate.tokenOut}`
                : t("preview.swapTitle")
            }
            subtitle={t("preview.swapSubtitle")}
            route={
              swapEstimate ? (
                <div className="flex max-w-full flex-wrap items-center gap-1">
                  {swapEstimate.route.map((token, index) => (
                    <span key={`${token}-${index}`} className="inline-flex items-center gap-1">
                      <span className="rounded-md border bg-background px-2 py-1 text-[11px] font-medium text-foreground">
                        {token}
                      </span>
                      {index < swapEstimate.route.length - 1 ? (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null
            }
            loading={swapEstimateLoading}
            error={swapEstimateError}
            metrics={
              swapEstimate
                ? [
                    {
                      label: t("receipt.minimum"),
                      value: `${formatDecimalAmount(
                        formatUnits(swapEstimate.amountOutMin, paynaSwapTokens[swapEstimate.tokenOut].decimals),
                        8,
                      )} ${swapEstimate.tokenOut}`,
                      title: t("preview.swapMinimumTitle"),
                    },
                    {
                      label: t("receipt.slippage"),
                      value: `${(PAYNA_SWAP_SLIPPAGE_BPS / 100).toFixed(2)}%`,
                      tone: "warning",
                      title: t("preview.swapSlippageTitle"),
                    },
                    {
                      label: t("receipt.route"),
                      value: swapEstimate.route.length > 2 ? t("preview.hops", { count: swapEstimate.route.length - 1 }) : t("preview.direct"),
                      title: swapEstimate.route.join(" -> "),
                    },
                  ]
                : []
            }
            details={[
              t("preview.swapReserveNote"),
              t("preview.swapApproveNote"),
            ]}
          />
        ) : null}
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
              <span className="block font-medium text-foreground">{t("transfer.autoForwarding")}</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                {t("transfer.autoForwardingHelp")}
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
              <span className="block font-medium text-foreground">{t("transfer.manualGas")}</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                {t("transfer.manualGasHelp")}
              </span>
            </button>
          </div>
        ) : null}
        {mintGasHelpText ? <div>{mintGasHelpText}</div> : null}
      </div>
      <Button
        className="w-full"
        disabled={isBridge ? bridgeConfirmDisabled : isSwap ? swapConfirmDisabled : !isActive}
        onClick={() => onConfirm(confirmedDraft)}
      >
        <Check className="mr-2 h-4 w-4" />
        {isActive ? t("common.confirmCommand") : previewStatusLabel}
      </Button>
    </div>
  );
}

/**
 * `/balance` printed an indented text tree, which made the two numbers the user acts on — SCA
 * (needs /deposit first) versus Gateway (spendable now) — read as one undifferentiated list.
 *
 * Shares balanceBreakdown() with balanceBreakdownText so the table and the persisted text can
 * never disagree. `text` stays the fallback: rows saved before this component existed have no
 * `execution.result` to render from, and their text is still correct.
 */
function BalanceBreakdownTable({
  result,
  chainFilter,
  fallbackText,
}: {
  result: unknown;
  chainFilter?: string;
  fallbackText: string;
}) {
  const { t } = useI18n();
  const hasData = Array.isArray(recordFrom(result).balances);

  if (!hasData) {
    return <div className="whitespace-pre-wrap leading-7">{fallbackText}</div>;
  }

  const { scaTotal, gatewayTotal, total, rows, chainsChecked } = balanceBreakdown(
    result,
    chainFilter,
  );
  const partial = partialBalanceSuffix(result, t, "unified", chainFilter);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-background/60 p-3">
        <div className="text-xs text-muted-foreground">{t("runtime.balanceTableTotal")}</div>
        <div className="text-xl font-semibold tabular-nums">
          {formatDecimalAmount(total)} <span className="text-sm font-normal">USDC</span>
        </div>
        {partial ? <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">{partial}</div> : null}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            { label: "Circle SCA", amount: scaTotal, hint: t("runtime.balanceScaHint") },
            { label: "Gateway", amount: gatewayTotal, hint: t("runtime.balanceGatewayHint") },
          ].map((tile) => (
            <div key={tile.label} className="rounded-lg bg-muted/50 px-2.5 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium">{tile.label}</span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatDecimalAmount(tile.amount)}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{tile.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {t("runtime.balanceEmpty", { count: chainsChecked })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            {t("runtime.balanceByChain", { count: chainsChecked })}
          </div>
          <table className="w-full text-sm">
            <caption className="sr-only">{t("runtime.balanceByChain", { count: chainsChecked })}</caption>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="px-3 py-1.5 text-left font-medium">
                  {t("runtime.balanceTableChain")}
                </th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Circle SCA</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Gateway</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  {t("runtime.balanceTableTotal")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                // Unknown keys keep the raw key and skip the logo rather than dropping the row, so
                // a chain added upstream still shows its money before it has an icon here.
                const meta = getChainMeta(row.chain);
                const Icon = meta?.Icon;
                return (
                  <tr key={row.chain} className="border-b last:border-0">
                    <th scope="row" className="px-3 py-1.5 text-left font-normal">
                      <span className="flex items-center gap-2">
                        {Icon ? <Icon className="size-4 shrink-0" /> : null}
                        {meta?.label ?? row.chain}
                      </span>
                    </th>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {row.sca > 0 ? formatDecimalAmount(row.sca) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {row.gateway > 0 ? formatDecimalAmount(row.gateway) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                      {formatDecimalAmount(row.sca + row.gateway)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExecutionStatus({
  execution,
  text,
  isLatest,
  showFollowUps,
  onSuggestedCommand,
}: {
  execution: ExecutionItem;
  text: string;
  isLatest: boolean;
  // Gated by the caller to the last message in the thread. Every successful execution keeps its own
  // status card in history, so rendering chips on all of them would stack a fresh "check balance"
  // prompt under each past transfer.
  showFollowUps: boolean;
  onSuggestedCommand: (command: string) => void;
}) {
  const { t } = useI18n();
  const done = execution.status === "success";
  const failed = execution.status === "failed";
  const active = isLatest && !done && !failed;
  const sourceChain = executionSourceChain(execution);
  const destinationChain = executionDestinationChain(execution);
  const txLinks = executionTxLinks(execution, t);
  const rail = inferRailFromCommand(execution.command);
  const receipt = buildExecutionReceipt(execution, t);
  const followUps = showFollowUps ? executionFollowUps(execution, t) : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-medium">
        {done ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : failed ? (
          <Clock3 className="h-4 w-4 text-destructive" />
        ) : active ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Clock3 className="h-4 w-4 text-muted-foreground" />
        )}
        <span className={active ? "text-muted-foreground" : done ? "text-emerald-600 dark:text-emerald-300" : ""}>
          {statusLabel(execution.status, t)}
        </span>
      </div>
      {receipt ? (
        <ExecutionReceiptCard receipt={receipt} rail={rail} />
      ) : execution.command === "balance" ? (
        // buildExecutionReceipt only covers the money-moving commands, so balance lands here.
        // chainFilter comes from the draft because the route always reads all 12 chains — the
        // response alone cannot tell "/balance on base" apart from "/balance".
        <BalanceBreakdownTable
          result={execution.result}
          chainFilter={execution.chainFilter}
          fallbackText={text}
        />
      ) : (
        <div className="whitespace-pre-wrap leading-7">{text}</div>
      )}
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
      {!receipt && txLinks.length ? (
        <div className="space-y-1 rounded-lg bg-background p-2 text-xs text-muted-foreground">
          {txLinks.map((link) => (
            <div key={`${link.label}-${link.txHash}`} className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
              <span>{link.label}</span>
              <ExplorerTxLink chain={link.chain} txHash={link.txHash} compact />
            </div>
          ))}
        </div>
      ) : null}
      {showFollowUps && followUps.length ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2.5 text-xs">
          <span className="text-muted-foreground">{t("action.nextStep")}</span>
          {followUps.map((followUp) => (
            <button
              key={followUp.command}
              type="button"
              className="payna-subtle-lift inline-flex items-center gap-1.5 rounded-full border bg-background/75 px-3 py-1 text-muted-foreground backdrop-blur transition hover:border-primary hover:text-foreground"
              onClick={() => onSuggestedCommand(followUp.command)}
            >
              <Sparkles className="h-3 w-3" />
              {followUp.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ExecutionReceiptCard({
  receipt,
  rail,
}: {
  receipt: ExecutionReceipt;
  rail: ReturnType<typeof inferRailFromCommand>;
}) {
  const { t } = useI18n();
  const hasDetails = receipt.details.length > 0;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-400/25 bg-background/55 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
              <ReceiptText className="h-4 w-4" />
              <span>{receipt.title}</span>
            </div>
            <div className="break-words text-lg font-semibold leading-7">{receipt.primary}</div>
            {receipt.secondary ? (
              <div className="text-xs leading-5 text-muted-foreground">{receipt.secondary}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <RailBadge rail={rail} />
          <ChainRoute sourceChain={receipt.sourceChain} destinationChain={receipt.destinationChain} compact />
        </div>

        {receipt.metrics.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {receipt.metrics.map((item) => (
              <div key={`${item.label}-${item.value}`} className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2">
                <div className="text-[11px] uppercase tracking-normal text-muted-foreground">{item.label}</div>
                <div className="mt-0.5 truncate text-sm font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {receipt.links.length ? (
          <div className="mt-3 space-y-1.5 rounded-lg bg-background p-2 text-xs text-muted-foreground">
            {receipt.links.map((link) => (
              <div key={`${link.label}-${link.txHash}`} className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2">
                <span>{link.label}</span>
                <ExplorerTxLink chain={link.chain} txHash={link.txHash} compact />
              </div>
            ))}
          </div>
        ) : null}

        {hasDetails ? (
          <details className="mt-3 rounded-lg border border-border/70 bg-muted/15 px-3 py-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground">{t("receipt.details")}</summary>
            <div className="mt-2 space-y-1.5">
              {receipt.details.map((item) => (
                <div key={`${item.label}-${item.value}`} className="grid grid-cols-[104px_minmax(0,1fr)] gap-2">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="break-all font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
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
