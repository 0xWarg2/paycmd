# Public Docs Depth and Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand all 25 public Docs routes in Vietnamese and English, reduce article typography to a comfortable reading scale, and give long pages a visible, draggable scrollbar that reaches the complete document.

**Architecture:** Keep the paired Markdown catalog as the long-form source of truth and keep `payna-tutorial.json` generated from concise `aiSummary` metadata. Make Docs a viewport-owned flex layout with independent navigation scrollers and one primary article scroller; isolate scrollbar styling in a new CSS Module so concurrent global/chat-scroll work remains untouched.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, CSS Modules, `react-markdown`, Node test runner, Playwright, Axe.

## Global Constraints

- Keep exactly the existing 25 locale-neutral Docs slugs and preserve legacy `/docs#...` redirects.
- Every slug must have paired Vietnamese and English Markdown with matching heading-level structure.
- General guides target 500–800 words per locale; tests allow 500–1,000 words to avoid penalizing useful examples.
- Circle Gateway guides target 900–1,500 words per locale; tests allow 900–1,700 words.
- Exact compact exceptions: Docs root 350–700 words and Gateway support matrix 450–1,000 words per locale.
- Article body is 15px with 1.7–1.8 line height; H1 is 28–36px, H2 is 22–26px, and H3 is 18–20px.
- Do not change the application font family.
- Do not modify `app/globals.css`; it contains concurrent chat-scroll changes. Use `components/public-docs/public-docs-portal.module.css` for Docs scrollbars.
- Do not modify backend APIs, authentication, transaction execution, Circle integration, Arc swap behavior, or proof behavior.
- Do not expose API keys, environment variables, webhook secrets, private configuration, or internal deployment runbooks.
- Keep `content/payna-tutorial.json` concise and generated only from public-docs `aiSummary` metadata.
- Commit only files listed by the active task; preserve all unrelated working-tree changes.

---

### Task 1: Add Content Depth Contracts

**Files:**
- Modify: `lib/paycmd/public-docs.test.ts`

**Interfaces:**
- Consumes: `loadPublicDocsCatalog(): Promise<PublicDocsPage[]>` from `lib/public-docs/catalog.ts`.
- Produces: word-count, structural parity, draft-marker, and content-template tests that all later content tasks must satisfy.

- [ ] **Step 1: Add a word-count helper and failing length contract**

Add the helper and test below near the existing public-docs tests:

```ts
function publicDocsWordCount(value: string) {
  return value.match(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu)?.length ?? 0;
}

function selectedPublicDocsPages<T extends { slug: string }>(pages: T[]) {
  const selectors = new Set((process.env.PUBLIC_DOCS_SLUGS ?? "").split(",").filter(Boolean));
  if (selectors.size === 0) return pages;
  return pages.filter((page) => selectors.has(page.slug || "overview"));
}

test("public docs provide substantial bilingual reading depth", async () => {
  const { loadPublicDocsCatalog } = await import("../public-docs/catalog.ts");
  const pages = await loadPublicDocsCatalog();

  for (const page of selectedPublicDocsPages(pages)) {
    for (const locale of ["vi", "en"] as const) {
      const count = publicDocsWordCount(page.locales[locale].searchText);
      const [minimum, maximum] = page.slug === ""
        ? [350, 700]
        : page.slug === "circle/gateway/support-matrix"
          ? [450, 1000]
          : page.slug.startsWith("circle/gateway/")
            ? [900, 1700]
            : [500, 1000];
      assert.ok(count >= minimum, `${locale}:${page.slug || "overview"} has only ${count} words`);
      assert.ok(count <= maximum, `${locale}:${page.slug || "overview"} has ${count} words and needs editing`);
    }
  }
});
```

- [ ] **Step 2: Add failing structural and draft-copy contracts**

```ts
test("paired locales keep equivalent document structure and finished copy", async () => {
  const { loadPublicDocsCatalog } = await import("../public-docs/catalog.ts");
  const pages = await loadPublicDocsCatalog();

  const draftMarkers = new RegExp("\\b(?:T[B]D|T[O]DO|FIXM[E])\\b|lorem ipsum|coming soon", "i");
  for (const page of selectedPublicDocsPages(pages)) {
    assert.deepEqual(
      page.locales.vi.headings.map((heading) => heading.level),
      page.locales.en.headings.map((heading) => heading.level),
      `${page.slug || "overview"} must keep the same VI/EN heading hierarchy`,
    );
    for (const locale of ["vi", "en"] as const) {
      const localized = page.locales[locale];
      assert.ok(localized.headings.length >= 5, `${locale}:${page.slug || "overview"} needs at least five sections`);
      assert.doesNotMatch(localized.content, draftMarkers);
    }
  }
});
```

