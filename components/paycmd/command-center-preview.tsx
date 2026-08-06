"use client";

import { Activity, Bell, ChevronDown, Contact, MessageCircle, MoreHorizontal, Network, ShieldCheck, Wallet, WalletCards } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  AssistantActionBar,
  askPaynaAssistantMessageFromResponse,
  buildChatMessageInsertPayload,
  CommandPalette,
  CommandPreviewCard,
  mapRowToMessage,
  MessageBubble,
  ModeBoundCommandPreview,
  useChatModeBoundary,
  type AssistantAction,
  type CryptoResearchResult,
} from "@/components/paycmd-app";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { TransactionHistory, type Transaction } from "@/components/transaction-history";
import {
  ExecutionTimeline,
} from "@/components/paycmd/transaction-safety";
import { createPreviewExpiresAt } from "@/lib/paycmd/preview-lease";
import type { ParsedCommand } from "@/lib/paycmd/commands";

const previewDraft: ParsedCommand = {
  command: "bridge",
  raw: "/bridge 50 USDC from baseSepolia to arcTestnet",
  summary: "Bridge 50 USDC to Arc Testnet",
  fields: {
    amount: "50",
    token: "USDC",
    sourceChain: "Base Sepolia",
    destinationChain: "Arc Testnet",
    recipientAddress: "0x1111…1111",
    bridgeMintMode: "auto_forwarding",
  },
  missingFields: [],
  sample: "/bridge 50 USDC from baseSepolia to arcTestnet",
  status: "draft_ready",
};

type PreviewLeaseFixture = "live" | "expired" | "legacy";

const walletContextFixtureAddress = "0x2222222222222222222222222222222222222222";

function WalletContextMessageFixture({
  status,
}: {
  status: "verified" | "partial" | "unavailable" | "invalid";
}) {
  const apiResponse = {
    assistantText: "# Wallet context\n\n## Guidance\nRead-only balance guidance.\n\n## Related Questions\n- What is Gateway?",
    provider: "asksurf",
    walletContextStatus: status === "invalid" ? "ready" : status,
    walletContext: {
      externalWallets: [{ address: walletContextFixtureAddress, usdc: "30" }],
    },
  };
  const clientMessage = askPaynaAssistantMessageFromResponse(
    apiResponse as unknown as CryptoResearchResult,
    {
      text: apiResponse.assistantText,
      surfMode: "research",
      effort: "standard",
    },
  );
  const insertPayload = buildChatMessageInsertPayload(clientMessage, "fixture-thread", "fixture-user");
  const reloadedMessage = mapRowToMessage({
    id: `wallet-context-${status}`,
    ...insertPayload,
    created_at: "2026-08-07T00:00:00.000Z",
  });

  return (
    <section data-testid={`wallet-context-production-message-${status}`}>
      <MessageBubble
        message={reloadedMessage}
        chatMode="asksurf"
        activeDraftId={null}
        isLatestExecutionStatus={false}
        isLastMessage
        onConfirm={() => undefined}
        onCancel={() => undefined}
        onRelatedQuestion={() => undefined}
        onSwitchToPayCmd={() => undefined}
        onRetryCommand={() => undefined}
        onSuggestedCommand={() => undefined}
      />
      <output data-testid={`wallet-context-production-metadata-${status}`} className="sr-only">
        {JSON.stringify(insertPayload.metadata)}
      </output>
    </section>
  );
}

