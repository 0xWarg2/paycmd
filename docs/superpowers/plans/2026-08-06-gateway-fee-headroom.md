# Gateway Fee Headroom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Unified Gateway quotes tolerate ordinary fee movement within a visible, bounded per-intent ceiling while refreshing exceeded quotes before any execution or wallet approval state begins.

**Architecture:** Add a pure atomic-USDC fee policy and a strict allocation-guard model. Initial Unified estimates allocate against buffered ceilings and return the guard to the client; Confirm performs a read-only preflight that re-estimates the exact guarded intents and accepts them only when current fees, balances, and authorization fit the approved guard. The real execution repeats the same validation, signs with fresh block heights and the approved ceilings, and never raises the user's maximum debit.

**Tech Stack:** TypeScript, Node test runner, Next.js 16 App Router, React 19, Circle Gateway API, EIP-712, Playwright, axe-core.

## Global Constraints

- Circle `/v1/estimate` remains authoritative for actual required and estimated fees.
- Use atomic bigint USDC values for every policy, guard, allocation, and validation calculation.
- Per intent: 15% headroom, minimum `5_000`, maximum `50_000`, then round the approved ceiling up to `1_000` atomic units.
- Allocation capacity must reserve the approved ceiling before assigning transfer value.
- Never increase an approved ceiling after Confirm.
- Never create a wallet, delegate, signature, deposit, transfer, receipt, proof, or notification during preview or preflight.
- Keep the 16-intent limit, source priority order, scoped Gateway flow, Manual mode, and receipt accounting unchanged.
- Preserve unrelated dirty-worktree files and do not commit mixed pre-existing BurnIntentSet changes.

---

## File Structure

- Create `lib/paycmd/gateway-fee-headroom.ts`: pure fee ceiling policy and validation bounds.
- Create `lib/paycmd/gateway-fee-headroom.test.ts`: literal bigint policy tests.
- Create `lib/paycmd/gateway-allocation-guard.ts`: strict guard construction, parsing, fingerprint payload, and pure current-state validation.
- Create `lib/paycmd/gateway-allocation-guard.test.ts`: guard integrity and safety tests.
- Create `lib/paycmd/gateway-unified-response.ts`: one serializer for initial, refreshed, and preflight estimate payloads.
- Create `lib/paycmd/gateway-unified-response.test.ts`: response-field and atomic-to-decimal contract tests.
- Create `lib/paycmd/gateway-transfer-request.ts`: exact Unified guard/preflight request forwarding shared by transfer and pay routes.
- Create `lib/paycmd/gateway-transfer-request.test.ts`: transport preservation and malformed-field tests.
- Modify `lib/paycmd/gateway-unified-server.ts`: allocate against ceilings, return guards, and revalidate guarded intents.
- Modify `lib/paycmd/gateway-allocation.test.ts`: prove buffered capacity affects greedy allocation correctly.
- Modify `app/api/gateway/transfer/estimate/route.ts`: expose guard, buffer, fee limit, and maximum debit.
- Modify `app/api/gateway/transfer/route.ts`: accept the guard, support read-only preflight, and sign validated ceilings with fresh block heights.
- Modify `app/api/payments/pay/route.ts`: forward guard/preflight and return before payment side effects.
- Modify `components/paycmd-app.tsx`: carry the guard, run preflight before Confirm, refresh the preview on 409, and show fee protection metrics.
- Modify `components/paycmd-runtime.tsx`: forward guards in the second execution surface and classify residual quote-change errors as pre-submit.
- Modify `lib/paycmd/ui-models.ts` and tests: mark `GATEWAY_QUOTE_CHANGED` as no-funds-moved/reviewable.
- Modify `lib/i18n.tsx`: paired Vietnamese and English fee-ceiling and refresh copy.
- Modify `components/unified-gateway-source-selector.tsx` and its fixture/tests: display estimated fee, buffer, fee limit, and maximum debit responsively.

### Task 1: Pure fee headroom policy