- [ ] **Step 3: Run the focused test and verify the intended failure**

Run:

```bash
node --test --test-name-pattern="substantial bilingual|equivalent document" lib/paycmd/public-docs.test.ts
```

Expected: FAIL with current pages below their minimum word counts and some pages below five headings. No loader/import failure is acceptable.

- [ ] **Step 4: Commit the test contract**

```bash
git add lib/paycmd/public-docs.test.ts
git commit -m "test(docs): require substantial paired content"
```

---

### Task 2: Implement Compact Typography and Owned Scrolling

**Files:**
- Create: `components/public-docs/public-docs-portal.module.css`
- Modify: `components/public-docs/public-docs-portal.tsx`
- Modify: `tests/ui/docs-portal.spec.ts`

**Interfaces:**
- Produces: `data-testid="docs-scroll-container"` as the single main document scroller.
- Produces: CSS Module classes `scrollbar` and `mainScrollbar` for visible semantic scrollbars.
- Preserves: `PublicDocsPortalProps`, routes, locale state, search index, navigation data, and Markdown rendering API.

- [ ] **Step 1: Add a failing Playwright scroll and typography test**

Append this acceptance test:

```ts
test("uses compact typography and scrolls a long guide to its final navigation", async ({ page }) => {
  await page.goto("/docs/circle/gateway/unified-balance");

  const scroller = page.getByTestId("docs-scroll-container");
  const metrics = await scroller.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(["auto", "scroll"]).toContain(metrics.overflowY);

  const bodySize = await page.locator("article p").first().evaluate((element) => getComputedStyle(element).fontSize);
  const titleSize = await page.getByRole("heading", { level: 1 }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(bodySize).toBe("15px");
  expect(titleSize).toBeGreaterThanOrEqual(28);
  expect(titleSize).toBeLessThanOrEqual(36);

  await scroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(page.getByRole("navigation", { name: "Pagination" })).toBeInViewport();
});

test("reflows Docs at a 200 percent equivalent viewport", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/docs/circle/gateway/unified-balance");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByTestId("docs-scroll-container")).toBeVisible();
});
```

- [ ] **Step 2: Run the focused browser test and verify it fails**

Run:

```bash
npx playwright test tests/ui/docs-portal.spec.ts --project=desktop-1440 --grep="compact typography"
```

Expected: FAIL because `docs-scroll-container` does not exist and the portal does not own vertical scrolling.

- [ ] **Step 3: Create the isolated scrollbar CSS Module**

Create `components/public-docs/public-docs-portal.module.css`:

```css
.scrollbar {
  scrollbar-width: thin;
  scrollbar-color:
    color-mix(in oklch, var(--primary) 48%, var(--border))
    color-mix(in oklch, var(--muted) 76%, transparent);
}

.scrollbar::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.scrollbar::-webkit-scrollbar-track {
  background: color-mix(in oklch, var(--muted) 76%, transparent);
}

.scrollbar::-webkit-scrollbar-thumb {
  min-height: 48px;
  border: 2px solid transparent;
  border-radius: 999px;
  background: color-mix(in oklch, var(--primary) 48%, var(--border));
  background-clip: padding-box;
}

.scrollbar::-webkit-scrollbar-thumb:hover {
  background: color-mix(in oklch, var(--primary) 68%, var(--border));
  background-clip: padding-box;
}

.mainScrollbar {
  scrollbar-gutter: stable;
}
```

- [ ] **Step 4: Convert the Docs portal to viewport-owned flex scrolling**

In `public-docs-portal.tsx`, import the CSS Module and change only the Docs shell classes:

