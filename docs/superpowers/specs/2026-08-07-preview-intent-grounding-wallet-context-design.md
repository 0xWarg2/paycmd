# Preview Lease, Intent Safety, and Grounded Wallet Context Design

**Date:** 2026-08-07
**Product version:** 1.0.0
**Status:** Design approved; written spec awaiting review

## Goal

Make the Payna/AskPayna boundary predictable and safe: every transaction preview expires after 15 seconds, AskPayna never creates a transaction preview, Payna does not silently answer unrelated research questions, and transfer guidance can use authenticated Gateway and linked EVM-wallet balances without conflating those balance types.

## Current-state findings

- `submitValue()` currently routes an AskPayna message containing words such as `pay`, `send`, or `transfer` into `/api/ai/command`; that response can create a confirmation preview.
- Preview cards have active/cancelled/confirmed state but no expiry lease or countdown.
- Circle and Arc documentation retrieval already uses the official MCP endpoints and returns provenance-backed HTTPS citations.
- The canonical Payna tutorial is versioned in `content/payna-tutorial.json` and generated from bilingual public docs.
- MetaMask/Wagmi connection, wallet linking, and several wallet-balance reads already exist, but AskPayna does not receive a single authenticated, rail-aware balance context.

## Scope

This design covers:

1. a reusable 15-second preview lease for every confirmation card;
2. a speech-act classifier that separates an action request, a question, and an ambiguous request;
3. hard mode policy that is evaluated separately from semantic intent;
4. a Payna-to-AskPayna consent prompt for research questions;
5. grounded Circle, Arc, and Payna answers using authoritative sources;
6. read-only Gateway, Circle SCA, and linked EVM-wallet context for relevant AskPayna answers;
7. bilingual public documentation and tutorial synchronization.

It does not introduce a new MetaMask transaction rail, automatic mode switching, automatic signing, financial advice, balance aggregation across unlike custody domains, or background transaction execution.

## Chosen architecture

The feature uses two independent decisions:

```text
user input + selected mode
  -> speech-act classification: action | question | ambiguous
  -> hard mode policy
       AskPayna -> answer/explain only; optional switch-to-Payna CTA
       Payna    -> action preview | switch consent | clarification
  -> mode-specific runtime
```

The mode is a capability boundary, not a hint to the model. A classifier may describe an AskPayna input as action-like, but it cannot grant permission to create a preview. Likewise, a question in Payna cannot automatically start research without the user's mode-switch consent.

## Mode policy

| Selected mode | Classified speech act | Result |
|---|---|---|
| AskPayna | question | Run AskPayna and return a grounded answer. |
| AskPayna | action | Explain the requested operation, include relevant balances when available, and offer `Switch to Payna`; never parse or render a preview. |
| AskPayna | ambiguous | Ask a non-transactional clarification; never parse or render a preview. |
| Payna | action | Parse the command; ask for missing fields or create one leased preview. |
| Payna | question | Show `This question fits AskPayna. Switch mode?`; do not run research yet. |
| Payna | ambiguous | Ask whether the user wants an explanation or a transaction; create no preview. |

Slash syntax is explicit action syntax only in Payna mode. Entering `/pay`, `/transfer`, or another confirmable slash command while AskPayna is selected produces a switch-to-Payna prompt, not a preview.

The acceptance example `Làm sao gửi 50 USDC sang Arc nhanh nhất?` is a question. In AskPayna it produces a grounded explanation informed by available balance context. In Payna it produces the AskPayna switch prompt. It never becomes a preview until the user deliberately enters Payna and submits an action.

## Intent contract

`/api/ai/command` gains a structured speech-act contract:

```ts
type SpeechAct = "action" | "question" | "ambiguous";

type IntentDecision = {
  speechAct: SpeechAct;
  confidence: "high" | "medium" | "low";
  reasonCode:
    | "explicit_imperative"
    | "explicit_slash_command"
    | "informational_question"
    | "missing_action_commitment"
    | "conflicting_signals";
};
```

The server receives the selected `chatMode`. It must return no `parsedCommand` unless `chatMode === "paycmd"` and `speechAct === "action"`. The client repeats that guard before creating a preview. This defense-in-depth invariant is tested directly.

Rules and the model cooperate rather than compete:

- slash syntax in Payna is deterministically action;
- question forms such as `how`, `làm sao`, `what`, `why`, `có nên`, and `phí bao nhiêu` prevent keyword-only promotion to action;
- an explicit imperative with recipient/amount/routing signals may be action;
- conflicting or low-confidence output becomes `ambiguous`, never action;
- a bare occurrence of `pay`, `transfer`, `send`, `wallet`, or `balance` is insufficient to create a preview.

## Preview lease

Every confirmable preview has a 15,000-millisecond lease beginning when the preview message is created. The message metadata persists an ISO `previewExpiresAt` value and, when applicable, `cancellationReason: "expired"`.

A focused module owns the lease calculations:

```ts
const PREVIEW_LEASE_MS = 15_000;

type PreviewLeaseState = {
  expiresAt: string;
  remainingMs: number;
  remainingSeconds: number;
  expired: boolean;
};
```

The UI updates the displayed whole-second countdown on a short interval. It announces time politely and does not announce every sub-second tick. At zero:

1. the card immediately disables Confirm;
2. the persisted draft state becomes `cancelled` with reason `expired`;
3. the active draft pointer is cleared if it references that preview;
4. the card displays `Preview expired — submit the request again`;
5. Cancel is no longer presented as an active operation.

The confirm callback re-evaluates the absolute expiry before executing. This closes the race where a click and timer fire together. A late callback is rejected even if React has not rendered the disabled state yet.

Opening an older chat derives expiry from persisted metadata. Legacy active previews without `previewExpiresAt` are treated as expired rather than receiving a new lease. Creating a new preview continues to cancel the previous active preview.