**Files:**
- Create: `lib/paycmd/gateway-fee-headroom.ts`
- Create: `lib/paycmd/gateway-fee-headroom.test.ts`

**Interfaces:**
- Produces `gatewayApprovedMaxFee(requiredMaxFeeAtomic: bigint): bigint`.
- Produces `gatewayFeeHeadroom(requiredMaxFeeAtomic: bigint): bigint`, defined as the final rounded approved ceiling minus the required fee.
- Produces `gatewayApprovedFeeWithinPolicy(quotedRequired, approved): boolean`.
- Consumed by allocation and guard validation tasks.

- [ ] **Step 1: Write failing literal bigint tests**

Cover the minimum, proportional, maximum, and rounding rules:

```ts
assert.equal(gatewayApprovedMaxFee(1_000n), 6_000n);
assert.equal(gatewayApprovedMaxFee(54_118n), 63_000n);
assert.equal(gatewayApprovedMaxFee(1_000_000n), 1_050_000n);
assert.equal(gatewayFeeHeadroom(54_118n), 8_882n);
assert.equal(gatewayApprovedFeeWithinPolicy(54_123n, 63_000n), true);
assert.equal(gatewayApprovedFeeWithinPolicy(63_001n, 63_000n), false);
assert.equal(gatewayApprovedFeeWithinPolicy(1_000n, 100_000n), false);
```

The production change that makes these pass is a pure bigint policy; no Circle or route mocks are allowed.

- [ ] **Step 2: Run the test and verify RED**

Run `node --test lib/paycmd/gateway-fee-headroom.test.ts`.

Expected: module/export-not-found failure because the policy does not exist.

- [ ] **Step 3: Implement the minimal policy**

Use named atomic constants and ceiling division:

```ts
export const GATEWAY_FEE_HEADROOM_BPS = 1_500n;
export const GATEWAY_FEE_HEADROOM_MIN_ATOMIC = 5_000n;
export const GATEWAY_FEE_HEADROOM_MAX_ATOMIC = 50_000n;
export const GATEWAY_FEE_CEILING_STEP_ATOMIC = 1_000n;

function divCeil(value: bigint, divisor: bigint) {
  return (value + divisor - 1n) / divisor;
}

export function gatewayApprovedMaxFee(requiredMaxFeeAtomic: bigint) {
  if (requiredMaxFeeAtomic <= 0n) throw new Error("Gateway required maxFee must be positive.");
  const proportional = divCeil(requiredMaxFeeAtomic * GATEWAY_FEE_HEADROOM_BPS, 10_000n);
  const rawHeadroom = proportional < GATEWAY_FEE_HEADROOM_MIN_ATOMIC
    ? GATEWAY_FEE_HEADROOM_MIN_ATOMIC
    : proportional > GATEWAY_FEE_HEADROOM_MAX_ATOMIC
      ? GATEWAY_FEE_HEADROOM_MAX_ATOMIC
      : proportional;
  return divCeil(
    requiredMaxFeeAtomic + rawHeadroom,
    GATEWAY_FEE_CEILING_STEP_ATOMIC,
  ) * GATEWAY_FEE_CEILING_STEP_ATOMIC;
}
```

`gatewayApprovedFeeWithinPolicy` must return exact equality with `gatewayApprovedMaxFee(quotedRequired)`; it validates the guarded quote/ceiling pair, never a later fresh fee.

- [ ] **Step 4: Run targeted and full unit tests**

Run:

```bash
node --test lib/paycmd/gateway-fee-headroom.test.ts
npm test
```

Expected: policy tests and existing Gateway fee tests pass.

### Task 2: Allocation guard and safety validation

**Files:**
- Create: `lib/paycmd/gateway-allocation-guard.ts`
- Create: `lib/paycmd/gateway-allocation-guard.test.ts`