```tsx
import styles from "./public-docs-portal.module.css";

<div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
  <header className="relative z-40 shrink-0 border-b border-border/80 bg-background/90 backdrop-blur-xl">
    {/* existing header body */}
  </header>

  <div className="mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_220px]">
    <aside className={cn(styles.scrollbar, "hidden min-h-0 overflow-y-auto border-r border-border/70 px-5 py-8 lg:block")}>
      {/* existing left navigation */}
    </aside>
    <main
      data-testid="docs-scroll-container"
      className={cn(styles.scrollbar, styles.mainScrollbar, "min-h-0 min-w-0 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10 xl:px-12")}
    >
      {/* existing document */}
    </main>
    <aside className={cn(styles.scrollbar, "hidden min-h-0 overflow-y-auto border-l border-border/70 px-5 py-8 xl:block")}>
      {/* existing on-page navigation */}
    </aside>
  </div>
</div>
```

Remove the old `sticky top-16`, fixed-height sidebar calculations, and document-level `min-h-screen`. Do not change `app/globals.css`.

- [ ] **Step 5: Apply the compact typography scale**

Update the Markdown components and page header classes:

```tsx
h2: ({ children }) => (
  <h2
    id={publicDocsHeadingId(reactNodeText(children))}
    className="scroll-mt-6 pt-8 text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]"
  >
    {children}
  </h2>
),
h3: ({ children }) => (
  <h3
    id={publicDocsHeadingId(reactNodeText(children))}
    className="scroll-mt-6 pt-5 text-lg font-semibold text-foreground sm:text-xl"
  >
    {children}
  </h3>
),
p: ({ children }) => <p className="text-[15px] leading-[1.75] text-muted-foreground">{children}</p>,
ul: ({ children }) => <ul className="my-4 list-disc space-y-2 pl-6 text-[15px] leading-[1.75] text-muted-foreground">{children}</ul>,
ol: ({ children }) => <ol className="my-4 list-decimal space-y-2 pl-6 text-[15px] leading-[1.75] text-muted-foreground">{children}</ol>,
```

Keep the existing heading ID calculation in each renderer. Change the page title to `text-[28px] sm:text-[32px] lg:text-4xl` and the description to `text-[15px] leading-7`.

- [ ] **Step 6: Update existing screenshot reset logic for the internal scroller**

Replace `window.scrollTo(0, 0)` with:

```ts
await page.getByTestId("docs-scroll-container").evaluate((element) => element.scrollTo(0, 0));
```

Run:

```bash
npx playwright test tests/ui/docs-portal.spec.ts --project=desktop-1440 --grep="compact typography|on-page table"
```

Expected: PASS.

- [ ] **Step 7: Commit the isolated UI change**

```bash
git add components/public-docs/public-docs-portal.tsx components/public-docs/public-docs-portal.module.css tests/ui/docs-portal.spec.ts
git commit -m "fix(docs): add visible scrolling and compact type"
```

---

### Task 3: Expand Overview and Getting Started

**Files:**
- Modify: `content/public-docs/{vi,en}/index.md`
- Modify: `content/public-docs/{vi,en}/getting-started/quickstart.md`
- Modify: `content/public-docs/{vi,en}/getting-started/account-and-wallets.md`

**Interfaces:**
- Consumes: Task 1 content thresholds and paired heading-level contract.
- Produces: three complete bilingual entry guides with unchanged slugs, metadata keys, and concise `aiSummary` arrays.

- [ ] **Step 1: Expand the Docs overview in both locales**

Keep the VI and EN heading levels equivalent and use this exact section map:

```md
## Payna is a stablecoin command center
## Choose the correct payment rail
### Circle wallet and Gateway
### MetaMask and CCTP
### Arc swap and proof
## A command always starts with intent
## Preview first, confirm second
## Testnet boundaries
## Recommended learning path
```

Write 350–700 words per locale. Explain the product map, what each rail owns, preview/confirmation, public versus authenticated surfaces, and the recommended sequence through Getting Started, Gateway, commands, and troubleshooting.

- [ ] **Step 2: Expand Quickstart in both locales**

Use equivalent headings for: preparation, MetaMask login, `/link metamask`, `/wallet create`, faucet/gas, `/fund`, `/balance`, first preview/confirmation, verification in history, and first-session troubleshooting. Include at least three complete command examples and a final checklist. Write 500–1,000 words per locale.

- [ ] **Step 3: Expand Account and Wallet Roles in both locales**

