# Unified Gateway Source Selection UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Unified Gateway open with a clear recommended allocation, visually select and order only the sources that will fund the BurnIntentSet, and provide a reversible custom-source mode that works on mobile and desktop.

**Architecture:** Add a dependency-free presentation/state module that turns the existing estimate response into deterministic source rows. Extract the Unified selector from `paycmd-app.tsx` into a focused client component, keep fetching and execution state in the existing preview flow, and add a gated fixture route for real responsive and accessibility tests without requiring authentication or Circle calls.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Tailwind CSS, Node test runner, Playwright, axe-core.

## Global Constraints

- Preserve the server-provided allocation order as the BurnIntentSet order.
- In automatic mode, omit `selectedSourceChains`; never copy recommended allocations into selection state through an effect.
- Only custom mode may send an explicit selected-source list.
- Never allow an empty custom source list.
- Do not change the server-side greedy allocator, fee table, quote API, fingerprint contract, delegate flow, or execution routes.
- Do not automatically delegate, deposit, sign, or submit from the selector.
- Keep English and Vietnamese copy semantically equivalent.
- At 390 pixels, the recommended allocation must not require horizontal scrolling.
- Preserve unrelated dirty-worktree files, including the existing BurnIntentSet work and user-owned `output/` and `tmp/`.

---

## File Structure

- Create `lib/paycmd/gateway-source-selection.ts`: API-independent types, ordered presentation rows, recommended custom seed, and non-empty toggle behavior.
- Create `lib/paycmd/gateway-source-selection.test.ts`: literal behavior tests for ordering, checked state, immutability, and selection transitions.
- Create `components/unified-gateway-source-selector.tsx`: responsive recommended/custom selector with no fetching or execution side effects.
- Modify `components/paycmd-app.tsx`: use the selector, retain quote/delegate state ownership, and remove the inline table.
- Modify `lib/i18n.tsx`: add paired Vietnamese and English selector copy.
- Create `components/unified-gateway-source-selector-preview.tsx`: deterministic interactive fixture using the real component.
- Create `app/dev/unified-gateway-preview/page.tsx`: development-only fixture route guarded by `PAYNA_UI_FIXTURE=1`.
- Create `tests/ui/unified-gateway-selector.spec.ts`: responsive, interaction, and accessibility verification against the real component.

### Task 1: Deterministic source presentation and selection state

**Files:**
- Create: `lib/paycmd/gateway-source-selection.ts`
- Create: `lib/paycmd/gateway-source-selection.test.ts`

**Interfaces:**
- Produces `GatewaySourceEstimate`, `GatewayAllocationEstimate`, and `GatewaySourceSelectionRow`.
- Produces `gatewaySourceSelectionRows({ sources, allocations, customSourceChains })`.
- Produces `recommendedGatewaySourceChains(allocations)`.
- Produces `toggleGatewayCustomSource({ currentSourceChains, sourceChain })`.
- Consumed by Task 2 and Task 3.

- [ ] **Step 1: Write the failing ordering and automatic-selection tests**

Create literal fixtures where the source catalog order is Arc, Base, OP, Unichain but the allocation order is Unichain then OP. Assert the output order and checked state independently:

```ts
test("puts allocated sources first in BurnIntentSet order and checks only allocations in automatic mode", () => {
  const rows = gatewaySourceSelectionRows({
    sources: [arc, base, op, unichain],
    allocations: [unichainAllocation, opAllocation],
    customSourceChains: null,
  });

  assert.deepEqual(rows.map((row) => row.sourceChain), [
    "unichainSepolia",
    "optimismSepolia",
    "baseSepolia",
    "arcTestnet",
  ]);
  assert.deepEqual(rows.map((row) => row.checked), [true, true, false, false]);
  assert.deepEqual(rows.map((row) => row.allocationOrder), [1, 2, null, null]);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test lib/paycmd/gateway-source-selection.test.ts
```

