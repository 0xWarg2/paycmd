# AI Quota Onboarding Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a dismissible, account-level beta banner to new limited users before their first AI request.

**Architecture:** A non-consuming Supabase RPC returns quota state for `auth.uid()`. A server API combines that state with `user_profiles.ai_quota_notice_seen_at`, and the empty-chat onboarding renders a pure-predicate-controlled banner whose dismiss action persists through the same API.

**Tech Stack:** Next.js App Router, React, Supabase PostgreSQL/RLS/RPC, TypeScript, node:test, i18n.

## Global Constraints

- Quota status reads must never reserve or consume an AI request.
- RPC identity comes only from `auth.uid()` and accepts no arbitrary user ID.
- Whitelisted, quota-disabled, used, dismissed, or access-check-failed users do not see the banner.
- `.claude/` remains outside every commit.

---

### Task 1: Non-consuming quota status and account dismissal

**Files:**
- Create: `supabase/migrations/20260803010000_add_ai_quota_onboarding.sql`
- Create: `app/api/ai/quota/route.ts`
- Modify: `lib/paycmd/ai/access.ts`

**Interfaces:**
- Produces `get_deepseek_quota()` returning `unlimited`, `used`, and `remaining` for `auth.uid()`.
- Produces `GET /api/ai/quota -> { quota: AiQuota; noticeSeenAt: string | null }`.
- Produces `POST /api/ai/quota -> { noticeSeenAt: string }`.

- [ ] Write a failing `node:test` for the quota notice display predicate and response normalization.
- [ ] Run the test and confirm it fails because the helper does not exist.
- [ ] Add the migration: nullable `user_profiles.ai_quota_notice_seen_at`, non-consuming security-definer RPC, revoke public/anon, grant authenticated.
- [ ] Add a reusable quota snapshot helper in `access.ts`; when the flag is off return the existing disabled/unlimited shape without RPC.
- [ ] Implement authenticated GET and POST handlers; POST updates only `.eq("user_id", user.id)`.
- [ ] Run the focused tests and route lint.

### Task 2: One-time onboarding banner

**Files:**
- Modify: `components/paycmd-app.tsx`
- Modify: `lib/i18n.tsx`

**Interfaces:**
- Consumes the GET/POST quota endpoint.
- Produces a closable banner inside `OnboardingGuide` only when `shouldShowQuotaOnboarding(state)` is true.

- [ ] Add Vietnamese and English beta/free-quota copy plus accessible dismiss label.
- [ ] Fetch onboarding quota state only for authenticated empty-chat onboarding.
- [ ] Pass visibility and dismiss callback to `OnboardingGuide`; optimistically hide and persist dismissal.
- [ ] Keep the banner hidden when loading or when GET fails.
- [ ] Verify new limited, whitelist, disabled, used, dismissed, and error states with focused tests.

### Task 3: Verification, remote migration, and commit

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-ai-quota-onboarding-design.md` to use the real `user_profiles` table name.

- [ ] Run focused node tests and scoped ESLint.
- [ ] Run `git diff --check` and `npm run build`.
- [ ] Apply migration `20260803010000` to the linked Supabase project and verify the column, RPC, and migration history entry.
- [ ] Commit implementation as `feat(ai): add one-time free quota onboarding`.
