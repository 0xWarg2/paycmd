# Preview Lease, Intent Safety, and Grounded Wallet Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce a 15-second preview lease, make AskPayna incapable of creating transaction previews, add consent-based mode fallback, and ground transfer guidance with authoritative docs plus rail-aware user balances.

**Architecture:** Pure modules own preview time arithmetic and mode policy. The API returns a structured speech act, but selected mode remains the hard capability boundary. AskPayna enriches only relevant questions with a server-built, read-only wallet context and keeps Gateway, Circle SCA, and external-wallet balances separate.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Node test runner, Supabase, Wagmi/Viem, Circle and Arc MCP, Playwright, bilingual Markdown public docs.

## Global Constraints

- Every confirmable preview lease is exactly `15_000` milliseconds.
- AskPayna must never create or render a transaction preview, including for slash commands.
- Payna must ask for consent before switching a question to AskPayna.
- Low-confidence, invalid, or timed-out classification must become `ambiguous`, never `action`.
- No new MetaMask signing or transaction rail is introduced.
- Gateway-ready, pending Gateway, Circle SCA, external-wallet USDC, and native gas balances remain separate.
- Payna usage is grounded in the synchronized tutorial; Circle facts use Circle MCP; Arc facts use Arc MCP.
- Product behavior changes update English and Vietnamese public docs, then run `npm run docs:sync` and `npm run docs:validate`.
- Production code follows test-first red-green-refactor.

---

## File Structure

- Create `lib/paycmd/preview-lease.ts`: pure preview-expiry calculations and confirm guard.
- Create `lib/paycmd/preview-lease.test.ts`: expiry, rounding, legacy, and race tests.
- Create `components/paycmd/preview-lease-timer.tsx`: accessible countdown UI.
- Create `lib/paycmd/ai/intent-policy.ts`: speech-act normalization and hard mode policy.
- Create `lib/paycmd/ai/intent-policy.test.ts`: bilingual and mode-boundary tests.
- Modify `app/api/ai/command/route.ts`: accept `chatMode`, emit `decision`, and suppress forbidden parsed commands.
- Modify `components/paycmd-app.tsx`: persist preview lease metadata, route by hard mode policy, and add switch CTAs.
- Modify `lib/i18n.tsx` and `lib/i18n/server.ts`: bilingual lease and mode-consent copy.
- Create `lib/paycmd/ai/wallet-context.ts`: wallet-context types, relevance gate, normalization, and formatting.
- Create `lib/paycmd/ai/wallet-context.test.ts`: rail separation, partial status, privacy, and formatting tests.
- Create `lib/paycmd/ai/wallet-context-server.ts`: authenticated Gateway/SCA/external-wallet reads.
- Modify `app/api/ai/crypto/route.ts`: load and inject wallet context only for relevant questions.
- Modify `lib/paycmd/ai/knowledge-types.ts` and related response types only where the wallet-context status must cross the API boundary.
- Modify bilingual files under `content/public-docs`: document mode safety, expiry, wallet context, and grounding.
- Modify `tests/ui/command-center.spec.ts` and the dev UI preview: verify visible countdown and accessibility.

---

### Task 1: Preview lease domain model

**Files:**
- Create: `lib/paycmd/preview-lease.ts`
- Create: `lib/paycmd/preview-lease.test.ts`

**Interfaces:**
- Produces: `PREVIEW_LEASE_MS`, `createPreviewExpiresAt(nowMs)`, `previewLeaseState(expiresAt, nowMs)`, `previewCanConfirm(input, nowMs)`.
- Consumes: ISO timestamps and persisted draft state only; no React or database dependency.

- [ ] **Step 1: Write failing lease tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  PREVIEW_LEASE_MS,
  createPreviewExpiresAt,
  previewCanConfirm,
  previewLeaseState,
} from "./preview-lease.ts";

test("creates an exact fifteen-second preview lease", () => {
  assert.equal(PREVIEW_LEASE_MS, 15_000);
  assert.equal(createPreviewExpiresAt(1_000), new Date(16_000).toISOString());
});

