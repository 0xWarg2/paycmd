# Execution Status And Toolbar Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop historical execution spinners, clearly mark completed status snapshots, and prevent desktop wallet/network controls from covering chat content.

**Architecture:** Extend the pure execution-step model with a historical-snapshot context, then pass liveness from the chat message controller into the presentational timeline. Keep the toolbar in the shell grid row and apply responsive disclosure to its labels. Mirror both states in the development fixture for deterministic Playwright coverage.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, node:test, Playwright.

## Global Constraints

- Only the latest non-terminal execution snapshot may animate.
- Historical snapshots must state `Step completed` without pretending the whole transaction completed at that snapshot.
- The desktop toolbar must remain a real 64px layout row.
- Reduced-motion users receive no spinner or transition animation.

---

### Task 1: Historical execution step model

**Files:**
- Modify: `lib/paycmd/ui-models.ts`
- Test: `lib/paycmd/ui-models.test.ts`

**Interfaces:**
- Consumes: `executionStepsForStatus(status, context)`
- Produces: `context.historical?: boolean`, returning no active step for historical snapshots.

- [ ] Add a unit test asserting historical queued/running steps are complete through the reached step and contain no active state.
- [ ] Run `node --test lib/paycmd/ui-models.test.ts` and observe the new assertion fail.
- [ ] Implement the minimal historical branch in `executionStepsForStatus`.
- [ ] Re-run the focused unit test and the full `npm test` suite.

### Task 2: Timeline and status-card presentation

**Files:**
- Modify: `components/paycmd/transaction-safety.tsx`
- Modify: `components/paycmd-app.tsx`
- Modify: `lib/i18n.tsx`
- Modify: `components/paycmd/command-center-preview.tsx`
- Test: `tests/ui/command-center.spec.ts`

**Interfaces:**
- Consumes: `ExecutionTimeline` status plus `isLive?: boolean`.
- Produces: static historical timelines and localized completion badges.

- [ ] Add a Playwright assertion that the historical timeline has no spinner and shows `Step completed`.
- [ ] Run the focused Playwright test and observe it fail.
- [ ] Pass snapshot liveness into `ExecutionTimeline` and add transition classes with reduced-motion fallbacks.
- [ ] Render historical/completed fixture states and re-run the focused Playwright test.

### Task 3: Compact non-overlapping toolbar

**Files:**
- Modify: `components/paycmd-shell.tsx`
- Modify: `components/paycmd/command-center-preview.tsx`
- Test: `tests/ui/command-center.spec.ts`

**Interfaces:**
- Consumes: existing network, wallet, balance, and system-status values.
- Produces: bounded compact controls in the dedicated desktop header row.

- [ ] Add fixture test IDs and a 1024px bounding-box assertion proving toolbar ends before content begins.
- [ ] Run the focused Playwright test and observe it fail against the overlapping fixture state.
- [ ] Add responsive label disclosure and bounded widths to the production toolbar and fixture.
- [ ] Re-run 1024px light/dark visual tests and update approved baselines.

### Task 4: Verification and preview

**Files:**
- Verify all modified files and snapshots.

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: a tested preview image for user review.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:ui`.
- [ ] Capture the 1024px dark fixture screenshot and present it to the user.