Use equivalent headings for: account identity, MetaMask role, Circle SCA role, Gateway signer/depositor role, addresses a user sees, recovery/re-link behavior, private-key boundaries, and a role-comparison table. Explicitly state that one user may see multiple addresses because the rails have different ownership and signing responsibilities. Write 500–1,000 words per locale.

- [ ] **Step 4: Run the focused contracts**

```bash
PUBLIC_DOCS_SLUGS=overview,getting-started/quickstart,getting-started/account-and-wallets node --test --test-name-pattern="substantial bilingual|equivalent document" lib/paycmd/public-docs.test.ts
```

Expected: PASS for the three entry slugs.

- [ ] **Step 5: Commit the entry guides**

```bash
git add content/public-docs/vi/index.md content/public-docs/en/index.md content/public-docs/vi/getting-started content/public-docs/en/getting-started
git commit -m "docs: expand Payna getting started guides"
```

---

### Task 4: Expand Circle Gateway Unified Balance Documentation

**Files:**
- Modify: `content/public-docs/{vi,en}/circle/gateway/overview.md`
- Modify: `content/public-docs/{vi,en}/circle/gateway/unified-balance.md`
- Modify: `content/public-docs/{vi,en}/circle/gateway/deposit-and-finality.md`
- Modify: `content/public-docs/{vi,en}/circle/gateway/transfer.md`
- Modify: `content/public-docs/{vi,en}/circle/gateway/withdraw.md`
- Modify: `content/public-docs/{vi,en}/circle/gateway/fees-gas-and-forwarding.md`
- Modify: `content/public-docs/{vi,en}/circle/gateway/support-matrix.md`

**Interfaces:**
- Consumes: actual Payna behavior in `lib/circle/gateway-sdk.ts`, Gateway API routes, command registry, and Circle official documentation.
- Produces: the primary 14-file bilingual Gateway chapter and preserves concise tutorial summaries.

- [ ] **Step 1: Verify current implementation facts before writing**

Read the current source for deposit, balance, transfer, estimate, withdraw, webhook, and sync behavior. Record facts only from current code and Circle primary documentation. In particular, verify the quote fee field and forwarding/mint result shape against the current branch because Gateway code is changing concurrently.

Run these read-only searches:

```bash
rg -n "pending|final|webhook|sync|forward|fee|maxFee|withdraw|domain|depositor|signer" app/api/gateway lib/circle lib/paycmd
rg -n "GATEWAY_CHAIN_CONFIGS|supportedGatewayChains" lib/circle/gateway-sdk.ts
```

- [ ] **Step 2: Expand Gateway Overview and Unified Balance**

Each locale must use equivalent heading levels and cover:

```md
## The three wallet roles
## The complete Payna Gateway flow
## What unified balance means
## What Payna total balance means
## Why transfer remains source-scoped
## Example with balances on two domains
## State and safety checklist
## Related official references
```

Write 900–1,700 words per locale for each page. Use a numeric example that separately totals SCA visibility and Gateway ready balance without treating SCA USDC as deposited Gateway liquidity.

- [ ] **Step 3: Expand Deposit and Finality**

Cover `/fund` versus `/deposit`, allowance/authorization, submitted transaction, pending confirmations, webhook finality, ready balance, recovery sync, idempotent refresh, failure before submission versus after funds moved, and a diagnostic checklist. Include explicit warnings against direct ERC-20 transfer to a Gateway contract. Write 900–1,700 words per locale.

- [ ] **Step 4: Expand Transfer**

Cover command syntax, source selection, `amount + fee`, estimate before signer/balance mutation, burn intent, destination mint, forwarding result, preview fields, confirmation, receipt/history fields, external recipient checks, insufficient balance, quote failure, gas failure, and retry safety. Clearly label source-scoped selection as current Payna implementation behavior. Write 900–1,700 words per locale.

- [ ] **Step 5: Expand Withdraw and Fees/Gas/Forwarding**

For withdraw, explain same-domain return to SCA, prerequisites, amount validation, preview, confirmation, expected receipt, and errors. For fees/gas/forwarding, distinguish Gateway protocol fee, source gas, destination gas, automatic forwarding, manual mint, quote freshness, and why a preview must not promise a fixed fee before estimation. Write 900–1,700 words per locale for each page.

- [ ] **Step 6: Expand Support Matrix**

