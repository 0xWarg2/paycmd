# Public Docs Depth and Scroll Design

**Date:** 2026-08-05

**Status:** Approved design, pending implementation plan

**Scope:** Public documentation portal at `/docs`; no backend, authentication, transaction, or Circle integration behavior changes.

## Objective

Expand all 25 existing public documentation routes into substantive bilingual product documentation and make long pages visibly, reliably scrollable on desktop and mobile.

The portal will keep the existing route information architecture and paired Vietnamese/English content. General guides will target 500–800 words per locale. Circle Gateway guides will target 900–1,500 words per locale because Gateway unified balance is the primary documentation subject for Payna.

## Current Problems

### Content depth

Most current Markdown pages are concise summaries of roughly 100–225 words. They identify features correctly but do not consistently explain prerequisites, lifecycle states, confirmation behavior, failure modes, recovery, or realistic examples. Command pages list syntax but are not yet complete operational references.

### Missing visible scroll affordance

The global application shell keeps `body` at `overflow-hidden` because the command center owns its own viewport scrolling. The Docs portal currently uses a `min-h-screen` document layout without defining a primary vertical scroll owner. Long Docs pages can therefore exceed the viewport without exposing a visible, usable scrollbar.

Changing global `body` overflow would risk regressions in the command center. Docs must own its scroll behavior locally.

## Content Architecture

### Route stability

- Keep all 25 existing slugs.
- Keep locale-neutral URLs so switching VI/EN remains on the current slug.
- Preserve all legacy `/docs#...` redirects.
- Do not introduce additional routes solely to meet word-count targets.

### Length targets

- General pages: 500–800 words per locale.
- Circle Gateway pages: 900–1,500 words per locale.
- The overview and support matrix may use a lower threshold where diagrams, tables, or navigation carry meaningful information.
- Word count is a quality guard, not permission to repeat content. Every section must add operational or conceptual value.

### Page templates

Each page type follows a consistent template while allowing topic-specific sections.

#### Concept and overview pages

1. What the topic is.
2. When a Payna user encounters it.
3. Mental model and terminology.
4. System or money flow.
5. Boundaries and what the feature does not do.
6. Example scenarios.
7. Safety notes and related guides.

#### Procedural guides

1. Goal and when to use the flow.
2. Prerequisites and wallet/network roles.
3. Numbered end-to-end procedure.
4. Preview and explicit confirmation fields.
5. Expected success result and recorded history.
6. Pending/finality behavior where applicable.
7. Common errors, diagnosis, and recovery.
8. Safety checklist and next steps.

#### Command references

Every documented command includes:

1. Purpose.
2. Syntax and accepted variants.
3. Natural-language and slash-command examples.
4. Required account, wallet, balance, network, and gas state.
5. Preview fields.
6. User confirmation boundary.
7. Success result and persisted data.
8. Common errors and corrective action.

### Circle Gateway depth

Gateway remains immediately after Getting Started in navigation and receives the most detailed treatment. Its guides must distinguish:

- Circle SCA wallet, Gateway depositor, and Gateway signer roles.
- SCA balance, Gateway pending deposit, Gateway ready balance, and Payna total visibility.
- `/fund` from MetaMask to SCA versus `/deposit` from SCA into Gateway.
- Onchain submission, required confirmations, pending state, finality, and ready state.
- Webhook-driven finality as the primary signal and sync as recovery.
- Source-scoped transfer selection and the requirement to cover `amount + fee`.
- Destination mint, automatic forwarding, and manual destination gas.
- Same-domain withdraw from Gateway back to the SCA.
- The 12 configured Gateway domains and the difference between Gateway listing and current Wallet SDK operability.

Claims about Circle protocol behavior link to Circle's official documentation near the relevant explanation. Payna-specific behavior remains clearly labeled as implementation behavior rather than a universal Gateway property.

### Arc and AskPayna depth

Arc pages explain Arc Testnet scope, token decimals, route selection, slippage, gas, MetaMask signing, transaction history, and onchain proof boundaries. Arc protocol knowledge points to Arc MCP and `arc.io`.

AskPayna explains source routing and degradation behavior:

- Versioned Payna tutorial for product guidance.
- Circle MCP for Circle knowledge.
- Arc MCP and `arc.io` for Arc knowledge.
- Tavily for broad Web3 or time-sensitive information.
- DeepSeek for evidence-grounded synthesis only.
- `partial` or `unavailable` when retrieval sources fail.
- No model-invented citations or exposure of secrets.

### Tutorial synchronization

Long-form Markdown remains the public source of truth. `content/payna-tutorial.json` continues to be generated only from concise `aiSummary` metadata so AskPayna context remains bounded.

The generated tutorial must keep:

- Version equality with `package.json`.
- Canonical multi-page URLs.
- Paired VI/EN sections.
- Concise, retrieval-oriented summaries rather than full article bodies.

## Scroll and Layout Architecture

### Reading typography

The current Docs hierarchy feels oversized for long-form technical reading. The portal will use a more compact, consistent scale without changing the application font family:

- Article body: approximately 15px with a relaxed 1.7–1.8 line height on desktop and mobile.
- Page title: approximately 28–36px across mobile and desktop, instead of scaling to an oversized display heading.
- Level-two heading: approximately 22–26px.
- Level-three heading: approximately 18–20px.
- Navigation, metadata, breadcrumbs, table copy, and callouts remain subordinate to the article body.
- Keep the readable article measure near the existing `max-w-3xl`; do not widen paragraphs simply because they use a smaller font.