The 15-second lease is a transaction-preview UX authorization boundary. Existing API authentication, ownership, quote fingerprints, balance checks, and wallet signatures remain the server/onchain security boundaries.

## Preview presentation and accessibility

An active card shows a clock icon and `Confirm within 00:15`, counting down to `00:00`. At five seconds or fewer, the countdown adopts a warning treatment while retaining text and icon cues. Reduced-motion users receive no countdown animation.

The countdown uses `role="timer"`; a separate polite live region announces the initial limit and expiry, avoiding a screen-reader announcement every second. Disabled confirmation retains readable contrast and includes the expiry explanation adjacent to the button.

## AskPayna balance context

Relevant operational questions may receive an authenticated `WalletContext` assembled server-side:

```ts
type WalletContext = {
  gateway: Array<{ chain: string; readyUsdc: string; pendingUsdc?: string }>;
  circleSca: Array<{ chain: string; address: string; usdc: string }>;
  externalWallets: Array<{
    provider: "metamask" | "external";
    address: string;
    chain: string;
    nativeBalance?: string;
    usdc?: string;
  }>;
  status: "verified" | "partial" | "unavailable";
  observedAt: string;
};
```

The context is loaded only for balance, funding, payment-route, transfer-route, gas, and wallet questions. Unrelated Web3 research does not pay the latency cost.

The server uses the authenticated user and persisted linked-wallet records. It never trusts a client-supplied balance, accepts a private key, or asks the model to query a wallet. Public wallet addresses may be used for read-only RPC calls but are excluded from broad web search queries.

Gateway-ready, pending Gateway deposit, Circle SCA, MetaMask USDC, and native gas balances remain separate fields. AskPayna may recommend a route only conditionally and must state which balance can actually fund that rail. It must not add them into one misleading `total balance`.

Balance retrieval is best effort with per-source timeouts. Partial context does not fail the answer. The response states which balance families were unavailable and does not turn missing data into a zero balance.

## Grounding policy

- Payna product usage comes from the canonical Payna tutorial generated from `content/public-docs/{vi,en}`.
- Circle products, including Gateway, CCTP, USDC, and Circle Wallets, use Circle MCP.
- Arc network facts use Arc MCP.
- A mixed Circle-on-Arc question selects both MCP families in parallel.
- Balance observations come from authenticated application services and are labeled with `observedAt`; they are not citations.
- DeepSeek synthesizes retrieved evidence but may not invent citation URLs.
- `partial` and `unavailable` grounding states remain visible and constrain the answer.

The official runtime MCP clients were verified on 2026-08-07: Circle returned Gateway sources and Arc returned network details, deterministic finality, and RPC documentation with HTTPS provenance.

## Error behavior

- Classifier timeout or invalid structured output becomes `ambiguous`; it never becomes action.
- AskPayna retrieval failure produces an explicitly unverified or partially grounded answer with no fabricated source.
- Balance-context failure removes route-specific certainty but does not block a general explanation.
- Preview persistence failure keeps Confirm disabled because expiry cannot be made durable.
- Expiry-update failure still disables the local card and retries persistence; it never re-enables Confirm.
- Mode-switch decline leaves the original mode and input history intact.

## Documentation contract

Every implementation task that changes user-visible behavior must update the matching English and Vietnamese pages under `content/public-docs`. After edits, `npm run docs:sync` regenerates `content/payna-tutorial.json`, and `npm run docs:validate` verifies tutorial/package parity and schema integrity.

This feature updates at least:

- `features/askpayna`;
- `features/payments-and-contacts`;
- `commands/wallet-and-balance`;
- `safety-and-support/security` or `faq` for preview expiry.

## Testing strategy

Unit tests cover speech-act classification in Vietnamese and English, hard mode policy, parsed-command suppression, countdown rounding, exact expiry, legacy preview handling, click/timer races, knowledge-family selection, wallet-context separation, and partial retrieval.

Component tests cover countdown rendering, warning state, expiry copy, disabled confirmation, mode-switch consent, AskPayna action-like questions producing no preview, and Payna research questions producing no automatic research call.

Integration/UI tests cover:

- an AskPayna transfer question with Gateway and external-wallet context;
- `/pay` entered in AskPayna creating no preview;
- an explicit Payna action creating one 15-second preview;
- a preview auto-cancelling at zero and staying cancelled after reload;
- Circle-on-Arc answers showing Circle and Arc citations;
- unavailable balance/MCP sources producing honest partial-state copy.

Full verification includes unit tests, docs validation, ESLint, production build, and targeted Playwright tests at desktop and 390-pixel mobile widths.

## Acceptance criteria

1. No code path can create a preview while AskPayna is selected.
2. The example `Làm sao gửi 50 USDC sang Arc nhanh nhất?` remains explanatory and non-transactional in AskPayna.
3. Payna asks permission to switch for a non-transaction question and does not switch automatically.
4. Every confirmable preview visibly counts down from 15 seconds and cannot confirm at or after expiry.
5. Expired state persists across thread reload and clearly instructs the user to resubmit.
6. Relevant AskPayna answers distinguish Gateway-ready, Circle SCA, and linked EVM-wallet balances.
7. Circle and Arc claims use their official MCP families, while Payna usage uses synchronized product docs.
8. Secret material is never requested, persisted, logged, or sent to retrieval providers.
9. Bilingual docs, tutorial synchronization, unit tests, lint, build, and targeted UI tests pass.

## Out of scope

- A new MetaMask signing or transfer implementation.
- Automatic execution after an AskPayna answer or mode switch.
- Retry, queue, or scheduled execution.
- Combining balances across custody domains into one spendable number.
- Treating the preview lease as a replacement for API authorization or wallet signature checks.