**Interfaces:**
- Produces `GatewayAllocationGuard` and `GatewayAllocationGuardAllocation`.
- Produces `gatewayAllocationGuardFingerprint(guard)`.
- Produces `parseGatewayAllocationGuard(value)`.
- Produces `validateGatewayAllocationGuardCurrentState(input)` with a discriminated result.

- [ ] **Step 1: Write failing construction and parser tests**

Use this exact public shape:

```ts
export type GatewayAllocationGuard = {
  amountAtomic: string;
  destinationChain: string;
  recipientAddress: string;
  mintGasMode: "auto_forwarding" | "manual";
  allocations: Array<{
    sourceChain: string;
    valueAtomic: string;
    quotedMaxFeeAtomic: string;
    approvedMaxFeeAtomic: string;
  }>;
};
```

Assert that parsing rejects zero/negative values, duplicates, unsupported source chains, an invalid recipient address, more than 16 allocations, allocation sums unequal to `amountAtomic`, and invalid mint modes. Assert round-trip parsing does not mutate the input.

- [ ] **Step 2: Run parser tests and verify RED**

Run `node --test lib/paycmd/gateway-allocation-guard.test.ts`.

Expected: module/export-not-found failure.

- [ ] **Step 3: Implement strict parsing and fingerprinting**

Normalize only validated values, lowercase the validated EVM recipient address, preserve allocation order, and fingerprint the normalized object with SHA-256. Use `isSupportedGatewayChain` for chain validation and exact decimal-string bigint parsing; never accept JavaScript numbers in a guard. Treat the fingerprint only as stale-state detection, not authentication.

- [ ] **Step 4: Write failing current-state tests**

Test one accepted case where a fresh required fee increases by five atomic units but remains below the guard ceiling. Add separate rejected cases with reason codes:

```ts
type GatewayGuardRejectionReason =
  | "fee_ceiling_exceeded"
  | "balance_changed"
  | "authorization_changed"
  | "allocation_invalid";
```

Inputs include current balances, authorization, fresh per-intent required fees, fresh total fee, and the parsed guard. Assert:

- each `value + approvedMaxFee` fits the current source balance;
- each approved ceiling exactly equals `gatewayApprovedMaxFee(quotedMaxFeeAtomic)`;
- each fresh base/transfer requirement fits its per-intent ceiling, even when it has fallen far below the guarded quoted fee;
- fresh total fee fits the sum of ceilings;
- authorization is true for every source;
- the guarded recipient equals the command recipient after address normalization;
- accepted output preserves guard order and ceilings.

- [ ] **Step 5: Implement current-state validation and verify GREEN**

Return `{ ok: true, allocations }` or `{ ok: false, reason }`; do not throw for expected refresh conditions. Run the targeted guard tests, then `npm test`.

### Task 3: Buffered allocation and guarded revalidation server flow

**Files:**
- Modify: `lib/paycmd/gateway-unified-server.ts`
- Modify: `lib/paycmd/gateway-allocation.test.ts`
- Test: `lib/paycmd/gateway-allocation-guard.test.ts`

**Interfaces:**
- `UnifiedGatewayQuote` gains `allocationGuard`, `totalFeeBufferAtomic`, and ceiling-based allocations.
- Produces `revalidateUnifiedGatewayTransfer(input)` returning a `UnifiedGatewayQuote` or a typed `GatewayQuoteChangedError`.

- [ ] **Step 1: Write a failing buffered-allocation test**

Add a candidate whose balance previously fit `value + requiredMaxFee` exactly but not `value + approvedMaxFee`. Assert the allocator receives the approved fee and shifts the uncovered value to the next source while preserving priority order.

- [ ] **Step 2: Run the allocation test and verify RED**

Run `node --test lib/paycmd/gateway-allocation.test.ts`.

Expected: the old allocation fills the first source too far or returns the old maximum debit.

- [ ] **Step 3: Apply ceilings during quote convergence**

Whenever a Circle intent estimate supplies `maxFeeAtomic`, convert it with `gatewayApprovedMaxFee` before constructing allocator candidates. Convergence compares allocations against approved ceilings. Set each final BurnIntent preview `maxFee` to its allocation ceiling while keeping Circle's `atomicFee` as the estimated fee.