The intent is a comfortable documentation density: visibly smaller than landing-page marketing typography, but not compressed into dashboard-sized copy. Command code, tables, and warnings must remain legible at normal browser zoom.

### Scroll ownership

The Docs portal root becomes a viewport-owned flex layout:

```text
Docs root: h-dvh, flex column, overflow hidden
├── Header: shrink-0, natural height
└── Docs workspace: min-h-0, flex-1, responsive grid
    ├── Left navigation: independent vertical scroll
    ├── Main document: primary vertical scroll
    └── On-page navigation: independent vertical scroll
```

Using flex sizing instead of a fixed `calc(100vh - header)` accommodates the second mobile search row without guessing header height.

### Scrollbar presentation

Add a Docs-specific scrollbar utility rather than changing every application surface:

- `scrollbar-width: thin` for Firefox.
- A visible WebKit scrollbar track and thumb.
- Semantic light/dark colors derived from `border`, `muted`, and `primary` tokens.
- A clear hover state on the thumb.
- `scrollbar-gutter: stable` only on the main Docs scroller when it does not create duplicate gutters.

The visual scrollbar is an affordance, not the only navigation mechanism. Mouse wheel, touch, keyboard, Page Up/Down, Home/End, anchor links, previous/next, and mobile drawer navigation remain usable.

Short pages do not need a disabled decorative scrollbar. When the main document exceeds its available height, the scrollbar thumb must appear and the user must be able to drag or wheel all the way to the final related/previous/next content.

### Anchor behavior

Headings continue to use stable shared IDs. Clicking an on-page link must scroll the main Docs container to the heading while respecting the header offset. Legacy anchors continue routing from `/docs#...` to canonical pages.

### Responsive behavior

- Desktop: persistent left navigation, main document scrollbar, optional right ToC.
- Tablet: persistent left navigation where space allows; main document remains the only content scroller.
- Mobile: drawer navigation and full-width main document; header/search remain visible while content scrolls.
- No horizontal page overflow. Wide tables and code samples may scroll within their own bounded container.

No back-to-top button or reading-progress indicator is added in this scope.

## Accessibility

- Scroll containers remain keyboard reachable through normal document focus movement; no keyboard trap is introduced.
- Headings preserve semantic order and stable IDs.
- Links use descriptive labels and external links retain safe behavior.
- Text and scrollbar colors must remain distinguishable in light and dark themes.
- Body text remains readable at 200% zoom and does not rely on an unusually large base size for accessibility.
- Mobile navigation controls retain at least a 44×44 pixel target.
- Reduced-motion behavior remains unchanged.

## Validation and Tests

### Content contracts

- Every slug has both VI and EN Markdown.
- General and Gateway pages meet their appropriate word-count range, with explicit exceptions for overview/support-matrix pages.
- Required page-template concepts appear in both locales.
- All 16 registered commands remain documented.
- Gateway invariant tests continue covering SCA versus Gateway balance, pending versus ready, source-scoped transfer, fee reserve, same-domain withdraw, webhook finality, and sync recovery.
- No draft markers, placeholder copy, or unfinished sections.
- Tutorial generation remains byte-for-byte synchronized after `npm run docs:sync`.

### Browser tests

- A long Gateway page has `scrollHeight > clientHeight` in the primary Docs scroller.
- Computed `overflow-y` is `auto` or `scroll` on that element.
- Scrolling or dragging changes its `scrollTop` and reaches the final previous/next navigation.
- On-page ToC anchors target rendered heading IDs and move the correct scroll container.
- Sidebar, mobile drawer, search, breadcrumbs, previous/next, locale switching, legacy anchors, and theme persistence continue working.
- Desktop 1440 and mobile 390 visual baselines cover light and dark themes.
- Axe runs on overview, quickstart, Gateway unified balance, command reference, and troubleshooting in light/dark.
- Mobile pages have no horizontal overflow.
- Visual baselines confirm the compact article typography scale on overview, Gateway, command reference, and troubleshooting pages.

### Repository verification

- `npm run docs:sync`
- `npm run docs:validate`
- `npm test`
- `npm run lint`
- Production `npm run build`
- Docs Playwright acceptance projects
- Existing command-center snapshots to detect global CSS regressions

## Non-Goals

- No backend API changes.
- No changes to authentication or transaction execution.
- No changes to Circle Gateway, CCTP, Arc swap, or proof behavior.
- No public internal API reference, secrets, environment variables, webhook secrets, or deployment runbooks.
- No new image assets, documentation CMS, remote search service, progress bar, or back-to-top control.

## Concurrent Workspace Constraint

At design time, the shared workspace contains unrelated uncommitted changes in Gateway/chat-scroll files, including `app/globals.css`. Implementation must preserve those changes, inspect the current CSS immediately before editing, and keep Docs scrollbar styles isolated to a dedicated class to minimize overlap.

## Acceptance Summary

The work is accepted when all 25 routes are materially expanded in both locales, Circle Gateway pages provide the deepest operational explanations, article typography is compact and comfortable for long-form reading, long pages expose a visible and usable scrollbar across desktop/mobile light/dark themes, tutorial knowledge remains concise and synchronized, and the full repository verification suite passes without regressions.