Write 450–1,000 words per locale around the generated matrix. Explain `domain`, Gateway listing, Wallet SDK operability, configuration-driven rendering, how to interpret unsupported operations, testnet scope, and why the table does not expose RPC URLs, keys, or private configuration. Keep the matrix component generated from `GATEWAY_CHAIN_CONFIGS`.

- [ ] **Step 7: Run Gateway contracts**

```bash
PUBLIC_DOCS_SLUGS=circle/gateway/overview,circle/gateway/unified-balance,circle/gateway/deposit-and-finality,circle/gateway/transfer,circle/gateway/withdraw,circle/gateway/fees-gas-and-forwarding,circle/gateway/support-matrix node --test --test-name-pattern="substantial bilingual|equivalent document|Gateway guides|support matrix" lib/paycmd/public-docs.test.ts
```

Expected: all Gateway pages pass length, structure, and invariant checks.

- [ ] **Step 8: Commit the Gateway chapter**

```bash
git add content/public-docs/vi/circle/gateway content/public-docs/en/circle/gateway
git commit -m "docs: deepen Circle Gateway unified balance guides"
```

---

### Task 5: Expand CCTP and Product Feature Guides

**Files:**
- Modify: `content/public-docs/{vi,en}/circle/cctp-bridge.md`
- Modify: `content/public-docs/{vi,en}/features/askpayna.md`
- Modify: `content/public-docs/{vi,en}/features/payments-and-contacts.md`
- Modify: `content/public-docs/{vi,en}/features/payment-requests-and-payroll.md`
- Modify: `content/public-docs/{vi,en}/features/budgets-and-schedules.md`
- Modify: `content/public-docs/{vi,en}/features/activity-and-notifications.md`

**Interfaces:**
- Consumes: CCTP/AskPayna/product behavior from current routes, parsers, and AI retrieval modules.
- Produces: six complete feature guides per locale with paired structures and no backend changes.

- [ ] **Step 1: Expand CCTP Bridge**

Use sections for when CCTP is appropriate, prerequisites, source burn/message, attestation, destination mint, MetaMask network/signature flow, preview fields, gas, transaction history, failure/recovery, CCTP versus Gateway, and safety. Link Circle's official CCTP technical guide. Write 500–1,000 words per locale.

- [ ] **Step 2: Expand AskPayna**

Use sections for mode selection, intent routing, Payna tutorial, Circle MCP, Arc MCP/`arc.io`, Tavily live Web3 search, DeepSeek evidence synthesis, citation rules, `partial`/`unavailable`, secret blocking, good question examples, and source-failure troubleshooting. Write 500–1,000 words per locale without inserting any API key or internal prompt.

- [ ] **Step 3: Expand Payments/Contacts and Requests/Payroll**

Payments/contacts must cover address versus saved contact, required source/destination chain, preview/confirm, history, common identity errors, and safety. Requests/payroll must distinguish inbound request lifecycle from outbound batch payments, CSV/recipient validation, aggregate previews, confirmation exposure, partial failure boundaries, and history. Write 500–1,000 words per locale per page.

- [ ] **Step 4: Expand Budgets/Schedules and Activity/Notifications**

Budgets/schedules must explain demo scope, time windows, schedule confirmation, run state, and transaction separation. Activity/notifications must explain tabs, receipts, source/mint/proof links, pending/finalized state, deep links, read state, and how finality notifications relate to Gateway webhooks. Write 500–1,000 words per locale per page.

- [ ] **Step 5: Run content contracts and AI routing tests**

```bash
PUBLIC_DOCS_SLUGS=circle/cctp-bridge,features/askpayna,features/payments-and-contacts,features/payment-requests-and-payroll,features/budgets-and-schedules,features/activity-and-notifications node --test --test-name-pattern="substantial bilingual|equivalent document|routes bilingual|grounds the DeepSeek|partial and unavailable" lib/paycmd/*.test.ts lib/paycmd/ai/*.test.ts
```

Expected: the six feature slugs and existing AskPayna routing tests pass.

- [ ] **Step 6: Commit CCTP and features**

```bash
git add content/public-docs/vi/circle/cctp-bridge.md content/public-docs/en/circle/cctp-bridge.md content/public-docs/vi/features content/public-docs/en/features
git commit -m "docs: expand CCTP and Payna feature guides"
```

---

### Task 6: Expand Arc and the 16-Command Reference