Build `allocationGuard` from the converged recipient, atomic allocation values, Circle quoted max fees, and approved ceilings. Compute:

```ts
const approvedMaximumFeeAtomic = allocations.reduce(
  (total, allocation) => total + allocation.maxFeeAtomic,
  0n,
);
const totalFeeBufferAtomic = approvedMaximumFeeAtomic - quote.atomicFee;
```

Return the approved total as `quote.maxFeeAtomic`; do not overwrite `quote.atomicFee` or its fee breakdown.

- [ ] **Step 4: Write failing guarded revalidation tests**

Inject deterministic dependencies for balance/authorization reads and Circle estimation. Prove that revalidation:

- estimates the exact guarded allocation values rather than running greedy allocation again;
- accepts a fresh fee beneath the ceiling;
- rejects above-ceiling, balance, and authorization changes with the correct reason;
- replaces `maxBlockHeight` with fresh Circle values;
- keeps guard `approvedMaxFeeAtomic` in the BurnIntent to be signed;
- makes no signer/delegate/transfer calls.

- [ ] **Step 5: Implement revalidation and verify GREEN**

Factor shared read-only source-status loading from `quoteUnifiedGatewayTransfer`. `revalidateUnifiedGatewayTransfer` builds exact intents in guard order, calls the set estimate once, validates current state, and returns a quote whose burn intents combine fresh block heights with guarded max fees.

Run targeted server/guard tests and `npm test`.

### Task 4: Estimate, preflight, execution, and payment transport

**Files:**
- Modify: `app/api/gateway/transfer/estimate/route.ts`
- Modify: `app/api/gateway/transfer/route.ts`
- Modify: `app/api/payments/pay/route.ts`
- Create: `lib/paycmd/gateway-unified-response.ts`
- Create: `lib/paycmd/gateway-unified-response.test.ts`
- Create: `lib/paycmd/gateway-transfer-request.ts`
- Create: `lib/paycmd/gateway-transfer-request.test.ts`
- Modify: `lib/paycmd/gateway-transfer.test.ts`

**Interfaces:**
- Estimate returns `allocationGuard`, `totalFeeBuffer`, `maximumGatewayFee`, and ceiling-based per-source reserves.
- Transfer accepts `allocationGuard` and `preflightOnly`.
- Payment accepts and forwards the same fields.
- `gatewayUnifiedEstimateResponse(unified, amountAtomic)` is the only mapper for estimate, refresh, and preflight response bodies.
- `gatewayUnifiedRequestFields(body)` is the only mapper that forwards `allocationGuard`, `allocationFingerprint`, and `preflightOnly` between API routes.

- [ ] **Step 1: Write failing response and request-contract tests**

In `gateway-unified-response.test.ts`, construct a quote with bigint fee fields and assert `gatewayUnifiedEstimateResponse` returns the complete guard unchanged plus `totalEstimatedFee`, `totalFeeBuffer`, `maximumGatewayFee`, and `maximumDebit` in decimal USDC. Assert the refreshed response has exactly the same field contract as the initial estimate.

In `gateway-transfer-request.test.ts`, assert `gatewayUnifiedRequestFields` preserves the complete guard object and fingerprint, accepts `preflightOnly` only when it is exactly `true`, and omits Unified-only fields when absent. Guard validity remains the responsibility of `parseGatewayAllocationGuard` at the transfer boundary; add a transfer test proving malformed guards return before signer initialization.

Run:

```bash
node --test lib/paycmd/gateway-unified-response.test.ts lib/paycmd/gateway-transfer-request.test.ts
```

Expected: module/export-not-found failures.

- [ ] **Step 2: Add estimate response fields**

Implement `gatewayUnifiedEstimateResponse` and replace the inline Unified response mapping in the estimate route with it. Return atomic guard strings unchanged and decimal display values derived from bigint:

