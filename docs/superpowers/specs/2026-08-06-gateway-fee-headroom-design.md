# Gateway Fee Headroom and Quote Refresh Design

Approved direction: reserve a visible, bounded `maxFee` headroom per Unified Gateway intent and treat quote changes as a pre-sign refresh rather than an on-chain failure.

## Problem

The Unified Gateway preview currently fingerprints the exact `maxFeeAtomic` returned by Circle for every allocation. The execution route calls Circle's estimate endpoint again immediately before signing. A one-micro-USDC fee change therefore changes the fingerprint and returns `GATEWAY_QUOTE_CHANGED`, even when the source set, transfer amount, balances, and user-visible risk are materially unchanged.

This protects users from signing an unreviewed fee, but it makes the preview fragile while users read fee details. The resulting lifecycle card also incorrectly describes the pre-sign rejection as an unconfirmed on-chain state.

## Goals

- Absorb ordinary fee fluctuations without silently increasing the user's approved maximum debit.
- Show estimated fee, fee buffer, maximum fee limit, and maximum possible debit before confirmation.
- Reserve the buffered fee in source allocation capacity, so every selected source can fund its transfer amount plus its approved fee limit.
- Re-estimate immediately before signing and proceed only when the fresh required fee fits within the previously approved ceiling.
- Require review again when the ceiling is exceeded, balances cannot fund the approved allocation, sources change, or authorization changes.
- Keep all refresh handling before signing or transfer submission.

## Non-goals

- Do not hardcode Circle's actual gas, transfer, or forwarding fees.
- Do not allow unlimited `maxFee` or automatically raise a ceiling after confirmation.
- Do not automatically sign, delegate, deposit, or submit after a quote refresh.
- Do not change Circle's maximum 16-intent limit or the existing source priority rules.
- Do not apply this policy to CCTP bridge or swap fees.

## Fee Ceiling Policy

All values use USDC atomic units with six decimals. For each intent:

```text
proportionalHeadroom = ceil(requiredMaxFee * 15 / 100)
headroom = clamp(proportionalHeadroom, 5_000, 50_000)
approvedMaxFee = roundUp(requiredMaxFee + headroom, 1_000)
```

This means:

- 15% proportional headroom;
- at least `0.005 USDC` per intent;
- at most `0.05 USDC` before the final sub-`0.001 USDC` rounding increment;
- a `0.001 USDC` ceiling step so micro-USDC changes do not create a new user limit.

The policy constants belong in a pure Gateway fee-policy module and are not Circle fee constants. Circle's `/estimate` response remains the authoritative source for required fees.

For example, a required per-intent `maxFee` of `0.054118 USDC` produces:

```text
required maxFee    0.054118 USDC
15% headroom       0.008118 USDC
approved maxFee    0.063000 USDC
```

The approved maximum is a ceiling, not the expected charge.

## Allocation

The Unified allocator must use `approvedMaxFee`, not Circle's unbuffered `requiredMaxFee`, when calculating usable source capacity:

```text
usable capacity = ready balance - approvedMaxFee
maximum source debit = allocation value + approvedMaxFee
```

This may move a small amount of transfer value to another source when the cheapest source was previously filled to its exact balance. That reallocation is correct because the buffer must be genuinely fundable.

The initial probe may use Circle's required fee to rank candidates. The converged allocation and every subsequent capacity check use the approved fee ceiling.

## Approved Allocation Guard

The estimate response returns an `allocationGuard` containing atomic strings:

```ts
type GatewayAllocationGuard = {
  amountAtomic: string;
  destinationChain: SupportedChain;
  recipientAddress: Address;
  mintGasMode: GatewayMintGasMode;
  allocations: Array<{
    sourceChain: SupportedChain;
    valueAtomic: string;
    quotedMaxFeeAtomic: string;
    approvedMaxFeeAtomic: string;
  }>;
};
```

The existing fingerprint is computed over this guard. The confirmed draft carries both the guard and fingerprint.

`quotedMaxFeeAtomic` is the Circle requirement used to derive the approved ceiling. The server requires `approvedMaxFeeAtomic === gatewayApprovedMaxFee(quotedMaxFeeAtomic)` and separately requires the fresh Circle requirement to fit under that approved ceiling. Keeping both values prevents a client from inventing a larger policy ceiling and avoids rejecting an otherwise safe transfer merely because Circle's fresh fee decreased after preview.

The guard is not authorization. Its SHA-256 fingerprint detects stale client state but is not a signature or MAC. The authenticated execution route therefore treats the guard only as the user's requested allocation and fee ceiling and validates every field—including the bound recipient address—against the command, current server state, and bounded fee policy. A modified guard cannot bypass balance, delegate, fee, amount, destination, recipient, source-count, or source-support checks.