**Files:**
- Modify: `content/public-docs/{vi,en}/arc/overview-and-swap.md`
- Modify: `content/public-docs/{vi,en}/arc/onchain-proof.md`
- Modify: `content/public-docs/{vi,en}/commands/wallet-and-balance.md`
- Modify: `content/public-docs/{vi,en}/commands/gateway.md`
- Modify: `content/public-docs/{vi,en}/commands/payments.md`
- Modify: `content/public-docs/{vi,en}/commands/metamask-and-data.md`

**Interfaces:**
- Consumes: 16-command registry and current Arc swap/proof implementation.
- Produces: complete bilingual Arc chapter and command reference while preserving every `commands` frontmatter entry.

- [ ] **Step 1: Expand Arc Swap and Proof**

Arc swap sections: testnet scope, supported USDC/EURC/cirBTC decimals, direct versus USDC-routed pairs, quote/preflight, slippage/minimum output, gas, MetaMask signing, receipt/history, failure/retry, and Gateway distinction. Proof sections: purpose, receipt payload, what is and is not proven, relayer boundary, explorer verification, source/mint/proof relationship, failure behavior, privacy, and troubleshooting. Write 500–1,000 words per locale per page.

- [ ] **Step 2: Expand Wallet and Balance Commands**

For `/wallet`, `/link`, `/fund`, and `/balance`, include purpose, exact syntax, one natural-language example, prerequisites, preview fields, confirmation boundary, success output, persisted state, and at least two named errors with fixes. Preserve the differences among MetaMask, SCA, Gateway, scoped balance, and all-chain balance. Write 500–1,000 words per locale for the page.

- [ ] **Step 3: Expand Gateway Commands**

For `/deposit`, `/withdraw`, `/transfer`, `/gas`, and `/gateway`, include the same eight command fields. Cross-link to the deeper Gateway conceptual pages instead of duplicating every protocol paragraph. Write 500–1,000 words per locale for the page.

- [ ] **Step 4: Expand Payment and MetaMask/Data Commands**

For `/contacts`, `/pay`, `/request`, `/payroll`, `/bridge`, `/swap`, and `/history`, include all eight command fields, exact examples, source/destination requirements, signature owner, result links, and error recovery. Write 500–1,000 words per locale for each page.

- [ ] **Step 5: Run command and content contracts**

```bash
PUBLIC_DOCS_SLUGS=arc/overview-and-swap,arc/onchain-proof,commands/wallet-and-balance,commands/gateway,commands/payments,commands/metamask-and-data node --test --test-name-pattern="substantial bilingual|equivalent document|command reference" lib/paycmd/public-docs.test.ts
```

Expected: all Arc/command pages pass and all 16 registry names remain covered.

- [ ] **Step 6: Commit Arc and command reference**

```bash
git add content/public-docs/vi/arc content/public-docs/en/arc content/public-docs/vi/commands content/public-docs/en/commands
git commit -m "docs: expand Arc and command reference"
```

---

### Task 7: Expand Safety, Troubleshooting, and FAQ

**Files:**
- Modify: `content/public-docs/{vi,en}/safety-and-support/security.md`
- Modify: `content/public-docs/{vi,en}/safety-and-support/troubleshooting.md`
- Modify: `content/public-docs/{vi,en}/safety-and-support/faq.md`

**Interfaces:**
- Consumes: safety boundaries and error states established by Tasks 3–6.
- Produces: final three bilingual guides that route users from symptoms to safe recovery actions.

- [ ] **Step 1: Expand Security**

Cover testnet scope, seed/private-key prohibition, wallet signature verification, preview/confirmation, address and chain checks, allowance risk, secret-bearing research queries, proof limitations, external links, retry safety, and incident checklist. Write 500–1,000 words per locale.

- [ ] **Step 2: Expand Troubleshooting**

Organize by symptom: MetaMask unavailable/wrong chain, login/link mismatch, missing SCA balance, `/fund` versus Gateway confusion, pending deposit, quote/fee error, insufficient source amount plus fee, destination gas, payment chain ambiguity, CCTP delay, swap slippage, missing history/proof, AskPayna partial/unavailable, and recovery escalation. Each symptom must include diagnosis, safe action, and what not to repeat. Write 500–1,000 words per locale.

- [ ] **Step 3: Expand FAQ**

