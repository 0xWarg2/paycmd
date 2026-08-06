# Unified Gateway Source Selection UX Design

## Status

Approved direction: recommended allocation first, with an explicit custom-selection mode.

## Problem

The current Unified Gateway preview treats every usable source as selected when no explicit source list exists. The table renders sources in catalog order, so sources that will actually fund the BurnIntentSet can appear near the bottom while every usable source shows a checked checkbox. This creates three misleading impressions:

1. every checked chain will be debited;
2. the visible row order is the BurnIntentSet order;
3. a source marked “Not needed” is still part of the signed transfer.

The table also requires horizontal scrolling on small screens and makes the maximum debit difficult to understand as one user authorization across several source-specific intents.

## Goals

- When the user enters Unified mode, automatically present Circle's recommended allocation.
- Visually select only sources that have a non-zero allocation.
- Put allocated sources first and preserve their BurnIntentSet order.
- Explain the transfer amount, source allocation, maximum fee reserve, and maximum possible debit before confirmation.
- Keep unused sources available without implying that they will be charged.
- Make manual source selection deliberate, reversible, accessible, and safe during requotes.
- Preserve the quote fingerprint and delegate authorization gates already used before execution.

## Non-goals

- Do not change the server-side greedy allocation algorithm in this feature.
- Do not hardcode a source-chain preference or fee table in the client.
- Do not automatically delegate, deposit, sign, or submit a burn intent.
- Do not let the client reorder the signed BurnIntentSet independently of the allocation order returned by the server.
- Do not add a new API endpoint or persistence model.

## Chosen Approach

Use a two-level interface:

1. **Recommended allocation** is the default view. It contains only sources with non-zero allocations, already ordered by the server. These sources appear selected and are labeled `Recommended · Auto-selected`.
2. **Other available sources** is collapsed by default. The user opens `Customize sources` to enter manual-selection mode.

This separates “Circle/Payna recommends using this source” from “this source is merely eligible.” It also keeps the common path compact without removing advanced control.

## State Model

The existing `selectedGatewaySources` state remains the source-mode discriminator:

- `null`: recommended/automatic mode;
- `string[]`: custom mode containing the exact sources the user permits the allocator to use.

In automatic mode, the estimate request omits `selectedSourceChains`. The server evaluates every eligible source and returns its allocation. The client does not copy those allocations into `selectedGatewaySources`; it derives the selected visual state from `gatewayEstimate.allocations`. This avoids a second quote and prevents an effect loop.

In custom mode, every checkbox change updates `selectedGatewaySources`, triggers a debounced estimate request, clears stale confirmation eligibility while loading, and renders only the new authoritative allocation and fingerprint when the request succeeds.

`Restore recommended` sets `selectedGatewaySources` back to `null` and requotes all eligible sources.

## Primary Flow

### Enter Unified mode

1. The user clicks `Use Unified Gateway`.
2. Payna switches to automatic mode and clears any earlier custom source list.
3. The source-selection area displays `Finding the best Gateway sources…` with an `aria-live="polite"` status.
4. Payna requests a Unified Gateway estimate without `selectedSourceChains`.
5. When the estimate returns, Payna renders allocated sources first in the exact order of `gatewayEstimate.allocations`.
6. Confirm remains disabled until the estimate has a fingerprint, at least one allocation, and no selected allocation requires delegate authorization.

### Review recommended allocation

The preview starts with a compact summary:

- destination amount and chain;
- number of sources used;
- estimated total fee;
- maximum possible debit;
- mint mode.

Each allocated source shows:

- one-based BurnIntent order;
- chain label;
- `Auto-selected` state;
- amount allocated;
- ready balance;
- maximum fee reserve;
- maximum debit;
- localized priority reason;
- delegate requirement, when applicable.

The source checkbox is checked because the source is part of the recommendation. Its accessible label says that the source is auto-selected for the current allocation, not merely eligible.

### Customize sources

1. The user clicks `Customize sources`, which expands the full source list and enters custom mode.
2. Payna initializes the custom list from the currently allocated source chains, not from every usable source.
3. Payna shows all source choices and a `Custom selection` badge.
4. Allocated sources remain first. Remaining usable sources follow in descending ready-balance order, with chain key as the deterministic tie-breaker. Unavailable sources appear last and disabled.
5. The user may add or remove a source, but the interface never permits an empty custom list.
6. Every change displays `Refreshing allocation…`, disables Confirm, and waits for the new quote.
7. `Restore recommended` returns to automatic mode.

## Presentation Model

A pure presentation helper will combine `sources` and `allocations` into ordered rows. It must not mutate either API array.

For each source, the helper produces:

- `sourceChain`;
- `selectionState`: `allocated`, `available`, or `unavailable`;
- `allocationOrder`: a one-based number or `null`;
- `checked`: allocation membership in automatic mode or explicit membership in custom mode;
- `disabled`;
- allocation metrics when present;
- localized-status key;
- original source data for rendering.

Sorting rules are deterministic:

1. allocated sources in `gatewayEstimate.allocations` order;
2. usable but unallocated sources by ready balance descending, then chain key;
3. unusable sources by chain key.

The helper also produces the custom list used on the first manual interaction. That list contains only the current allocated source chains.

## Component Design

### `UnifiedGatewaySourceSelector`

The source selector will be extracted from the large transaction preview component so its state transitions and responsive presentation can be understood independently.

Inputs:

- estimate sources and allocations;
- automatic or custom mode;
- quote loading state;
- delegate loading/message state;
- callbacks for source toggle, restore recommended, return to scoped mode, and delegate authorization;
- destination amount/chain and aggregate quote metrics;
- active/disabled state.

The component does not fetch, quote, sign, authorize, or execute. Its callbacks leave those responsibilities in the existing transaction preview flow.

### Recommended summary

The summary uses plain language:

```text
Deliver                         5 USDC to Base
Sources used                    2
Estimated total fee            ~0.053… USDC
Maximum possible debit         ≤5.055771 USDC
```

The maximum possible debit is visually stronger than the estimated fee because it is the authorization cap the user is confirming.

### Responsive source presentation

- Below the `sm` breakpoint, allocated sources render as stacked cards with no horizontal scrolling.
- At `sm` and above, allocated sources may render as a compact table or aligned grid.
- Custom mode uses the same cards on mobile and a table on larger screens.
- Numeric values use tabular numerals and do not rely on color alone.

## Copy

New bilingual copy must distinguish recommendation from eligibility:

| Meaning | English | Vietnamese |
|---|---|---|
| automatic badge | Recommended · Auto-selected | Đề xuất · Tự động chọn |
| custom badge | Custom selection | Tự chọn source |
| loading | Finding the best Gateway sources… | Đang tìm Gateway source phù hợp nhất… |
| refresh | Refreshing allocation… | Đang cập nhật phân bổ… |
| other sources | Other available sources ({count}) | Source khả dụng khác ({count}) |
| customize | Customize sources | Tùy chỉnh source |
| restore | Restore recommended | Khôi phục đề xuất |
| allocated explanation | These sources will fund the transfer. | Các source này sẽ cấp tiền cho giao dịch. |
| unused explanation | Unused sources will not be charged or signed. | Source không dùng sẽ không bị trừ tiền hoặc đưa vào chữ ký. |
| maximum debit | Maximum possible debit | Tổng trừ tối đa có thể xảy ra |

Existing priority-reason copy remains authoritative for explaining the allocator's choice.

## Delegate and Error States

- A recommended source that needs delegate authorization remains visible in allocation order with an `Authorization required` badge and explicit action.
- Delegate authorization stays a separate confirmation. No BurnIntentSet is partially signed or submitted while authorization is pending.
- A source unsupported by the current Circle SDK is disabled and includes its exclusion reason.
- Unified insufficient balance displays ready balance, maximum usable capacity, shortfall, and exclusions; it never triggers an automatic deposit.
- A quote error keeps the prior allocation from appearing confirmable and offers retry through the existing quote lifecycle.
- A quote or fingerprint change invalidates the earlier confirmable state until the refreshed allocation is visible.
- If a custom source removal would produce an empty list, Payna keeps the last source checked and announces that at least one source is required.

## Accessibility

- The selector and each source group use semantic headings and fieldset/legend relationships where appropriate.
- Every checkbox has a full chain label and selection-state description.
- Quote loading, allocation refresh, and validation messages use polite live regions; blocking failures use assertive alerts.
- All controls are keyboard reachable with visible focus states.
- Badges and priority states include text and do not rely only on green, amber, or disabled opacity.
- Collapsed `Other available sources` exposes `aria-expanded` and `aria-controls`.

## Testing Strategy

### Unit tests

Test the pure presentation helper for:

- allocated sources first in BurnIntentSet order;
- unused sources sorted by ready balance and deterministic tie-breaker;
- unavailable sources last and disabled;
- automatic mode checks only allocated sources;
- custom mode checks only explicit sources;
- first custom interaction starts from allocated sources;
- no source or allocation input array is mutated.

Test selection transitions for:

- entering Unified resets custom selection to automatic mode;
- toggling a source enters custom mode;
- preventing an empty custom list;
- restoring recommended mode;
- confirmation disabled while a custom quote refreshes.

### Component and UI tests

Verify:

- recommended summary and allocated-source order;
- `Auto-selected` versus `Custom selection` copy;
- unused sources are collapsed initially;
- mobile cards do not create horizontal overflow;
- keyboard expansion and checkbox interaction;
- delegate-required, loading, insufficient, and quote-error states;
- bilingual copy renders without truncating critical monetary values.

### Regression tests

The existing scoped Gateway flow, deposit fallback, manual mint selection, fingerprint confirmation, and server-side allocation tests must remain green.

## Acceptance Criteria

1. Clicking Unified automatically shows a quote and visually selects only sources with non-zero allocations.
2. Allocated sources appear first in the exact server allocation/BurnIntentSet order.
3. Unused sources do not appear checked in automatic mode and explicitly state that they will not be charged or signed.
4. The preview shows destination amount, source count, estimated total fee, and maximum possible debit before Confirm.
5. Custom mode begins from the recommended allocated sources, requotes on changes, and can restore automatic mode.
6. Confirm is impossible with a stale/loading quote, empty source list, missing fingerprint, or unresolved delegate requirement.
7. The layout is usable without horizontal scrolling on a 390-pixel viewport and remains compact on desktop.
8. English and Vietnamese copy make recommendation, eligibility, allocation, and maximum debit distinct.
9. No change in this feature mutates funds, delegates, wallets, deposits, or transfers before the user's existing explicit confirmation actions.
10. Unit, component/UI, lint, type/build, and existing Gateway regression checks pass.