## Pre-sign Revalidation

On Confirm, the execution route:

1. Parses the guard and verifies that its fingerprint, amount, destination, recipient, mint mode, source count, source chains, quoted/approved fee relationship, and allocation sum are valid.
2. Fetches fresh Gateway balances and authorization state.
3. Re-estimates the exact guarded intent values with Circle.
4. Verifies each source can cover `value + approvedMaxFee`.
5. Verifies every intent's base and transfer fee fits its ceiling and the total fresh fee, including forwarding, fits the sum of ceilings.
6. Verifies each ceiling exactly matches the bounded policy applied to its guarded quoted fee; a lower fresh fee does not invalidate an already approved ceiling.
7. Uses fresh `maxBlockHeight` values and the already approved `maxFee` ceilings when constructing the EIP-712 BurnIntentSet.
8. Signs and submits only after all checks pass.

Ordinary fee movement within the approved ceilings therefore does not require another confirmation. The server never substitutes a higher ceiling.

## Refresh Conditions

The route returns `409 GATEWAY_QUOTE_CHANGED` with a structured reason when:

- `fee_ceiling_exceeded`: the fresh fee no longer fits the approved ceilings;
- `balance_changed`: a source cannot cover its guarded maximum debit;
- `authorization_changed`: a selected source now needs authorization;
- `allocation_invalid`: the guard is malformed or no longer matches the command.

The response includes a fresh Unified estimate suitable for rebuilding the preview. It does not sign or submit any partial BurnIntentSet.

## UX

The recommended allocation summary shows:

- transfer amount;
- estimated total fee from Circle;
- fee buffer;
- maximum fee limit;
- maximum possible debit;
- per-source allocation, ready balance, approved maximum fee reserve, and maximum source debit.

Copy must explain that the fee limit is the maximum Circle may collect and that normal execution charges the actual applicable fee.

When a guard is rejected before signing, the command must not enter a terminal on-chain failure state. The UI returns to a refreshed preview and displays:

> Quote refreshed — no funds moved. Review the updated fee or allocation before continuing.

Vietnamese:

> Báo giá đã được cập nhật — chưa có tiền được chuyển. Hãy kiểm tra lại phí hoặc phân bổ trước khi tiếp tục.

The generic "check the explorer" banner is not shown because there is no transaction hash or on-chain submission.

## Error and Safety Invariants

- Confirmed maximum debit never increases after the user's confirmation.
- No wallet approval, EIP-712 signature, delegate mutation, deposit, or transfer occurs before revalidation succeeds.
- A fresh fee below the approved ceiling may proceed without a second confirmation.
- A fresh fee above the ceiling always returns to preview.
- Balance and authorization changes always fail closed.
- Actual transfer receipts continue to use Circle settlement `fees.total`; the preview ceiling is never mislabeled as an actual fee.
- Manual mint and scoped-source behavior remain unchanged in this feature.

## Testing

Pure unit tests cover:

- minimum, proportional, maximum, and rounding headroom cases;
- allocation capacity using approved rather than required fees;
- a micro-USDC fee increase accepted beneath the approved ceiling;
- a fee increase above the ceiling rejected;
- balance, allocation sum, source-order, and policy-bound validation;
- immutable quote and allocation inputs.

Route and transfer tests cover:

- the guard survives estimate → confirmed draft → payment route → transfer route;
- revalidation happens before any signer, signature, or transfer side effect;
- fresh `maxBlockHeight` and approved `maxFee` are signed;
- structured 409 responses contain no submitted transfer ID;
- receipts continue to use actual Circle settlement fees.

UI tests cover:

- estimated fee, buffer, fee limit, and maximum debit copy;
- mobile layout without horizontal overflow;
- quote refresh returns to preview instead of rendering an on-chain failure;
- English and Vietnamese parity and accessibility.

## Acceptance Criteria

1. Micro-USDC fee changes within the displayed ceiling no longer reject an otherwise unchanged Unified transfer.
2. Each allocation reserves enough balance for its transfer value plus buffered maximum fee.
3. The preview distinguishes estimated fee, buffer, fee limit, and maximum debit.
4. Execution never signs with a `maxFee` above the confirmed ceiling.
5. Exceeded ceilings, insufficient guarded balances, changed authorization, or invalid guards return a fresh review state before signing.
6. `GATEWAY_QUOTE_CHANGED` no longer displays an on-chain/explorer failure when no transaction was submitted.
7. Existing Unified allocation ordering, delegate gates, fingerprint confirmation, scoped transfer, payment, and receipt behavior remain green.
8. Unit tests, lint, production build, and desktop/mobile dark/light UI regressions pass.
