# AI Quota X DM CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users who exhaust their free AI allowance a localized, persistent CTA that opens `@0xWarg__` on X.

**Architecture:** A persisted boolean on `ChatMessage` identifies quota-exhausted assistant errors without parsing translated text. A small pure helper owns the fixed X destination and CTA predicate; `paycmd-app.tsx` writes the marker in both AI error flows, persists and reloads it through existing message metadata, and conditionally renders a safe external link button.

**Tech Stack:** Next.js, React 19, TypeScript, Tailwind CSS, Node's built-in test runner via `tsx`.

## Global Constraints

- Only an `AI_QUOTA_EXHAUSTED` error may display the CTA.
- Use the fixed profile URL `https://x.com/0xWarg__`.
- The link opens in a new tab and has `rel="noreferrer"`.
- English CTA label: `DM @0xWarg__ on X`; Vietnamese CTA label: `DM @0xWarg__ trên X`.
- Do not alter quota, whitelist, database policy, or API behavior.

---

### Task 1: Add and test the quota-contact presentation contract

**Files:**

- Create: `lib/paycmd/ai/quota-contact.ts`
- Create: `lib/paycmd/ai/quota-contact.test.ts`

**Interfaces:**

- Produces: `AI_QUOTA_X_PROFILE_URL: "https://x.com/0xWarg__"`
- Produces: `shouldShowQuotaContactCta(message: { quotaContactCta?: boolean }): boolean`
- Consumes: no external dependencies.

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowQuotaContactCta } from "./quota-contact.ts";

test("shows the X contact CTA only when the quota marker is present", () => {
  assert.equal(shouldShowQuotaContactCta({ quotaContactCta: true }), true);
  assert.equal(shouldShowQuotaContactCta({ quotaContactCta: false }), false);
  assert.equal(shouldShowQuotaContactCta({}), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/paycmd/ai/quota-contact.test.ts`

Expected: FAIL because `./quota-contact.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export const AI_QUOTA_X_PROFILE_URL = "https://x.com/0xWarg__";

export function shouldShowQuotaContactCta(message: { quotaContactCta?: boolean }) {
  return message.quotaContactCta === true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/paycmd/ai/quota-contact.test.ts`

Expected: PASS with one passing subtest.

### Task 2: Mark, persist, and render the quota contact CTA

**Files:**

- Modify: `components/paycmd-app.tsx:150-190, 2390-2530, 2680-2800, 4550-4630`
- Modify: `lib/i18n.tsx:254-257, 755-758`
- Test: `lib/paycmd/ai/quota-contact.test.ts`

**Interfaces:**

- Consumes: `AI_QUOTA_X_PROFILE_URL` and `shouldShowQuotaContactCta` from `lib/paycmd/ai/quota-contact.ts`.
- Produces: assistant messages with an optional persisted `quotaContactCta: boolean` metadata field.

- [ ] **Step 1: Extend message data flow**

```ts
type ChatMessage = {
  // existing fields
  quotaContactCta?: boolean;
};

// `mapRowToMessage`
quotaContactCta: metadata.quotaContactCta === true,

// `saveMessage` metadata
quotaContactCta: message.quotaContactCta ?? null,
```

Add the same metadata field to the existing whole-metadata rewrite in `updateDraftState` so it cannot be removed from persisted rows.

- [ ] **Step 2: Mark both quota-exhausted error branches**

```ts
const quotaExhausted = (error as { code?: string })?.code === "AI_QUOTA_EXHAUSTED";

await saveMessage({
  role: "assistant",
  text: quotaExhausted ? t("ai.quotaExhausted") : fallbackText,
  quotaContactCta: quotaExhausted,
  // existing provider and quota fields
});
```

Apply this to the AskPayna research error handler and the command-AI error handler. Preserve their current non-quota fallback texts and actions.

- [ ] **Step 3: Add localized text**

```ts
"ai.quotaExhausted": "Bạn đã dùng hết 10 lượt AI miễn phí. Để được cấp thêm quyền truy cập, hãy DM trực tiếp cho mình trên X.",
"ai.quotaExhaustedCta": "DM @0xWarg__ trên X",

"ai.quotaExhausted": "You have used all 10 free AI calls. To request continued access, DM me directly on X.",
"ai.quotaExhaustedCta": "DM @0xWarg__ on X",
```

- [ ] **Step 4: Render the CTA from the persisted marker**

```tsx
{shouldShowQuotaContactCta(message) ? (
  <a
    href={AI_QUOTA_X_PROFILE_URL}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center rounded-md border border-sky-400/50 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-500/20 dark:text-sky-300"
  >
    {t("ai.quotaExhaustedCta")}
  </a>
) : null}
```

Place this beneath the ordinary assistant text inside the existing `space-y-3` container. Do not use markdown parsing for the error response.

- [ ] **Step 5: Run focused regression tests**

Run: `npx tsx --test lib/paycmd/ai/quota-contact.test.ts lib/paycmd/ai/quota-onboarding.test.ts`

Expected: PASS; the new test demonstrates only a true quota marker creates a CTA, and existing onboarding behavior stays unchanged.

- [ ] **Step 6: Commit**

```bash
git add components/paycmd-app.tsx lib/i18n.tsx lib/paycmd/ai/quota-contact.ts lib/paycmd/ai/quota-contact.test.ts && git commit -m "feat(ai): add X DM CTA when quota is exhausted"
```

### Task 3: Validate the production integration

**Files:**

- Verify only: `components/paycmd-app.tsx`, `lib/i18n.tsx`, `lib/paycmd/ai/quota-contact.ts`

**Interfaces:**

- Consumes: the completed Task 1 and Task 2 implementations.
- Produces: verification evidence for the final handoff.

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no lint errors in changed files.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: exit code 0 and a compiled Next.js production build.

- [ ] **Step 3: Inspect final changes**

Run: `git diff HEAD~1 --check && git status --short`

Expected: no whitespace errors; only intentional user-owned untracked files, if any, remain outside the feature commit.