```ts
allocationGuard: unified.allocationGuard,
totalFeeBuffer: atomicUsdc(unified.totalFeeBufferAtomic),
maximumGatewayFee: atomicUsdc(unified.quote.maxFeeAtomic),
maximumDebit: atomicUsdc(amountInAtomicUnits + unified.quote.maxFeeAtomic),
```

- [ ] **Step 3: Replace exact live-fingerprint comparison**

For Unified execution, require both `allocationGuard` and `allocationFingerprint`. Parse the guard; compare its normalized fingerprint, amount, destination, recipient, and mint mode to the request; then call `revalidateUnifiedGatewayTransfer`. Do not run the greedy quote path for a confirmed guard.

On expected rejection return:

```ts
return NextResponse.json({
  error: "GATEWAY_QUOTE_CHANGED",
  reason: rejection.reason,
  message: "Quote refreshed — no funds moved. Review the updated fee or allocation before continuing.",
  refreshedEstimate,
  partialBurnSubmitted: false,
}, { status: 409 });
```

Build `refreshedEstimate` with `gatewayUnifiedEstimateResponse`; never hand-assemble a reduced 409 payload that the client cannot render as a full replacement estimate.

- [ ] **Step 4: Implement read-only `preflightOnly`**

After guarded revalidation and all delegate checks, but before signer creation, signing, transfer submission, receipt/proof writes, or notification writes, return `{ valid: true, estimate: refreshedEstimate }` when `preflightOnly === true`.

The normal execution path uses the same already validated burn intents. It must not reallocate or raise max fees between validation and signing.

- [ ] **Step 5: Forward through payments without side effects**

Use `gatewayUnifiedRequestFields(body)` in both transfer request normalization and `/api/payments/pay`, so payment forwards `allocationGuard`, `allocationFingerprint`, and `preflightOnly` unchanged. When the transfer response is a successful preflight, return it immediately before RA proof, history, recipient notification, or payment bookkeeping.

Do not modify `app/api/payment-requests/[id]/pay/route.ts`: its current contract is source-scoped and cannot originate a Unified command, so it must not silently acquire a partial Unified transport path.

- [ ] **Step 6: Verify route and regression tests**

Run `npm test`. Confirm existing fee parsing, transfer submission, settlement, and receipt tests still pass.

### Task 5: Client guard transport and pre-confirm refresh UX

**Files:**
- Modify: `components/paycmd-app.tsx`
- Modify: `components/paycmd-runtime.tsx`
- Modify: `lib/paycmd/ui-models.ts`
- Modify: `lib/paycmd/ui-models.test.ts`
- Modify: `lib/i18n.tsx`

**Interfaces:**
- `GatewayTransferEstimateSummary` gains `allocationGuard` and `totalFeeBuffer`.
- Confirmed draft stores `allocationGuard` as JSON and forwards it unchanged.
- Confirm button runs a read-only preflight before parent `onConfirm`.

- [ ] **Step 1: Write failing UI-model tests for quote refresh safety**

Assert `canSafelyRetryExecutionFailure` treats `GATEWAY_QUOTE_CHANGED` as pre-submit only when `fundsMoved` and `transferSubmitted` are false. Add `gatewayAllocationGuardDraftField(guard)` and `parseGatewayAllocationGuardDraftField(field)` to `ui-models.ts`; test round-trip serialization through `ParsedCommand.fields` without number conversion, malformed JSON returning `undefined`, and atomic strings remaining exact.

- [ ] **Step 2: Carry the guard across both client execution surfaces**

Store:

```ts
allocationGuard: gatewayEstimate?.allocationGuard
  ? JSON.stringify(gatewayEstimate.allocationGuard)
  : "",
```

Parse only with `parseGatewayAllocationGuardDraftField` when constructing transfer/pay bodies. Forward the same value from both `paycmd-app.tsx` and `paycmd-runtime.tsx`.

- [ ] **Step 3: Add preflight before confirmation**