Provide concise but complete answers covering product scope, public docs, wallet roles, unified versus total balance, pending finality, source-scoped transfer, forwarding/manual mint, withdraw domain, CCTP versus Gateway, Arc tokens, onchain proof, AskPayna sources, citations, versioning, testnet money, and support expectations. Group questions under at least five headings. Write 500–1,000 words per locale.

- [ ] **Step 4: Run the complete content contract**

```bash
PUBLIC_DOCS_SLUGS=safety-and-support/security,safety-and-support/troubleshooting,safety-and-support/faq node --test --test-name-pattern="substantial bilingual|equivalent document" lib/paycmd/public-docs.test.ts
node --test lib/paycmd/public-docs.test.ts
```

Expected: every public-docs test passes with no remaining word-count, structure, command, Gateway, or support-matrix failure.

- [ ] **Step 5: Commit safety and support**

```bash
git add content/public-docs/vi/safety-and-support content/public-docs/en/safety-and-support
git commit -m "docs: deepen safety and troubleshooting guidance"
```

---

### Task 8: Synchronize Tutorial and Run Full Verification

**Files:**
- Regenerate: `content/payna-tutorial.json`
- Update if baselines intentionally changed: `tests/ui/docs-portal.spec.ts-snapshots/*.png`
- Update if Docs root visual intentionally changed: `tests/ui/theme.spec.ts-snapshots/docs-*.png`

**Interfaces:**
- Consumes: all content and UI work from Tasks 1–7.
- Produces: synchronized v1.0.0 tutorial, reviewed visual baselines, and final verification evidence.

- [ ] **Step 1: Regenerate and validate the concise tutorial**

```bash
npm run docs:sync
npm run docs:validate
git diff -- content/payna-tutorial.json
```

Expected: tutorial remains `v1.0.0`, URLs remain canonical, and only intentional metadata/`aiSummary` changes appear. Full Markdown article bodies must not appear in the JSON.

- [ ] **Step 2: Run unit tests and lint**

```bash
npm test
npm run lint
```

Expected: all tests pass; lint has zero errors. Existing unrelated warnings may remain documented but no new Docs warning is acceptable.

- [ ] **Step 3: Run a clean production build**

Move stale generated Next directories out of the repository if route types still reference the deleted legacy Docs page, then run:

```bash
PAYNA_UI_FIXTURE=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test npm run build
```

Expected: build succeeds and `/docs/[[...slug]]` lists `/docs` plus 24 more static paths.

- [ ] **Step 4: Update and inspect Docs visual baselines**

Run on a dedicated Playwright server:

```bash
npx playwright test tests/ui/docs-portal.spec.ts --project=desktop-1440 --project=desktop-1440-light --project=mobile-390 --project=mobile-390-light --update-snapshots
```

Inspect all four Gateway screenshots. Confirm compact typography, visible scrollbar on long pages, no clipped pagination, usable mobile header/search, and no horizontal overflow.

- [ ] **Step 5: Re-run Docs acceptance without updating snapshots**

```bash
npx playwright test tests/ui/docs-portal.spec.ts --project=desktop-1440 --project=desktop-1440-light --project=mobile-390 --project=mobile-390-light
```

Expected: all applicable navigation, locale, scroll, anchor, mobile, Axe, and visual tests pass.

- [ ] **Step 6: Run theme and command-center regression suites**

```bash
npx playwright test tests/ui/theme.spec.ts --project=desktop-1440 --project=desktop-1440-light --project=mobile-390 --project=mobile-390-light
npx playwright test tests/ui/command-center.spec.ts
```

Expected: theme/Axe/overflow baselines pass and existing command-center snapshots remain unchanged by the Docs CSS Module.

- [ ] **Step 7: Review scope and commit generated artifacts**

```bash
git diff --check
git status --short
git diff --stat
git add content/payna-tutorial.json tests/ui/docs-portal.spec.ts-snapshots tests/ui/theme.spec.ts-snapshots
git commit -m "test(docs): refresh deep portal baselines"
```

Stage only generated tutorial and intentional Docs snapshot changes. Do not stage concurrent Gateway/chat-scroll files.

- [ ] **Step 8: Prepare integration handoff**

Report the exact unit, lint, build, Docs Playwright, theme, and command-center results. Keep the feature branch and working tree intact until the user chooses local merge, PR, or later handling.