function ProductionPreviewLeaseFixture({ lease }: { lease: PreviewLeaseFixture }) {
  const [previewExpiresAt] = useState<string | undefined>(() => {
    const now = Date.now();
    if (lease === "expired") return new Date(now - 1).toISOString();
    if (lease === "legacy") return undefined;
    return createPreviewExpiresAt(now);
  });
  const [metadata, setMetadata] = useState<{
    draftState: "active" | "cancelled";
    cancellationReason?: "expired";
  }>({ draftState: "active" });
  const [cancellationCount, setCancellationCount] = useState(0);
  const cancelPreview = useCallback((cancellationReason?: "expired") => {
    setCancellationCount((count) => count + 1);
    setMetadata((current) =>
      current.draftState === "cancelled"
        ? current
        : { draftState: "cancelled", cancellationReason },
    );
  }, []);

  return (
    <>
      <CommandPreviewCard
        draft={previewDraft}
        state={metadata.draftState}
        isActive={metadata.draftState === "active"}
        previewExpiresAt={previewExpiresAt}
        cancellationReason={metadata.cancellationReason}
        onConfirm={() => undefined}
        onCancel={cancelPreview}
      />
      <output data-testid="preview-lease-metadata" className="sr-only">
        {metadata.draftState}:{metadata.cancellationReason ?? "none"}:{cancellationCount}
      </output>
    </>
  );
}

const previewTransactions: Transaction[] = [
  {
    id: "fixture-bridge-1",
    user_id: "fixture-user",
    chain: "base-sepolia",
    tx_type: "bridge",
    amount: 50,
    tx_hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    gateway_wallet_address: null,
    destination_chain: "arc-testnet",
    status: "pending_gateway_finality",
    reason: null,
    created_at: "2026-08-03T08:30:00.000Z",
  },
];

function ModeSafetyFixture() {
  const [activeDraftId, setActiveDraftId] = useState<string | null>("mode-safety-preview");
  const [draftState, setDraftState] = useState<"active" | "cancelled">("active");
  const [input, setInput] = useState("");
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [retriedCount, setRetriedCount] = useState(0);
  const [submittedCount] = useState(0);
  const [researchCount, setResearchCount] = useState(0);
  const [previewExpiresAt] = useState(() => new Date(Date.now() + 300_000).toISOString());

  function cancelActiveDraft() {
    setDraftState("cancelled");
    setActiveDraftId(null);
  }

  const { chatMode, changeChatMode, canRunPaynaAction } = useChatModeBoundary({
    activeDraftId,
    onCancelActiveDraft: cancelActiveDraft,
  });
  const staleConfirmRef = useRef(() => {
    if (canRunPaynaAction()) setConfirmedCount((count) => count + 1);
  });
  const staleRetryRef = useRef(() => {
    if (canRunPaynaAction()) setRetriedCount((count) => count + 1);
  });
  const actions: AssistantAction[] = [
    { kind: "retry_command", label: "Retry command", draft: previewDraft },
    {
      kind: "switch_to_paycmd",
      label: "Switch to Payna",
      query: "/pay 50 USDC to Minh on arc from base",
    },
    {
      kind: "switch_to_asksurf",
      label: "Switch to AskPayna",
      query: "What is Circle Gateway?",
    },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-8">
      <h1 className="text-xl font-semibold">Chat mode safety fixture</h1>
      <div className="flex gap-2">
        <Button type="button" onClick={() => changeChatMode("paycmd")}>Select Payna</Button>
        <Button type="button" variant="outline" onClick={() => changeChatMode("asksurf")}>Select AskPayna</Button>
      </div>
      <Input aria-label="Mode safety input" value={input} onChange={(event) => setInput(event.target.value)} />
      <ModeBoundCommandPreview
        chatMode={chatMode}
        fallback={<p>Preview controls are unavailable in AskPayna.</p>}
        draft={previewDraft}
        state={draftState}
        isActive={activeDraftId !== null && draftState === "active"}
        previewExpiresAt={previewExpiresAt}
        onConfirm={() => staleConfirmRef.current()}
        onCancel={cancelActiveDraft}
      />
      <p>This question requires AskPayna consent.</p>
      <AssistantActionBar
        chatMode={chatMode}
        actions={actions}
        onAskSurf={() => {
          changeChatMode("asksurf");
          setResearchCount((count) => count + 1);
        }}
        onPayCmd={(query) => {
          changeChatMode("paycmd");
          setInput(query);
        }}
        onRetry={() => staleRetryRef.current()}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => staleConfirmRef.current()}>
          Invoke stale confirm callback
        </Button>
        <Button type="button" variant="outline" onClick={() => staleRetryRef.current()}>
          Invoke stale retry callback
        </Button>
      </div>
      <output data-testid="mode-safety-state">
        {chatMode}:{draftState}:confirmed={confirmedCount}:retried={retriedCount}:submitted={submittedCount}:research={researchCount}
      </output>
    </main>
  );
}