Inside `CommandPreviewCard`, make the Unified Confirm handler async:

1. set `gatewayPreflightLoading` and clear the refresh message;
2. POST the final draft body with `preflightOnly: true` to `/api/gateway/transfer` or `/api/payments/pay` according to the command;
3. on `{ valid: true }`, call the existing parent `onConfirm` exactly once;
4. on `409 GATEWAY_QUOTE_CHANGED`, replace `gatewayEstimate` with `error.data.refreshedEstimate`; the final draft is derived again from that state so its guard and fingerprint update together; display the refresh message and keep the preview active;
5. never call parent `onConfirm` on preflight failure.

Disable Confirm while preflight is running. Use a polite status message, not a transaction error timeline.

- [ ] **Step 4: Add exact bilingual copy**

Add paired keys for:

- `Estimated fee` / `Phí ước tính`;
- `Fee buffer` / `Khoảng đệm phí`;
- `Fee protection limit` / `Giới hạn bảo vệ phí`;
- `Quote refreshed — no funds moved...` / `Báo giá đã được cập nhật — chưa có tiền được chuyển...`;
- explanation that only the applicable Circle fee is charged and the limit is the approved maximum.

Keep placeholders identical between locales.

- [ ] **Step 5: Keep residual execution errors non-on-chain**

If the tiny interval between preflight and execution still returns `GATEWAY_QUOTE_CHANGED`, classify it as safe and render the no-funds-moved review copy. Never show explorer guidance without a transaction hash.

- [ ] **Step 6: Run unit, lint, and build checks**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: unit/build pass and lint has zero errors; unrelated pre-existing warnings may remain.

### Task 6: Responsive fee-ceiling presentation and final verification

**Files:**
- Modify: `components/unified-gateway-source-selector.tsx`
- Modify: `components/unified-gateway-source-selector-preview.tsx`
- Modify: `tests/ui/unified-gateway-selector.spec.ts`

**Interfaces:**
- Selector props gain `totalFeeBuffer` and `maximumGatewayFee`.
- Existing source cards continue to display ceiling-based `maximumFeeReserve` and `maximumDebit`.

- [ ] **Step 1: Write failing Playwright assertions**

Use the deterministic 5-USDC fixture and assert visible English copy/values:

```ts
await expect(selector.getByText("Estimated total fee")).toBeVisible();
await expect(selector.getByText("Fee buffer")).toBeVisible();
await expect(selector.getByText("Fee protection limit")).toBeVisible();
await expect(selector.getByText("Maximum possible debit")).toBeVisible();
```

Assert the fee limit is greater than the estimated fee, the 390-pixel selector has no horizontal overflow, and serious/critical axe violations remain empty in dark and light themes.

- [ ] **Step 2: Run UI test and verify RED**

Run the selector test on `desktop-1440` and `mobile-390`; expect missing fee-buffer/limit labels.

- [ ] **Step 3: Implement responsive summary metrics**

Add fee buffer and fee limit to the existing responsive definition list. Keep tabular numerals, semantic `dt`/`dd`, text labels, and no color-only distinction. Keep per-source reserve labels explicitly maximum values.

- [ ] **Step 4: Run fresh complete verification**

Run sequentially:

```bash
git diff --check
npm test
npm run lint
npm run build
npx playwright test tests/ui/command-center.spec.ts tests/ui/unified-gateway-selector.spec.ts --project=desktop-1440 --project=mobile-390 --project=desktop-1440-light --project=mobile-390-light --workers=1
```

Expected: diff check, unit tests, build, and UI tests pass; lint has zero errors. `--workers=1` avoids the known Next dev cold-compile stampede seen when five fixture requests start concurrently.

- [ ] **Step 5: Audit safety invariants**

For each acceptance criterion in the design spec, record the exact unit/UI test or production guard that proves it. Confirm no Circle transfer, wallet, delegate, deposit, proof, receipt, or notification side effect ran during automated preview/preflight tests.