test("rounds remaining display time up and expires at the boundary", () => {
  const expiresAt = new Date(15_000).toISOString();
  assert.deepEqual(previewLeaseState(expiresAt, 10_001), {
    expiresAt,
    remainingMs: 4_999,
    remainingSeconds: 5,
    expired: false,
  });
  assert.equal(previewLeaseState(expiresAt, 15_000).expired, true);
});

test("refuses cancelled, confirmed, missing-expiry, and late previews", () => {
  const expiresAt = new Date(15_000).toISOString();
  assert.equal(previewCanConfirm({ draftState: "active", previewExpiresAt: expiresAt }, 14_999), true);
  assert.equal(previewCanConfirm({ draftState: "active", previewExpiresAt: expiresAt }, 15_000), false);
  assert.equal(previewCanConfirm({ draftState: "cancelled", previewExpiresAt: expiresAt }, 1), false);
  assert.equal(previewCanConfirm({ draftState: "confirmed", previewExpiresAt: expiresAt }, 1), false);
  assert.equal(previewCanConfirm({ draftState: "active" }, 1), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test lib/paycmd/preview-lease.test.ts`

Expected: FAIL with module-not-found because `preview-lease.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure model**

```ts
export const PREVIEW_LEASE_MS = 15_000;

export type PreviewDraftState = "active" | "cancelled" | "confirmed";

export function createPreviewExpiresAt(nowMs = Date.now()) {
  return new Date(nowMs + PREVIEW_LEASE_MS).toISOString();
}

export function previewLeaseState(expiresAt: string, nowMs = Date.now()) {
  const expiryMs = Date.parse(expiresAt);
  const remainingMs = Number.isFinite(expiryMs) ? Math.max(0, expiryMs - nowMs) : 0;
  return {
    expiresAt,
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    expired: remainingMs === 0,
  };
}

export function previewCanConfirm(
  input: { draftState?: PreviewDraftState; previewExpiresAt?: string },
  nowMs = Date.now(),
) {
  return input.draftState === "active"
    && Boolean(input.previewExpiresAt)
    && !previewLeaseState(input.previewExpiresAt!, nowMs).expired;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test lib/paycmd/preview-lease.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the lease model**

```bash
git add lib/paycmd/preview-lease.ts lib/paycmd/preview-lease.test.ts
git commit -m "feat: add transaction preview lease model"
```

---

### Task 2: Persist and render expiring previews

**Files:**
- Create: `components/paycmd/preview-lease-timer.tsx`
- Modify: `components/paycmd-app.tsx`
- Modify: `lib/i18n.tsx`
- Modify: `lib/i18n/server.ts`
- Modify: `app/dev/ui-preview/page.tsx`
- Test: `tests/ui/command-center.spec.ts`

**Interfaces:**
- Consumes: Task 1's `previewLeaseState()` and `previewCanConfirm()`.
- Produces: `PreviewLeaseTimer({ expiresAt, onExpire })`, persisted `previewExpiresAt`, and `cancellationReason: "expired"` metadata.

- [ ] **Step 1: Add a failing Playwright expectation to the dev preview**

```ts
test("expires a transaction preview after fifteen seconds", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-08-07T00:00:00.000Z") });
  await page.goto("/dev/ui-preview");

  await expect(page.getByRole("timer")).toHaveText("00:15");
  await page.clock.fastForward(15_000);

  await expect(page.getByRole("button", { name: /Confirm 50 USDC/i })).toBeDisabled();
  await expect(page.getByText(/Preview expired/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `npx playwright test tests/ui/command-center.spec.ts --grep "expires a transaction preview" --project=chromium`

Expected: FAIL because no timer or expiry copy is rendered.

- [ ] **Step 3: Implement the timer component**

```tsx
"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { previewLeaseState } from "@/lib/paycmd/preview-lease";

export function PreviewLeaseTimer({ expiresAt, onExpire }: {
  expiresAt: string;
  onExpire: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const expiredOnce = useRef(false);
  const lease = previewLeaseState(expiresAt, now);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!lease.expired || expiredOnce.current) return;
    expiredOnce.current = true;
    onExpire();
  }, [lease.expired, onExpire]);

  const seconds = String(lease.remainingSeconds).padStart(2, "0");
  return (
    <div className={lease.remainingSeconds <= 5 ? "text-amber-500" : "text-muted-foreground"}>
      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />
        <span role="timer" aria-label={`00:${seconds} remaining`}>00:{seconds}</span>
      </span>
      <span className="sr-only" aria-live="polite">{lease.expired ? "Preview expired" : "Confirm within fifteen seconds"}</span>
    </div>
  );
}
```

- [ ] **Step 4: Wire durable metadata and the late-click guard**

Update `ChatMessage` and both metadata write paths with:

```ts
previewExpiresAt?: string;
cancellationReason?: "expired";
```

Create previews with one captured expiry:

```ts
const previewExpiresAt = createPreviewExpiresAt();
await saveMessage({
  role: "assistant",
  kind: "preview",
  draft,
  draftState: "active",
  previewExpiresAt,
  text: draft.summary,
});
```

Change `updateDraftState` to accept `{ cancellationReason?: "expired" }`, preserve all metadata, and guard confirmation:

```ts
function confirmDraft(messageId: string, draft: ParsedCommand) {
  const target = messages.find((message) => message.id === messageId);
  if (!target || !previewCanConfirm(target)) {
    void updateDraftState(messageId, "cancelled", { cancellationReason: "expired" });
    return;
  }
  void runForegroundCommand(messageId, draft);
}
```

Legacy active previews without an explicit expiry must be mapped as non-confirmable and auto-cancelled when rendered.

- [ ] **Step 5: Add bilingual copy and the dev-preview state**

Add keys for `preview.confirmWithin`, `preview.expired`, and `preview.resubmit` in both locale catalogs. Render `PreviewLeaseTimer` above `TransactionConfirmActions`; on expiry call `onCancel("expired")`. Add an active leased example to `/dev/ui-preview` so Playwright exercises the production component.

- [ ] **Step 6: Re-run unit and UI checks**

Run: `node --test lib/paycmd/preview-lease.test.ts && npx playwright test tests/ui/command-center.spec.ts --grep "expires a transaction preview" --project=chromium`

Expected: PASS; the confirm button is disabled at exactly 15 seconds.

- [ ] **Step 7: Commit preview persistence and UI**

```bash
git add components/paycmd/preview-lease-timer.tsx components/paycmd-app.tsx lib/i18n.tsx lib/i18n/server.ts app/dev/ui-preview/page.tsx tests/ui/command-center.spec.ts
git commit -m "feat: expire transaction previews after fifteen seconds"
```

---

### Task 3: Speech-act classification and hard mode policy

**Files:**
- Create: `lib/paycmd/ai/intent-policy.ts`
- Create: `lib/paycmd/ai/intent-policy.test.ts`

**Interfaces:**
- Produces: `SpeechAct`, `IntentDecision`, `ModePolicyAction`, `questionSignals()`, `normalizeIntentDecision()`, `applyModePolicy()`.
- Consumes: selected mode, original input, and structured router output.

- [ ] **Step 1: Write failing policy tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { applyModePolicy, normalizeIntentDecision } from "./intent-policy.ts";

test("keeps transfer questions non-transactional in AskPayna", () => {
  const decision = normalizeIntentDecision({ speechAct: "action", confidence: "high", reasonCode: "explicit_imperative" }, "Làm sao gửi 50 USDC sang Arc nhanh nhất?");
  assert.equal(decision.speechAct, "question");
  assert.equal(applyModePolicy("asksurf", decision), "run_askpayna");
});

test("offers AskPayna instead of researching automatically from Payna", () => {
  const decision = normalizeIntentDecision({ speechAct: "question", confidence: "high", reasonCode: "informational_question" }, "Circle Gateway là gì?");
  assert.equal(applyModePolicy("paycmd", decision), "offer_askpayna");
});

test("never grants an action to low-confidence or invalid output", () => {
  assert.equal(normalizeIntentDecision({ speechAct: "action", confidence: "low" }, "send money").speechAct, "ambiguous");
  assert.equal(normalizeIntentDecision({}, "send money").speechAct, "ambiguous");
});

test("allows an explicit action only inside Payna", () => {
  const decision = normalizeIntentDecision({ speechAct: "action", confidence: "high", reasonCode: "explicit_imperative" }, "Gửi 50 USDC cho Minh từ Base sang Arc");
  assert.equal(applyModePolicy("paycmd", decision), "run_payna_action");
  assert.equal(applyModePolicy("asksurf", decision), "run_askpayna");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test lib/paycmd/ai/intent-policy.test.ts`

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement normalization and mode policy**

```ts
export type SpeechAct = "action" | "question" | "ambiguous";
export type ChatMode = "paycmd" | "asksurf";
export type IntentDecision = {
  speechAct: SpeechAct;
  confidence: "high" | "medium" | "low";
  reasonCode: "explicit_imperative" | "explicit_slash_command" | "informational_question" | "missing_action_commitment" | "conflicting_signals";
};
export type ModePolicyAction = "run_payna_action" | "run_askpayna" | "offer_askpayna" | "clarify";

const QUESTION_SIGNAL = /(?:\?|\bhow\b|\bwhat\b|\bwhy\b|\bshould\b|\blàm sao\b|\bla gi\b|\blà gì\b|\bvì sao\b|\bcó nên\b|\bphí (?:là |bao nhiêu))/iu;

export function normalizeIntentDecision(raw: Partial<IntentDecision>, input: string): IntentDecision {
  if (QUESTION_SIGNAL.test(input)) return { speechAct: "question", confidence: "high", reasonCode: "informational_question" };
  if (raw.speechAct !== "action" && raw.speechAct !== "question" && raw.speechAct !== "ambiguous") return { speechAct: "ambiguous", confidence: "low", reasonCode: "conflicting_signals" };
  if (raw.speechAct === "action" && raw.confidence === "low") return { speechAct: "ambiguous", confidence: "low", reasonCode: "missing_action_commitment" };
  return {
    speechAct: raw.speechAct,
    confidence: raw.confidence === "high" || raw.confidence === "medium" ? raw.confidence : "low",
    reasonCode: raw.reasonCode ?? "conflicting_signals",
  };
}

export function applyModePolicy(mode: ChatMode, decision: IntentDecision): ModePolicyAction {
  if (mode === "asksurf") return "run_askpayna";
  if (decision.speechAct === "action") return "run_payna_action";
  if (decision.speechAct === "question") return "offer_askpayna";
  return "clarify";
}
```

- [ ] **Step 4: Re-run and verify GREEN**

Run: `node --test lib/paycmd/ai/intent-policy.test.ts`

Expected: PASS with all policy invariants.

- [ ] **Step 5: Commit the policy module**

```bash
git add lib/paycmd/ai/intent-policy.ts lib/paycmd/ai/intent-policy.test.ts
git commit -m "feat: add safe chat mode intent policy"
```

---

### Task 4: Enforce speech act in the command API

**Files:**
- Modify: `app/api/ai/command/route.ts`
- Modify: `lib/paycmd/ai/schema.ts`
- Modify: `lib/paycmd/ai/intent-policy.ts`
- Create: `lib/paycmd/ai/command-decision.test.ts`

**Interfaces:**
- Consumes: Task 3's `normalizeIntentDecision()` and `applyModePolicy()`.
- Produces: API fields `decision: IntentDecision` and `parsedCommand: null` unless mode policy is `run_payna_action`.

- [ ] **Step 1: Add a failing response-guard test to the policy module**

```ts
test("suppresses a parsed command outside Payna action policy", () => {
  const parsed = parsePayCmd("/pay 50 USDC to Minh on arc from base");
  assert.equal(guardParsedCommand("asksurf", { speechAct: "action", confidence: "high", reasonCode: "explicit_imperative" }, parsed), null);
  assert.equal(guardParsedCommand("paycmd", { speechAct: "question", confidence: "high", reasonCode: "informational_question" }, parsed), null);
  assert.equal(guardParsedCommand("paycmd", { speechAct: "action", confidence: "high", reasonCode: "explicit_imperative" }, parsed)?.command, "pay");
});
```

Import `guardParsedCommand` from `./intent-policy.ts` and `parsePayCmd` from `../commands.ts`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test lib/paycmd/ai/command-decision.test.ts`

Expected: FAIL because `guardParsedCommand` is not exported by `intent-policy.ts`.

- [ ] **Step 3: Add `chatMode` and decision fields to the structured schema and prompt**

The request schema accepts only `paycmd | asksurf`. The model JSON schema must require:

```ts
decision: {
  speechAct: z.enum(["action", "question", "ambiguous"]),
  confidence: z.enum(["high", "medium", "low"]),
  reasonCode: z.enum(["explicit_imperative", "explicit_slash_command", "informational_question", "missing_action_commitment", "conflicting_signals"]),
}
```

Add prompt examples that classify `Làm sao gửi 50 USDC sang Arc nhanh nhất?` and `How do I transfer USDC?` as questions, while `Gửi 50 USDC cho Minh từ Base sang Arc` is action.

- [ ] **Step 4: Apply the server-side guard**

```ts
export function guardParsedCommand(mode: ChatMode, decision: IntentDecision, parsed: ParsedCommand | null) {
  return applyModePolicy(mode, decision) === "run_payna_action" ? parsed : null;
}
```

Normalize model output before building the response. Invalid output returns `decision.speechAct = "ambiguous"`, `intent = "clarify"`, and `parsedCommand = null`.

- [ ] **Step 5: Re-run focused and existing AI tests**

Run: `node --test lib/paycmd/ai/command-decision.test.ts lib/paycmd/ai/*.test.ts`

Expected: PASS; existing knowledge and quota tests remain green.

- [ ] **Step 6: Commit API enforcement**

```bash
git add app/api/ai/command/route.ts lib/paycmd/ai/schema.ts lib/paycmd/ai/intent-policy.ts lib/paycmd/ai/command-decision.test.ts
git commit -m "feat: enforce speech act in Payna command routing"
```

---

### Task 5: Enforce mode boundary and consent in the chat client

**Files:**
- Modify: `components/paycmd-app.tsx`
- Modify: `lib/i18n.tsx`
- Modify: `lib/i18n/server.ts`
- Modify: `lib/paycmd/ai/intent-policy.test.ts`

**Interfaces:**
- Consumes: command API `decision`, existing `switch_to_asksurf`, and a new client-only `switch_to_paycmd` action.
- Produces: AskPayna always calls research/explanation; Payna questions create a consent message; neither transition auto-submits a transaction.

- [ ] **Step 1: Add a failing pure submission-route case**

Extend policy tests with:

```ts
test("routes every AskPayna submission away from the command parser", () => {
  assert.equal(submissionRoute("asksurf", "/pay 50 USDC to Minh on arc from base"), "askpayna");
  assert.equal(submissionRoute("asksurf", "Gửi 50 USDC cho Minh"), "askpayna");
  assert.equal(submissionRoute("paycmd", "/pay 50 USDC to Minh on arc from base"), "payna_slash");
});
```

Import `submissionRoute` from `./intent-policy.ts`. It is intentionally absent before this task.

Run: `node --test lib/paycmd/ai/intent-policy.test.ts`

Expected: FAIL because `submissionRoute` is not implemented.

- [ ] **Step 2: Add and persist `switch_to_paycmd`**

```ts
type AssistantAction =
  | { kind: "switch_to_paycmd"; label: string; query: string }
  | { kind: "switch_to_asksurf"; label: string; query: string; surfMode?: SurfMode; effort?: SurfEffort }
  | { kind: "retry_command"; label: string; draft: ParsedCommand };
```

Normalize it from stored metadata. Clicking it only calls `setChatMode("paycmd")` and `setInput(action.query)`; it does not call `submitValue()`.

- [ ] **Step 3: Rewrite `submitValue()` around the hard selected-mode boundary**

First add the pure helper and use it as the sole top-level branch selector:

```ts
export function submissionRoute(mode: ChatMode, input: string) {
  if (mode === "asksurf") return "askpayna" as const;
  return input.trim().startsWith("/") ? "payna_slash" as const : "command_router" as const;
}
```

```ts
if (chatMode === "asksurf") {
  await askCryptoResearch(value, recentMessages, {
    surfMode: selectedSurfMode,
    effort: selectedSurfEffort,
    offerPaynaSwitch: looksLikePayCmdAction(value) || value.startsWith("/"),
  });
  return;
}

if (value.startsWith("/")) {
  await submitPaynaSlashCommand(value);
  return;
}

await askAiForCommand(value, "paycmd");
```

Remove the current condition that sends action-like AskPayna text to `askAiForCommand()` and remove the automatic `crypto_research -> askCryptoResearch()` branch from Payna. For a Payna question, save an assistant message with `switch_to_asksurf`; clicking that existing action performs the explicit switch and research.

- [ ] **Step 4: Add bilingual consent and safety copy**

Add copy for `mode.askPaynaNeverExecutes`, `mode.switchToPayna`, `mode.questionFitsAskPayna`, `mode.switchToAskPayna`, and `mode.intentAmbiguous`.

- [ ] **Step 5: Run policy, app lint, and TypeScript build checks**

Run: `node --test lib/paycmd/ai/intent-policy.test.ts && npx eslint components/paycmd-app.tsx app/api/ai/command/route.ts lib/paycmd/ai/intent-policy.ts`

Expected: PASS with no unsafe automatic routing branch remaining.

- [ ] **Step 6: Commit client mode safety**

```bash
git add components/paycmd-app.tsx lib/i18n.tsx lib/i18n/server.ts lib/paycmd/ai/intent-policy.test.ts
git commit -m "feat: make AskPayna a non-transactional mode"
```

---

### Task 6: Build rail-aware authenticated wallet context

**Files:**
- Create: `lib/paycmd/ai/wallet-context.ts`
- Create: `lib/paycmd/ai/wallet-context.test.ts`
- Create: `lib/paycmd/ai/wallet-context-server.ts`
- Modify: `app/api/gateway/balance/route.ts`

**Interfaces:**
- Produces: `WalletContext`, `walletContextRelevant(input)`, `buildWalletContext()`, `formatWalletContext()`.
- Consumes: authenticated user ID, shared Gateway balance service, Circle wallets, `user_external_wallets`, chain config, and public RPC reads.

- [ ] **Step 1: Write failing normalization and privacy tests**

```ts
test("keeps spendability domains separate", async () => {
  const context = await buildWalletContext("user-1", {
    gateway: async () => [{ chain: "baseSepolia", readyUsdc: "50", pendingUsdc: "10" }],
    circleSca: async () => [{ chain: "baseSepolia", address: "0x1111111111111111111111111111111111111111", usdc: "25" }],
    externalWallets: async () => [{ provider: "metamask", address: "0x2222222222222222222222222222222222222222", chain: "baseSepolia", usdc: "30", nativeBalance: "0.01" }],
  });
  assert.equal(context.gateway[0].readyUsdc, "50");
  assert.equal(context.circleSca[0].usdc, "25");
  assert.equal(context.externalWallets[0].usdc, "30");
  assert.equal("totalUsdc" in context, false);
});

test("marks partial reads without converting failures to zero", async () => {
  const context = await buildWalletContext("user-1", {
    gateway: async () => { throw new Error("timeout"); },
    circleSca: async () => [],
    externalWallets: async () => [],
  });
  assert.equal(context.status, "partial");
  assert.deepEqual(context.gateway, []);
  assert.match(formatWalletContext(context), /Gateway balance unavailable/);
});

test("loads context only for operational wallet questions", () => {
  assert.equal(walletContextRelevant("Làm sao gửi 50 USDC sang Arc nhanh nhất?"), true);
  assert.equal(walletContextRelevant("Arc consensus hoạt động thế nào?"), false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test lib/paycmd/ai/wallet-context.test.ts`

Expected: FAIL because the wallet-context module does not exist.

- [ ] **Step 3: Implement the pure context builder**

Use `Promise.allSettled`, preserve empty versus unavailable source families, set `observedAt` once, and format the result inside an `UNTRUSTED AUTHENTICATED WALLET OBSERVATIONS` block. Never format a combined total or include provider errors, secrets, cookies, or wallet signatures.

```ts
export type WalletContext = {
  gateway: Array<{ chain: string; readyUsdc: string; pendingUsdc?: string }>;
  circleSca: Array<{ chain: string; address: string; usdc: string }>;
  externalWallets: Array<{ provider: "metamask" | "external"; address: string; chain: string; nativeBalance?: string; usdc?: string }>;
  unavailable: Array<"gateway" | "circle_sca" | "external_wallets">;
  status: "verified" | "partial" | "unavailable";
  observedAt: string;
};
```

- [ ] **Step 4: Extract reusable server balance readers**

Move the authenticated, non-HTTP-specific balance loading currently embedded in `app/api/gateway/balance/route.ts` into `wallet-context-server.ts` (or a focused shared server balance module imported by it). The route must keep its existing response contract.

Read linked wallet rows from `user_external_wallets`. For each supported EVM chain, use configured Viem public clients to read native balance and the chain's USDC contract. Apply an 8-second family timeout, cap wallet/chain reads to configured Payna chains, lowercase addresses for lookup only, and return decimal strings.

- [ ] **Step 5: Re-run focused and Gateway regression tests**

Run: `node --test lib/paycmd/ai/wallet-context.test.ts lib/paycmd/balance-breakdown.test.ts lib/paycmd/balance-scope.test.ts`

Expected: PASS; existing `/balance` presentation data remains unchanged.

- [ ] **Step 6: Commit wallet context**

```bash
git add lib/paycmd/ai/wallet-context.ts lib/paycmd/ai/wallet-context.test.ts lib/paycmd/ai/wallet-context-server.ts app/api/gateway/balance/route.ts
git commit -m "feat: add rail-aware wallet context for AskPayna"
```

---

### Task 7: Inject wallet context into grounded AskPayna answers

**Files:**
- Modify: `app/api/ai/crypto/route.ts`
- Modify: `lib/paycmd/ai/knowledge-types.ts`
- Modify: `components/paycmd-app.tsx`
- Modify: `lib/paycmd/ai/research.test.ts`

**Interfaces:**
- Consumes: Task 6's `walletContextRelevant()`, authenticated loader, and formatter.
- Produces: `assembleResearchContext(...)`, response metadata `walletContextStatus?: "verified" | "partial" | "unavailable"`, and grounded route guidance.

- [ ] **Step 1: Add failing research assembly tests**

```ts
test("injects wallet observations for transfer guidance without making them citations", async () => {
  const result = await assembleResearchContext({
    input: "Làm sao gửi 50 USDC sang Arc nhanh nhất?",
    knowledge: {
      route: { topics: ["circle", "arc"], requiresKnowledge: true, live: false },
      documents: [],
      citations: [
        { title: "Gateway", url: "https://developers.circle.com/gateway", source: "circle" },
        { title: "Arc", url: "https://docs.arc.io/arc-chain", source: "arc" },
      ],
      sources: ["circle", "arc"],
      status: "verified",
    },
    walletContext: {
      gateway: [{ chain: "baseSepolia", readyUsdc: "50" }],
      circleSca: [],
      externalWallets: [{ provider: "metamask", address: "0x2222222222222222222222222222222222222222", chain: "baseSepolia", usdc: "30" }],
      unavailable: [],
      status: "verified",
      observedAt: "2026-08-07T00:00:00.000Z",
    },
  });
  assert.match(result.promptContext, /Gateway ready/);
  assert.match(result.promptContext, /MetaMask/);
  assert.equal(result.citations.some((citation) => citation.source === "wallet"), false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test lib/paycmd/ai/research.test.ts`

Expected: FAIL because research assembly has no wallet-context input.

- [ ] **Step 3: Load context only after authentication and relevance gating**

Inside the crypto route:

```ts
const walletContext = walletContextRelevant(input)
  ? await loadAuthenticatedWalletContext(user.id)
  : null;

const walletEvidence = walletContext ? formatWalletContext(walletContext) : "";
```

Append wallet evidence after official documentation evidence. Prompt instructions must say that balance observations are point-in-time, are not web citations, and must not be combined across rails. Return `walletContextStatus` for UI disclosure.

- [ ] **Step 4: Render context availability without exposing addresses unnecessarily**

Persist `walletContextStatus` in chat message metadata. Display a compact `Balances verified`, `Some balances unavailable`, or `Balances unavailable` badge on relevant AskPayna answers. Full public addresses remain in operational details only, shortened in general explanation UI.

- [ ] **Step 5: Re-run AI tests and live MCP smoke check**

Run: `node --test lib/paycmd/ai/*.test.ts`

Run the existing direct MCP smoke query for `Circle Gateway unified balance Arc` and confirm both retrievals remain `available: true`. Do not assert mutable documentation prose in tests.

- [ ] **Step 6: Commit AskPayna context integration**

```bash
git add app/api/ai/crypto/route.ts lib/paycmd/ai/knowledge-types.ts components/paycmd-app.tsx lib/paycmd/ai/research.test.ts
git commit -m "feat: ground AskPayna routes with user balance context"
```

---

### Task 8: Update public docs and complete feature verification

**Files:**
- Modify: `content/public-docs/en/features/askpayna.md`
- Modify: `content/public-docs/vi/features/askpayna.md`
- Modify: `content/public-docs/en/features/payments-and-contacts.md`
- Modify: `content/public-docs/vi/features/payments-and-contacts.md`
- Modify: `content/public-docs/en/commands/wallet-and-balance.md`
- Modify: `content/public-docs/vi/commands/wallet-and-balance.md`
- Modify: `content/public-docs/en/safety-and-support/security.md`
- Modify: `content/public-docs/vi/safety-and-support/security.md`
- Regenerate: `content/payna-tutorial.json`
- Modify: `lib/paycmd/ai/payna-tutorial.test.ts`
- Modify: `tests/ui/command-center.spec.ts`

**Interfaces:**
- Consumes: completed feature behavior.
- Produces: synchronized product guidance and end-to-end acceptance evidence.

- [ ] **Step 1: Add failing tutorial assertions for the new safety contract**

```ts
test("retrieves AskPayna mode safety and preview expiry guidance", () => {
  const ask = searchPaynaTutorial("AskPayna transfer preview mode", "en");
  const expiry = searchPaynaTutorial("preview hết hạn 15 giây", "vi");
  assert.match(ask.documents.map((document) => document.content).join(" "), /never creates a transaction preview/i);
  assert.match(expiry.documents.map((document) => document.content).join(" "), /15 giây/i);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test lib/paycmd/ai/payna-tutorial.test.ts`

Expected: FAIL because synchronized docs do not contain the new behavior yet.

- [ ] **Step 3: Update bilingual docs with exact behavior**

Document the mode truth table, the non-executing AskPayna transfer example, explicit mode consent, the 15-second expiry and resubmit requirement, balance-family separation, and Circle/Arc/Payna source ownership. Keep English and Vietnamese semantic content aligned and update `lastUpdated` to `2026-08-07`.

- [ ] **Step 4: Synchronize and validate tutorial**

Run: `npm run docs:sync && npm run docs:validate`

Expected: tutorial regenerates from public docs and validates against package version `1.0.0`.

- [ ] **Step 5: Add final mode-boundary Playwright coverage**

Use the dev preview or authenticated mocked route to prove:

```ts
await askPaynaComposer.fill("/pay 50 USDC to Minh on arc from base");
await askPaynaComposer.press("Enter");
await expect(page.getByText(/AskPayna never starts transactions/i)).toBeVisible();
await expect(page.getByRole("button", { name: /Confirm 50 USDC/i })).toHaveCount(0);
```

Also cover the approved Vietnamese example and the Payna research-consent CTA without auto-switch.

- [ ] **Step 6: Run the complete verification matrix**

Run:

```bash
npm test
npm run docs:validate
npm run lint
npm run build
npx playwright test tests/ui/command-center.spec.ts
```

Expected: every command exits 0; no serious/critical accessibility violations; mobile viewport has no horizontal overflow.

- [ ] **Step 7: Commit docs and acceptance coverage**

```bash
git add content/public-docs content/payna-tutorial.json lib/paycmd/ai/payna-tutorial.test.ts tests/ui/command-center.spec.ts
git commit -m "docs: explain Payna mode safety and preview expiry"
```