export function CommandCenterPreview() {
  const searchParams = useSearchParams();
  const [paletteInput, setPaletteInput] = useState("/balance a");
  const requestedLease = searchParams.get("previewLease");
  const previewLease: PreviewLeaseFixture =
    requestedLease === "expired" || requestedLease === "legacy" ? requestedLease : "live";

  if (searchParams.get("modeSafety") === "1") {
    return <ModeSafetyFixture />;
  }

  if (searchParams.get("walletContext") === "1") {
    return (
      <main className="mx-auto flex max-w-3xl flex-wrap gap-3 p-8">
        <WalletContextMessageFixture status="verified" />
        <WalletContextMessageFixture status="partial" />
        <WalletContextMessageFixture status="unavailable" />
        <WalletContextMessageFixture status="invalid" />
      </main>
    );
  }

  return (
    <main className="command-center-canvas min-h-dvh text-foreground">
      <div className="mx-auto grid min-h-dvh max-w-[1500px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border/55 bg-surface/88 p-5 lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="font-semibold">Payna</div>
              <div className="text-xs text-muted-foreground">Stablecoin command center</div>
            </div>
          </div>
          <Card className="mt-6 bg-surface-raised/75">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Unified balance</div>
              <div className="mt-1 text-2xl font-semibold">2,450 USDC</div>
              <div className="mt-2 flex items-center gap-2 text-xs text-success">
                <WalletCards className="h-4 w-4" aria-hidden="true" /> 6 networks ready
              </div>
            </CardContent>
          </Card>
          <nav className="mt-5 space-y-1" aria-label="Desktop navigation">
            {["Chat", "Activity", "Budgets", "Contacts", "Schedules", "Profile"].map((item) => (
              <span key={item} className="flex h-11 items-center rounded-xl px-3 text-sm text-muted-foreground first:bg-primary/12 first:text-primary">
                {item}
              </span>
            ))}
          </nav>
        </aside>

        <section className="flex min-h-0 flex-col pb-20 lg:pb-0">
          <header
            data-testid="desktop-command-toolbar"
            className="flex h-16 min-w-0 items-center justify-between gap-3 overflow-hidden border-b border-border/55 bg-surface/78 px-4 backdrop-blur-xl md:px-7"
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Design fixture</div>
              <h1 className="text-base font-semibold md:text-lg">Command center UI states</h1>
            </div>
            <div className="flex min-w-0 shrink-0 items-center gap-1.5">
              <Badge variant="outline" className="hidden rounded-full border-success/35 bg-success/10 text-success xl:inline-flex">Systems ready</Badge>
              <Button type="button" variant="outline" className="hidden max-w-32 gap-2 rounded-xl px-2.5 sm:inline-flex" aria-label="Switch network: Arc Testnet">
                <Network className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="xl:hidden">Arc</span><span className="hidden xl:inline">Arc Testnet</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" className="hidden max-w-64 gap-2 rounded-xl px-2.5 sm:inline-flex" aria-label="Wallet 0x83…6877, balance 148.49 USDC">
                <Wallet className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                <span className="truncate">0x83…6877</span>
                <span className="hidden text-muted-foreground xl:inline">· 148.49 USDC</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Button>
              <ThemeSwitcher />
            </div>
          </header>

          <div data-testid="command-center-content" className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-7">
            <div className="mx-auto grid max-w-5xl gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
              <Card className="command-panel overflow-hidden">
                <CardContent className="space-y-5 p-5 md:p-6">
                  <ProductionPreviewLeaseFixture lease={previewLease} />
                </CardContent>
              </Card>

              <div className="space-y-5">
                <Card className="command-panel">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground">Bridge progress</div>
                        <div className="mt-1 font-semibold">50 USDC · Base → Arc</div>
                      </div>
                      <Badge className="rounded-full border-waiting/30 bg-waiting/10 text-waiting-foreground" variant="outline">
                        Finalizing
                      </Badge>
                    </div>
                    <ExecutionTimeline status="waiting_gateway" submitted />
                  </CardContent>
                </Card>

                <Card className="border-danger/25 bg-danger/5">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 font-semibold text-danger">
                      <Bell className="h-4 w-4" aria-hidden="true" /> Action needed
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      The transaction was not submitted and no funds moved. Check gas, then retry safely.
                    </p>
                    <Button type="button" variant="outline" className="mt-4 h-11 rounded-xl">Review and retry</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
            <div className="mx-auto mt-5 max-w-5xl">
              <TransactionHistory initialTransactions={previewTransactions} />
            </div>
            <section className="mx-auto mt-5 grid max-w-5xl gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Additional interface states">
              <Card className="command-panel" data-testid="historical-running-status">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Running</div>
                    <Badge variant="success" className="rounded-full">Step completed</Badge>
                  </div>
                  <div className="mt-2 font-semibold">Approve 50 USDC in MetaMask</div>
                  <div className="mt-4"><ExecutionTimeline status="running" isLive={false} /></div>
                </CardContent>
              </Card>
              <Card className="command-panel border-success/30">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-success">Receipt ready</div>
                    <Badge variant="success" className="rounded-full">Completed</Badge>
                  </div>
                  <div className="mt-2 font-semibold">50 USDC delivered on Arc</div>
                  <div className="mt-4"><ExecutionTimeline status="success" /></div>
                </CardContent>
              </Card>
              <Card className="border-waiting/30 bg-waiting/5">
                <CardContent className="p-5">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-waiting-foreground">Funds moved</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Do not retry. Track the source hash while mint finalizes.</p>
                  <div className="mt-4"><ExecutionTimeline status="failed" fundsMoved /></div>
                </CardContent>
              </Card>
              <Card className="command-panel">
                <CardContent className="p-5">
                  <div className="text-xs text-muted-foreground">Unified balance · partial</div>
                  <div className="mt-1 text-2xl font-semibold">≥ 2,450 USDC</div>
                  <p className="mt-2 text-xs leading-5 text-waiting-foreground">Avalanche is temporarily unavailable; this total is a lower bound.</p>
                </CardContent>
              </Card>
              <Card className="command-panel">
                <CardContent className="p-5" role="status" aria-label="Loading state" aria-busy="true">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-4 h-10 w-full" />
                  <Skeleton className="mt-3 h-4 w-2/3" />
                </CardContent>
              </Card>
              <Card className="command-panel border-dashed">
                <CardContent className="p-5 text-center">
                  <div className="font-semibold">No pending activity</div>
                  <p className="mt-2 text-sm text-muted-foreground">New transactions and alerts will appear here.</p>
                </CardContent>
              </Card>
            </section>
            <section className="mx-auto mt-5 max-w-5xl" aria-label="Command palette keyboard fixture">
              <label htmlFor="fixture-command-palette" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Command palette test
              </label>
              <Input
                id="fixture-command-palette"
                value={paletteInput}
                onChange={(event) => setPaletteInput(event.target.value)}
              />
              {paletteInput.startsWith("/") ? (
                <div className="mt-2">
                  <CommandPalette query={paletteInput} onSelect={setPaletteInput} onDismiss={() => setPaletteInput("")} />
                </div>
              ) : null}
            </section>
          </div>
        </section>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <Link href="/app" className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-primary">
          <MessageCircle className="h-5 w-5" aria-hidden="true" /> Chat
        </Link>
        <Link href="/activity" className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
          <Activity className="h-5 w-5" aria-hidden="true" /> Activity
        </Link>
        <Link href="/contacts" className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
          <Contact className="h-5 w-5" aria-hidden="true" /> Contacts
        </Link>
        <button type="button" className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" /> More
        </button>
      </nav>
    </main>
  );
}