Expected: FAIL because `gateway-source-selection.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal immutable row builder**

Implement literal structural types matching the current estimate response. Build maps without sorting `sources` or `allocations` in place. Emit allocated rows by allocation array order, then usable unallocated rows by `readyBalance` descending and `sourceChain`, then unusable rows by `sourceChain`.

```ts
export function gatewaySourceSelectionRows(input: {
  sources: GatewaySourceEstimate[];
  allocations: GatewayAllocationEstimate[];
  customSourceChains: string[] | null;
}): GatewaySourceSelectionRow[];
```

- [ ] **Step 4: Run the ordering test and verify GREEN**

Run `node --test lib/paycmd/gateway-source-selection.test.ts`.

Expected: PASS for automatic ordering and checked-state behavior.

- [ ] **Step 5: Write failing tests for custom mode, disabled rows, and immutability**

Add literal assertions that prove:

```ts
assert.deepEqual(
  gatewaySourceSelectionRows({
    sources: [arc, unsupported, base],
    allocations: [baseAllocation],
    customSourceChains: ["arcTestnet"],
  }).map(({ sourceChain, checked, disabled }) => ({ sourceChain, checked, disabled })),
  [
    { sourceChain: "baseSepolia", checked: false, disabled: false },
    { sourceChain: "arcTestnet", checked: true, disabled: false },
    { sourceChain: "hyperEvmTestnet", checked: false, disabled: true },
  ],
);
assert.deepEqual(sources, originalSources);
assert.deepEqual(allocations, originalAllocations);
```

The production regression caught here is accidental in-place sorting or showing eligible sources checked in automatic mode.

- [ ] **Step 6: Implement custom checked state and unavailable ordering**

Use `customSourceChains === null` to select allocation membership; otherwise use an explicit `Set`. Mark unusable rows disabled regardless of the custom list.

- [ ] **Step 7: Write failing tests for recommended seed and non-empty toggle**

```ts
assert.deepEqual(
  recommendedGatewaySourceChains([unichainAllocation, opAllocation]),
  ["unichainSepolia", "optimismSepolia"],
);
assert.deepEqual(
  toggleGatewayCustomSource({
    currentSourceChains: ["unichainSepolia", "optimismSepolia"],
    sourceChain: "unichainSepolia",
  }),
  ["optimismSepolia"],
);
assert.deepEqual(
  toggleGatewayCustomSource({
    currentSourceChains: ["optimismSepolia"],
    sourceChain: "optimismSepolia",
  }),
  ["optimismSepolia"],
);
```

- [ ] **Step 8: Implement the selection transition helpers**

Deduplicate allocation chains in server order. Toggle a chain by returning a new array and preserve the last selected source when removal would create an empty list.

- [ ] **Step 9: Run targeted and full unit tests**

Run:

```bash
node --test lib/paycmd/gateway-source-selection.test.ts
npm test
```

Expected: the new tests and the existing PayCmd unit suite PASS.

- [ ] **Step 10: Commit Task 1**

```bash
git add lib/paycmd/gateway-source-selection.ts lib/paycmd/gateway-source-selection.test.ts
git commit -m "feat: model Unified Gateway source selection"
```

### Task 2: Responsive Unified source selector

**Files:**
- Create: `components/unified-gateway-source-selector.tsx`
- Modify: `lib/i18n.tsx`
- Create: `components/unified-gateway-source-selector-preview.tsx`
- Create: `app/dev/unified-gateway-preview/page.tsx`
- Create: `tests/ui/unified-gateway-selector.spec.ts`

**Interfaces:**
- Consumes `gatewaySourceSelectionRows`, `recommendedGatewaySourceChains`, and the estimate types from Task 1.
- Produces `UnifiedGatewaySourceSelector` with explicit display data and callbacks; it owns no network state.
- Produces `/dev/unified-gateway-preview` only when `NODE_ENV !== "production"` and `PAYNA_UI_FIXTURE === "1"`.

- [ ] **Step 1: Write the failing real-component UI test**

Create `tests/ui/unified-gateway-selector.spec.ts` that visits the missing fixture route and asserts:

```ts
await page.addInitScript(() => window.localStorage.setItem("paycmd_locale", "en"));
await page.goto("/dev/unified-gateway-preview");
const selector = page.getByRole("region", { name: "Unified Gateway source allocation" });
await expect(selector.getByText("Recommended · Auto-selected")).toBeVisible();
await expect(selector.getByText("Unichain Sepolia")).toBeVisible();
await expect(selector.getByText("OP Sepolia")).toBeVisible();
await expect(selector.getByText("Other available sources (4)")).toBeVisible();
await expect(selector.getByText("Unused sources will not be charged or signed.")).toBeVisible();
```

- [ ] **Step 2: Run the fixture test and verify RED**

Run:

```bash
npx playwright test tests/ui/unified-gateway-selector.spec.ts --project=desktop-1440
```

Expected: FAIL because `/dev/unified-gateway-preview` does not exist.

- [ ] **Step 3: Add exact bilingual copy**

Add paired `preview.gatewaySources.*` keys for:

- recommended/custom badges;
- finding/refreshing states;
- recommended and other group titles;
- customize/restore actions;
- allocated and unused explanations;
- sources used and maximum possible debit;
- authorization required and minimum-one-source validation;
- accessible selector and auto-selected labels.

Keep placeholders identical between locales: `{count}`, `{amount}`, `{chain}`, and `{source}`.

- [ ] **Step 4: Implement the presentational component**

Create a client component with props shaped as:

```ts
export type UnifiedGatewaySourceSelectorProps = {
  amount: string | number;
  destinationChain: string;
  totalEstimatedFee?: string | number;
  maximumDebit?: string | number;
  mintGasMode: "auto_forwarding" | "manual";
  sources: GatewaySourceEstimate[];
  allocations: GatewayAllocationEstimate[];
  customSourceChains: string[] | null;
  quoteLoading: boolean;
  active: boolean;
  delegateLoading: boolean;
  delegateMessage: string;
  onCustomize: () => void;
  onToggleSource: (sourceChain: string) => void;
  onRestoreRecommended: () => void;
  onBackToScoped?: () => void;
  onAuthorizeSources: () => void;
};
```

Render allocated rows as stacked cards below `sm` and an aligned grid at `sm` and above. In automatic mode show only allocated cards plus the collapsed other-source count and `Customize sources`. In custom mode show all ordered rows with native checkboxes, keep the final selected checkbox disabled from removal, and show `Restore recommended`.

- [ ] **Step 5: Implement the deterministic fixture harness**

Use the real component with the exact 5-USDC example:

- Unichain allocation `4.945882`, reserve `0.054118`;
- OP allocation `0.054118`, reserve `0.001653`;
- Arc, Arbitrum, Avalanche, and Base usable but unallocated.

The harness owns `customSourceChains`, calls `recommendedGatewaySourceChains` on Customize, uses `toggleGatewayCustomSource` on checkbox changes, and exposes a short loading transition so the `Refreshing allocation…` state can be asserted.

- [ ] **Step 6: Add the guarded fixture route**

Mirror the existing UI fixture guard:

```ts
if (process.env.NODE_ENV === "production" || process.env.PAYNA_UI_FIXTURE !== "1") {
  notFound();
}
```

- [ ] **Step 7: Run the desktop UI test and verify GREEN**

Run `npx playwright test tests/ui/unified-gateway-selector.spec.ts --project=desktop-1440`.

Expected: recommended source order, summary, unused-source explanation, and Customize action all PASS.

- [ ] **Step 8: Write failing interaction, mobile, and accessibility assertions**

Add tests that:

- click `Customize sources` and see `Custom selection`;
- verify exactly Unichain and OP are initially checked;
- check Base and observe `Refreshing allocation…`;
- restore recommended mode;
- assert the selector has no horizontal overflow at 390 pixels;
- run axe and reject serious or critical violations;
- operate Customize and a source checkbox by keyboard.

- [ ] **Step 9: Adjust component semantics and responsive layout until GREEN**

Use a named `region`, semantic headings, `fieldset`/`legend` for custom choices, `aria-live="polite"` for quote changes, `aria-expanded`/`aria-controls` for the source disclosure, visible focus styles, and card widths constrained with `min-w-0`.

- [ ] **Step 10: Run targeted UI projects**

Run:

```bash
npx playwright test tests/ui/unified-gateway-selector.spec.ts --project=desktop-1440 --project=mobile-390
```

Expected: interaction, responsive, and accessibility tests PASS on both projects.

- [ ] **Step 11: Commit Task 2**

```bash
git add components/unified-gateway-source-selector.tsx components/unified-gateway-source-selector-preview.tsx app/dev/unified-gateway-preview/page.tsx tests/ui/unified-gateway-selector.spec.ts lib/i18n.tsx
git commit -m "feat: add recommended Unified source selector"
```

### Task 3: Integrate automatic and custom selection into transaction preview

**Files:**
- Modify: `components/paycmd-app.tsx`
- Test: `lib/paycmd/gateway-source-selection.test.ts`
- Test: `tests/ui/unified-gateway-selector.spec.ts`

**Interfaces:**
- Consumes `UnifiedGatewaySourceSelector` and Task 1 selection helpers.
- Preserves the existing estimate request contract and confirmed-draft fields.
- Removes the inline Unified source table from `TransactionPreview`.

- [ ] **Step 1: Write a failing transition test for the production integration rule**

Add a failing test for the exported `gatewaySelectedSourceRequest` helper so the observable request rule is testable without React:

```ts
assert.deepEqual(
  gatewaySelectedSourceRequest(null),
  {},
);
assert.deepEqual(
  gatewaySelectedSourceRequest(["unichainSepolia", "optimismSepolia"]),
  { selectedSourceChains: ["unichainSepolia", "optimismSepolia"] },
);
```

The regression caught is accidentally sending recommended allocations as a custom constraint and creating a requote loop.

- [ ] **Step 2: Run the transition test and verify RED**

Run `node --test lib/paycmd/gateway-source-selection.test.ts`.

Expected: FAIL because `gatewaySelectedSourceRequest` is not implemented.

- [ ] **Step 3: Implement the minimal request helper**

Return an empty object for automatic mode and an explicit array only for a non-empty custom list. Keep empty arrays impossible through the custom toggle helper.

- [ ] **Step 4: Integrate the selector into `paycmd-app.tsx`**

- Import the selector and helpers.
- Keep `selectedGatewaySources === null` as automatic mode.
- On Unified entry, set fallback mode to `unified` and selection to `null`.
- On Customize, seed from current `gatewayEstimate.allocations`.
- On toggle, call the non-empty toggle helper.
- On Restore, set selection to `null`.
- Use `gatewaySelectedSourceRequest` in the estimate body.
- Pass estimate metrics, sources, allocations, quote loading, delegate state, and callbacks to the extracted component.
- Delete the old inline horizontally scrolling table and old `toggleGatewaySource` implementation.

- [ ] **Step 5: Verify confirmation and execution fields remain authoritative**

Keep the existing confirm-disabled conditions for quote loading, error, missing fingerprint, no allocations, and delegate requirements. Keep `selectedSourceChains` empty in the confirmed draft for automatic mode and comma-separated only in custom mode.

- [ ] **Step 6: Run unit, lint, and TypeScript/build checks**

Run:

```bash
node --test lib/paycmd/gateway-source-selection.test.ts
npm test
npm run lint
npm run build
```

Expected: all tests and build PASS; lint has zero errors. Existing unrelated warnings may remain.

- [ ] **Step 7: Run the responsive selector suite and existing command-center regression**

Run:

```bash
npx playwright test tests/ui/unified-gateway-selector.spec.ts tests/ui/command-center.spec.ts --project=desktop-1440 --project=mobile-390
```

Expected: the selector and existing command center PASS without changing the existing command-center visual baseline.

- [ ] **Step 8: Commit Task 3**

```bash
git add components/paycmd-app.tsx lib/paycmd/gateway-source-selection.ts lib/paycmd/gateway-source-selection.test.ts
git commit -m "feat: integrate recommended Unified source UX"
```

### Task 4: Completion audit and visual verification

**Files:**
- No production changes expected.
- Modify earlier files only if verification exposes a requirement gap.

**Interfaces:**
- Consumes the design acceptance criteria and all prior task outputs.
- Produces evidence for automatic ordering, custom selection, responsive layout, accessibility, and regression safety.

- [ ] **Step 1: Audit every design acceptance criterion against authoritative evidence**

Create a local checklist mapping criteria 1–10 to:

- pure unit-test name;
- Playwright assertion or viewport;
- production integration line/function;
- verification command result.

Do not mark the goal complete when a criterion has only indirect evidence.

- [ ] **Step 2: Run fresh full verification**

Run:

```bash
git diff --check
npm test
npm run lint
npm run build
npx playwright test tests/ui/unified-gateway-selector.spec.ts tests/ui/command-center.spec.ts --project=desktop-1440 --project=mobile-390
```

Expected: diff check, unit tests, build, and targeted UI tests PASS; lint reports zero errors.

- [ ] **Step 3: Inspect the real fixture at desktop and mobile sizes**

Use the running Playwright server or in-app browser to inspect `/dev/unified-gateway-preview` at 1440 and 390 pixels. Confirm:

- recommended sources are visibly first;
- allocation numbers and maximum debit are readable;
- unused sources are visually secondary;
- custom controls do not shift or overflow;
- light and dark themes preserve contrast and focus.

- [ ] **Step 4: Report the exact result**

Report changed files, automatic/custom behavior, source ordering, mobile behavior, tests/build output, any pre-existing warnings, and confirm that no Circle or onchain mutation occurred during implementation.
