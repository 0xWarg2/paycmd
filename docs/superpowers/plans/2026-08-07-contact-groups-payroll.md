# Contact Groups and Basic Payroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owned contact groups managed from chat and Contacts, then make payroll preview and execute one explicit group with durable item-level partial-failure results.

**Architecture:** Postgres owns group membership, recipient ordering, fingerprinting, and atomic batch snapshots. Focused service modules keep route handlers thin. A pure sequential executor catches item-local transfer failures and always continues, while an atomic `draft -> running` claim prevents duplicate confirmation.

**Tech Stack:** Next.js 16 route handlers, React 19, TypeScript 5.9, Supabase/Postgres RLS and RPC, Node test runner, Playwright, Circle Gateway transfer route, bilingual public docs.

## Global Constraints

- Payroll always targets one explicit owned contact group; it never silently falls back to all active contacts.
- Eligible recipients are active group members with valid EVM addresses, deterministically ordered and capped at 25.
- Preview and batch creation use the same database fingerprint; changed membership requires a new preview.
- Payroll amount is uniform per recipient and total arithmetic is decimal-safe.
- Execution is sequential; any item-local failure is recorded and items after it continue.
- Successful items are never rolled back.
- No retry, queue, automatic resume, parallel transfer, CSV import, recurring payroll, or variable per-member amount is added.
- A batch can transition from `draft` to `running` only once.
- Group deletion never deletes contacts; contact deletion removes memberships; payroll history remains readable.
- Group mutations and payroll confirmation use the 15-second preview lease delivered by the companion plan.
- Product behavior changes update English and Vietnamese public docs, then run `npm run docs:sync` and `npm run docs:validate`.
- Production code follows test-first red-green-refactor.

---

## File Structure

- Create `supabase/migrations/20260807000000_add_contact_groups_and_payroll_snapshot.sql`: tables, RLS, helper functions, RPCs, and payroll columns.
- Create `lib/paycmd/contact-groups.ts` and test: normalization, validation, response types.
- Create `lib/paycmd/contact-group-service.ts` and test: ownership-aware group operations behind an injected repository.
- Create `app/api/contact-groups/route.ts`, `app/api/contact-groups/[id]/route.ts`, `app/api/contact-groups/[id]/members/route.ts`, and `app/api/contact-groups/[id]/members/[contactId]/route.ts`.
- Modify `components/contacts-list.tsx`: groups panel and member dialog.
- Modify `app/contacts/page.tsx` and `app/dev/contacts-preview/page.tsx`: load/render group data and demo fixtures.
- Modify `tests/ui/contacts.spec.ts`: CRUD, membership, focus, mobile, and accessibility.
- Modify `lib/paycmd/commands.ts` and tests: contact-group grammar and group-specific payroll fields.
- Create `lib/paycmd/payroll-snapshot.ts` and test: typed preview normalization and decimal totals.
- Create `app/api/payroll/preview/route.ts`: owned group preview via database RPC.
- Modify `app/api/payroll/batches/route.ts`: create only from matching group fingerprint.
- Create `lib/paycmd/payroll-executor.ts` and test: sequential continue-on-failure orchestration.
- Modify `app/api/payroll/batches/[id]/confirm/route.ts`: one-time claim and executor integration.
- Modify `components/paycmd-app.tsx` and `components/paycmd-runtime.tsx`: group preview, fingerprint submission, and item summary.
- Modify bilingual public docs and regenerate `content/payna-tutorial.json`.

---

### Task 1: Add contact-group and payroll-snapshot database primitives

**Files:**
- Create: `supabase/migrations/20260807000000_add_contact_groups_and_payroll_snapshot.sql`
- Create: `lib/paycmd/contact-groups.ts`
- Create: `lib/paycmd/contact-groups.test.ts`

**Interfaces:**
- Produces: `normalizeContactGroupName(name)`, `validateContactGroupName(name)`, `contact_groups`, `contact_group_members`, `payroll_group_recipients(uuid)`, `payroll_recipient_fingerprint(uuid)`, `create_payroll_batch_snapshot(...)`.
- Consumes: existing `contacts`, `payroll_batches`, and `payroll_items` tables.

- [ ] **Step 1: Write failing group-name tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { normalizeContactGroupName, validateContactGroupName } from "./contact-groups.ts";

test("normalizes owned group names deterministically", () => {
  assert.equal(normalizeContactGroupName("  Core   Team  "), "core team");
  assert.equal(normalizeContactGroupName("NHÓM KỸ THUẬT"), "nhóm kỹ thuật");
});

test("requires a bounded visible group name", () => {
  assert.deepEqual(validateContactGroupName(""), { ok: false, code: "GROUP_NAME_REQUIRED" });
  assert.deepEqual(validateContactGroupName("a".repeat(81)), { ok: false, code: "GROUP_NAME_TOO_LONG" });
  assert.deepEqual(validateContactGroupName("Core Team"), { ok: true, name: "Core Team", normalizedName: "core team" });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test lib/paycmd/contact-groups.test.ts`

Expected: FAIL because `contact-groups.ts` does not exist.

- [ ] **Step 3: Implement the pure group-name contract**

```ts
export const CONTACT_GROUP_NAME_MAX = 80;

export function normalizeContactGroupName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("und");
}

export function validateContactGroupName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false as const, code: "GROUP_NAME_REQUIRED" as const };
  if (name.length > CONTACT_GROUP_NAME_MAX) return { ok: false as const, code: "GROUP_NAME_TOO_LONG" as const };
  return { ok: true as const, name, normalizedName: normalizeContactGroupName(name) };
}
```

- [ ] **Step 4: Write the migration with exact ownership and snapshot rules**

Create `contact_groups` and `contact_group_members` exactly as specified, add indexes and RLS, and add these payroll columns:

```sql
alter table public.payroll_batches
  add column if not exists contact_group_id uuid references public.contact_groups(id) on delete set null,
  add column if not exists recipient_count integer,
  add column if not exists per_recipient_amount numeric(20, 6),
  add column if not exists total_amount numeric(20, 6),
  add column if not exists recipient_fingerprint text;
```

The membership `with check` policy must contain both ownership predicates:

```sql
with check (
  exists (select 1 from public.contact_groups g where g.id = group_id and g.user_id = auth.uid())
  and exists (select 1 from public.contacts c where c.id = contact_id and c.user_id = auth.uid())
)
```

`payroll_group_recipients(p_group_id)` returns at most 25 eligible rows ordered by member `created_at`, then contact ID. `payroll_recipient_fingerprint(p_group_id)` hashes a delimiter-safe `string_agg` of contact ID, lowercase address, preferred chain, and status in that same order. The preview and creation RPCs call this one function rather than reimplementing hashing in TypeScript.

`create_payroll_batch_snapshot(p_group_id, p_amount, p_source_chain, p_expected_fingerprint)` verifies ownership, positive amount, non-empty eligible recipients, and fingerprint equality; inserts one batch and all items in the function's transaction; returns the batch ID. Raise `PAYROLL_PREVIEW_STALE` when fingerprints differ.

- [ ] **Step 5: Validate the migration without resetting user data**

Run: `supabase db lint` and the repository's non-destructive database tests when local Supabase is available, followed by read-only SQL inspection of table columns, policies, and RPC signatures.

Expected: migration succeeds; a cross-owner membership insert is rejected; group deletion retains contacts; contact deletion removes memberships.

If local Supabase is unavailable, validate the SQL through the available migration linter/parser and record the missing integration environment without claiming the database acceptance check passed. Do not run `supabase db reset` without explicit user authorization.

- [ ] **Step 6: Re-run the focused unit test**

Run: `node --test lib/paycmd/contact-groups.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit database primitives**

```bash
git add supabase/migrations/20260807000000_add_contact_groups_and_payroll_snapshot.sql lib/paycmd/contact-groups.ts lib/paycmd/contact-groups.test.ts
git commit -m "feat: add owned contact groups and payroll snapshots"
```

---

### Task 2: Implement ownership-safe contact-group APIs

**Files:**
- Create: `lib/paycmd/contact-group-service.ts`
- Create: `lib/paycmd/contact-group-service.test.ts`
- Create: `app/api/contact-groups/route.ts`
- Create: `app/api/contact-groups/[id]/route.ts`
- Create: `app/api/contact-groups/[id]/members/route.ts`
- Create: `app/api/contact-groups/[id]/members/[contactId]/route.ts`

**Interfaces:**
- Consumes: Task 1 name validation and Supabase tables.
- Produces: list/create/update/delete group and idempotent add/remove membership operations.

- [ ] **Step 1: Write failing service tests with an in-memory repository**

```ts
test("creates one normalized owned group and rejects a duplicate", async () => {
  const repository = createMemoryContactGroupRepository({ groups: [], contacts: [], memberships: [] });
  const first = await createContactGroup({ userId: "u1", name: "Core Team" }, repository);
  assert.equal(first.normalized_name, "core team");
  await assert.rejects(
    () => createContactGroup({ userId: "u1", name: " core  team " }, repository),
    (error: ContactGroupError) => error.code === "GROUP_NAME_EXISTS",
  );
});

test("will not add another user's contact", async () => {
  const ownedGroup = { id: "g1", user_id: "u1", name: "Core Team", normalized_name: "core team" };
  const otherUsersContact = { id: "c2", user_id: "u2", display_name: "Other", wallet_address: "0x2222222222222222222222222222222222222222" };
  const repository = createMemoryContactGroupRepository({ groups: [ownedGroup], contacts: [otherUsersContact], memberships: [] });
  await assert.rejects(
    () => addContactGroupMember({ userId: "u1", groupId: ownedGroup.id, contactId: otherUsersContact.id }, repository),
    (error: ContactGroupError) => error.code === "CONTACT_NOT_FOUND",
  );
});

test("adds and removes membership idempotently", async () => {
  const ownedGroup = { id: "g1", user_id: "u1", name: "Core Team", normalized_name: "core team" };
  const ownedContact = { id: "c1", user_id: "u1", display_name: "Minh", wallet_address: "0x1111111111111111111111111111111111111111" };
  const input = { userId: "u1", groupId: "g1", contactId: "c1" };
  const repository = createMemoryContactGroupRepository({ groups: [ownedGroup], contacts: [ownedContact], memberships: [] });
  await addContactGroupMember(input, repository);
  await addContactGroupMember(input, repository);
  assert.equal(repository.memberships.length, 1);
  await removeContactGroupMember(input, repository);
  await removeContactGroupMember(input, repository);
  assert.equal(repository.memberships.length, 0);
});
```

Define `createMemoryContactGroupRepository(seed)` in the test file as a test-only implementation of the exact `ContactGroupRepository` interface in Step 3; its `memberships` array is public for assertions and `addMember` deduplicates the `groupId|contactId` key.

- [ ] **Step 2: Run and verify RED**

Run: `node --test lib/paycmd/contact-group-service.test.ts`

Expected: FAIL because the service module does not exist.

- [ ] **Step 3: Implement the service interface and error mapping**

```ts
export type ContactGroupRepository = {
  list(userId: string): Promise<ContactGroupWithMembers[]>;
  findGroup(userId: string, groupId: string): Promise<ContactGroup | null>;
  findContact(userId: string, contactId: string): Promise<Contact | null>;
  insertGroup(row: NewContactGroup): Promise<ContactGroup>;
  updateGroup(userId: string, groupId: string, patch: ContactGroupPatch): Promise<ContactGroup | null>;
  deleteGroup(userId: string, groupId: string): Promise<boolean>;
  addMember(groupId: string, contactId: string): Promise<void>;
  removeMember(groupId: string, contactId: string): Promise<void>;
};
```

Define `ContactGroupError` codes `GROUP_NAME_REQUIRED`, `GROUP_NAME_TOO_LONG`, `GROUP_NAME_EXISTS`, `GROUP_NOT_FOUND`, and `CONTACT_NOT_FOUND`. The route layer maps them to 400, 409, or 404 without leaking raw database errors.

- [ ] **Step 4: Implement thin authenticated route handlers**

Each route obtains `user` through `supabase.auth.getUser()`, returns 401 when missing, builds the Supabase repository, and calls the service. Member add accepts `{ contactIds: string[] }`, removes duplicates, and returns the refreshed owned group. Member deletion is idempotent and returns `{ removed: true, groupId, contactId }` even when membership was already absent.

- [ ] **Step 5: Run service and lint checks**

Run: `node --test lib/paycmd/contact-group-service.test.ts && npx eslint lib/paycmd/contact-group-service.ts app/api/contact-groups`

Expected: PASS.

- [ ] **Step 6: Commit group APIs**

```bash
git add lib/paycmd/contact-group-service.ts lib/paycmd/contact-group-service.test.ts app/api/contact-groups
git commit -m "feat: add contact group APIs"
```

---

### Task 3: Add manual group management to Contacts

**Files:**
- Modify: `components/contacts-list.tsx`
- Modify: `app/contacts/page.tsx`
- Modify: `app/dev/contacts-preview/page.tsx`
- Modify: `lib/i18n.tsx`
- Modify: `lib/i18n/server.ts`
- Modify: `tests/ui/contacts.spec.ts`

**Interfaces:**
- Consumes: Task 2 group APIs and existing contact list.
- Produces: group list/counts, create/rename/delete controls, membership dialog, and contact group badges.

- [ ] **Step 1: Add failing UI tests for common group operations**

```ts
test("creates a group and manages members without deleting contacts", async ({ page }) => {
  await page.goto("/dev/contacts-preview");
  await page.getByRole("button", { name: "Tạo nhóm" }).click();
  await page.getByLabel("Tên nhóm").fill("Core Team");
  await page.getByRole("button", { name: "Lưu nhóm" }).click();
  await expect(page.getByRole("button", { name: /Core Team.*0 thành viên/ })).toBeVisible();

  await page.getByRole("button", { name: /Quản lý thành viên Core Team/ }).click();
  await page.getByRole("checkbox", { name: "Minh" }).check();
  await page.getByRole("button", { name: "Lưu thành viên" }).click();
  await expect(page.getByRole("button", { name: /Core Team.*1 thành viên/ })).toBeVisible();
  await expect(page.getByText("Minh", { exact: true })).toBeVisible();
});

test("deleting a group keeps its contacts", async ({ page }) => {
  await page.goto("/dev/contacts-preview?group=core-team");
  await page.getByRole("button", { name: "Xoá nhóm Core Team" }).click();
  await expect(page.getByRole("dialog")).toContainText("contact vẫn được giữ lại");
  await page.getByRole("button", { name: "Xoá nhóm", exact: true }).click();
  await expect(page.getByText("Core Team", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Minh", { exact: true })).toBeVisible();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx playwright test tests/ui/contacts.spec.ts --grep "group|nhóm" --project=chromium`

Expected: FAIL because the group controls do not exist.

- [ ] **Step 3: Add group data loading and mutation helpers**

`app/contacts/page.tsx` loads contacts and groups concurrently for authenticated users. `ContactsList` accepts:

```ts
type ContactsListProps = {
  contacts: Contact[];
  initialGroups: ContactGroupWithMembers[];
  previewMode?: boolean;
};
```

Inside the client component, keep group mutations local and refresh the touched group from the API response. On failed mutations, retain the dialog and current selection.

- [ ] **Step 4: Implement accessible group and membership UI**

Add a Groups section with `All contacts`, group buttons, counts, and group action menus. The member dialog uses searchable named checkboxes; saving computes additions/removals and calls the member routes. Group deletion confirmation states that contacts remain. Restore focus to the invoking control after close; if deletion removes that control, focus `Create group` or `All contacts`.

- [ ] **Step 5: Add bilingual copy and preview fixtures**

Add exact English/Vietnamese keys for create, rename, delete, duplicate, members, empty group, save pending, and failure states. The dev preview intercepts group routes and exposes deterministic `Core Team`, Minh, and Lan fixtures for Playwright.

- [ ] **Step 6: Re-run Contacts UI and accessibility tests**

Run: `npx playwright test tests/ui/contacts.spec.ts --project=chromium`

Expected: all existing deletion tests plus new group tests pass, Axe has no serious/critical violation, and no horizontal overflow occurs at 390 pixels.

- [ ] **Step 7: Commit Contacts group UI**

```bash
git add components/contacts-list.tsx app/contacts/page.tsx app/dev/contacts-preview/page.tsx lib/i18n.tsx lib/i18n/server.ts tests/ui/contacts.spec.ts
git commit -m "feat: manage contact groups from Contacts"
```

---

### Task 4: Extend chatbot grammar for groups and group payroll

**Files:**
- Modify: `lib/paycmd/commands.ts`
- Modify: `lib/paycmd/commands.test.ts`
- Modify: `components/paycmd-app.tsx`
- Modify: `components/paycmd-runtime.tsx`

**Interfaces:**
- Produces: group contact actions and payroll fields `{ groupName, amount, sourceChain }`.
- Consumes: Task 2 group APIs and the shared confirmation policy/preview lease.

- [ ] **Step 1: Write failing parser tests**

```ts
test("parses contact group commands with multi-word names", () => {
  assert.deepEqual(parsePayCmd("/contacts group create Core Team").fields, { action: "create_group", groupName: "Core Team", contactName: "" });
  assert.deepEqual(parsePayCmd("/contacts group add Core Team Minh").fields, { action: "add_group_member", groupName: "", contactName: "", memberExpression: "Core Team Minh" });
});

test("parses payroll against one explicit group", () => {
  const draft = parsePayCmd("/payroll run Core Team 25 from base");
  assert.equal(draft.fields.groupName, "Core Team");
  assert.equal(draft.fields.amount, "25");
  assert.equal(draft.fields.sourceChain, "baseSepolia");
  assert.deepEqual(draft.missingFields, []);
});

test("payroll without a group remains incomplete", () => {
  const draft = parsePayCmd("/payroll run 25 from base");
  assert.ok(draft.missingFields.includes("groupName"));
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test lib/paycmd/commands.test.ts`

Expected: FAIL because existing payroll uses a non-authoritative name and contacts has no group actions.

- [ ] **Step 3: Implement unambiguous grammar**

For create/list/delete, action keywords delimit the group name. For add/remove, resolve names against the user's loaded group/contact catalog in the command execution layer rather than guessing a split from arbitrary tokens. The parser may initially store `memberExpression`; the resolver must return one exact owned group plus one exact contact or a clarification list.

```ts
type GroupResolution =
  | { status: "resolved"; groupId: string; contactId?: string }
  | { status: "ambiguous"; groupMatches: string[]; contactMatches: string[] }
  | { status: "missing"; missing: "group" | "contact" };
```

Payroll syntax is safely delimited by the numeric amount and `from` chain, so `groupName` is the text between `run` and amount.

- [ ] **Step 4: Execute group actions through APIs**

Read-only `group list` runs immediately. Create, delete, add-member, and remove-member remain confirmation-required by extending `requiresConfirmation()` for those exact contact actions. The preview describes the group/member mutation and uses the 15-second lease. Execution calls the group API and formats the refreshed group count.

- [ ] **Step 5: Re-run parser and lint checks**

Run: `node --test lib/paycmd/commands.test.ts && npx eslint lib/paycmd/commands.ts components/paycmd-app.tsx components/paycmd-runtime.tsx`

Expected: PASS with existing command syntax unchanged.

- [ ] **Step 6: Commit chatbot group commands**

```bash
git add lib/paycmd/commands.ts lib/paycmd/commands.test.ts components/paycmd-app.tsx components/paycmd-runtime.tsx
git commit -m "feat: add contact group chat commands"
```

---

### Task 5: Implement authoritative payroll preview and atomic batch creation

**Files:**
- Create: `lib/paycmd/payroll-snapshot.ts`
- Create: `lib/paycmd/payroll-snapshot.test.ts`
- Create: `app/api/payroll/preview/route.ts`
- Modify: `app/api/payroll/batches/route.ts`
- Modify: `components/paycmd-app.tsx`
- Modify: `components/paycmd-runtime.tsx`

**Interfaces:**
- Consumes: Task 1 database RPCs and Task 4 `groupName`.
- Produces: `PayrollPreview`, fingerprint-checked draft batch, and group-specific preview UI.

- [ ] **Step 1: Write failing preview-normalization tests**

```ts
test("formats exact six-decimal payroll totals without floating point", () => {
  const preview = normalizePayrollPreview({
    group_id: "g1",
    group_name: "Core Team",
    recipients: [
      { contactId: "c1", label: "Minh", address: "0x1111111111111111111111111111111111111111", destinationChain: "arcTestnet" },
      { contactId: "c2", label: "Lan", address: "0x2222222222222222222222222222222222222222", destinationChain: "arcTestnet" },
      { contactId: "c3", label: "Vu", address: "0x3333333333333333333333333333333333333333", destinationChain: "baseSepolia" },
    ],
    excluded: [],
    per_recipient_amount: "0.100001",
    source_chain: "baseSepolia",
    recipient_fingerprint: "abc123",
  });
  assert.equal(preview.recipientCount, 3);
  assert.equal(preview.totalAmount, "0.300003");
});

test("does not accept an empty fingerprint or recipient set", () => {
  assert.throws(() => normalizePayrollPreview({
    group_id: "g1",
    group_name: "Core Team",
    recipients: [],
    excluded: [],
    per_recipient_amount: "1",
    source_chain: "baseSepolia",
    recipient_fingerprint: "",
  }), /PAYROLL_GROUP_EMPTY/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test lib/paycmd/payroll-snapshot.test.ts`

Expected: FAIL because the snapshot module does not exist.

- [ ] **Step 3: Implement decimal-safe normalization**

```ts
export function usdcToAtomic(value: string) {
  const match = value.match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) throw new Error("INVALID_USDC_AMOUNT");
  return BigInt(match[1]) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0"));
}

export function atomicToUsdc(value: bigint) {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
```

`normalizePayrollPreview` calculates `totalAmount = perRecipientAtomic * BigInt(recipientCount)` and preserves server order/fingerprint.

- [ ] **Step 4: Add the authenticated preview route**

Resolve `groupName` to one owned group, call `payroll_group_recipients` and `payroll_recipient_fingerprint`, include inactive/invalid/over-cap members in `excluded`, and return the normalized contract. Unknown/empty groups return 404/400; no preview is fabricated from global contacts.

- [ ] **Step 5: Replace batch creation with the atomic RPC**

`POST /api/payroll/batches` requires:

```ts
{ groupId: string; amount: string; sourceChain: string; recipientFingerprint: string }
```

Call `create_payroll_batch_snapshot`. Map the database `PAYROLL_PREVIEW_STALE` exception to HTTP 409 with code `PAYROLL_PREVIEW_STALE`; map unknown group and empty eligible group explicitly. Remove the old query that selects all active contacts.

- [ ] **Step 6: Render the authoritative preview**

`CommandPreviewCard` calls `/api/payroll/preview` only while an active payroll draft exists. Show group, eligible/excluded count, per-recipient amount, total, source chain, and collapsible recipients. Confirm passes the fingerprint. A 409 refreshes the preview, resets the 15-second lease, and requires a new click rather than silently continuing.

- [ ] **Step 7: Run focused and command tests**

Run: `node --test lib/paycmd/payroll-snapshot.test.ts lib/paycmd/commands.test.ts`

Expected: PASS; no `Number(amount) * count` remains in payroll preview code.

- [ ] **Step 8: Commit authoritative payroll snapshots**

```bash
git add lib/paycmd/payroll-snapshot.ts lib/paycmd/payroll-snapshot.test.ts app/api/payroll/preview/route.ts app/api/payroll/batches/route.ts components/paycmd-app.tsx components/paycmd-runtime.tsx
git commit -m "feat: preview payroll from an exact contact group"
```

---

### Task 6: Prove continue-on-failure and prevent duplicate confirmation

**Files:**
- Create: `lib/paycmd/payroll-executor.ts`
- Create: `lib/paycmd/payroll-executor.test.ts`
- Modify: `app/api/payroll/batches/[id]/confirm/route.ts`
- Modify: `components/paycmd-app.tsx`
- Modify: `components/paycmd-runtime.tsx`

**Interfaces:**
- Produces: `executePayrollItems(input, deps)`, `PayrollExecutionSummary`, and one-time `draft -> running` confirmation.
- Consumes: immutable item snapshots and the existing Gateway transfer endpoint.

- [ ] **Step 1: Write the required 25-item failure test**

```ts
test("continues items 11 through 25 when item 10 fails", async () => {
  const attempted: string[] = [];
  const persisted: Array<{ id: string; status: string }> = [];
  const items = Array.from({ length: 25 }, (_, index) => ({
    id: `item-${index + 1}`,
    recipient_address: `0x${String(index + 1).padStart(40, "0")}`,
    destination_chain: "arcTestnet",
    amount: "1",
    token: "USDC",
  }));

  const result = await executePayrollItems(items, {
    markRunning: async () => undefined,
    transfer: async (item) => {
      attempted.push(item.id);
      if (item.id === "item-10") throw new Error("insufficient destination gas");
      return { txHash: `0x${item.id}` };
    },
    markSuccess: async (item, transfer) => { persisted.push({ id: item.id, status: "success" }); return transfer.txHash; },
    markFailed: async (item) => { persisted.push({ id: item.id, status: "failed" }); },
  });

  assert.deepEqual(attempted, items.map((item) => item.id));
  assert.equal(attempted.filter((id) => id === "item-10").length, 1);
  assert.equal(result.successCount, 24);
  assert.equal(result.failedCount, 1);
  assert.equal(result.status, "partial_failed");
  assert.equal(persisted.find((entry) => entry.id === "item-1")?.status, "success");
  assert.equal(persisted.find((entry) => entry.id === "item-25")?.status, "success");
});
```

Add separate tests proving all-success, all-failed, and no retry of a failed item.

- [ ] **Step 2: Run and verify RED**

Run: `node --test lib/paycmd/payroll-executor.test.ts`

Expected: FAIL because the executor module does not exist.

- [ ] **Step 3: Implement the minimal sequential executor**

```ts
export async function executePayrollItems(items: PayrollItem[], deps: PayrollExecutorDependencies) {
  const results: PayrollItemResult[] = [];
  for (const item of items) {
    await deps.markRunning(item);
    try {
      const transfer = await deps.transfer(item);
      const txHash = await deps.markSuccess(item, transfer);
      results.push({ itemId: item.id, status: "success", txHash });
    } catch (error) {
      const message = safePayrollError(error);
      await deps.markFailed(item, message);
      results.push({ itemId: item.id, status: "failed", error: message });
    }
  }
  const failedCount = results.filter((result) => result.status === "failed").length;
  return {
    results,
    successCount: results.length - failedCount,
    failedCount,
    status: failedCount === 0 ? "success" : failedCount === results.length ? "failed" : "partial_failed",
  } as const;
}
```

- [ ] **Step 4: Claim the batch exactly once before execution**

Replace the unconditional running update with an atomic filtered update:

```ts
const { data: claimedBatch, error: claimError } = await supabase
  .from("payroll_batches")
  .update({ status: "running", updated_at: now })
  .eq("id", id)
  .eq("user_id", user.id)
  .eq("status", "draft")
  .select("*")
  .maybeSingle();

if (!claimedBatch) {
  return NextResponse.json({ code: "PAYROLL_ALREADY_STARTED", error: "Payroll batch can only be confirmed once" }, { status: 409 });
}
```

Load queued items only after the claim, call `executePayrollItems`, persist final status/counts, and insert a notification with `successCount`, `failedCount`, and item results. Do not include a retry action.

- [ ] **Step 5: Render the final item-level summary**

The chat receipt uses `24/25 succeeded · 1 failed`, exposes a details list with each label/status/hash or sanitized error, and says failed payments were not retried. It must not describe partial results as queued or resumable.

- [ ] **Step 6: Re-run executor and lint checks**

Run: `node --test lib/paycmd/payroll-executor.test.ts && npx eslint lib/paycmd/payroll-executor.ts app/api/payroll/batches/[id]/confirm/route.ts components/paycmd-app.tsx components/paycmd-runtime.tsx`

Expected: PASS; the 25-item test proves item 25 runs after item 10 fails.

- [ ] **Step 7: Commit execution safety**

```bash
git add lib/paycmd/payroll-executor.ts lib/paycmd/payroll-executor.test.ts app/api/payroll/batches/[id]/confirm/route.ts components/paycmd-app.tsx components/paycmd-runtime.tsx
git commit -m "feat: continue payroll after item failures"
```

---

### Task 7: Update docs and run complete acceptance verification

**Files:**
- Modify: `content/public-docs/en/features/payments-and-contacts.md`
- Modify: `content/public-docs/vi/features/payments-and-contacts.md`
- Modify: `content/public-docs/en/features/payment-requests-and-payroll.md`
- Modify: `content/public-docs/vi/features/payment-requests-and-payroll.md`
- Modify: `content/public-docs/en/commands/payments.md`
- Modify: `content/public-docs/vi/commands/payments.md`
- Modify: `content/public-docs/en/safety-and-support/troubleshooting.md`
- Modify: `content/public-docs/vi/safety-and-support/troubleshooting.md`
- Regenerate: `content/payna-tutorial.json`
- Modify: `lib/paycmd/ai/payna-tutorial.test.ts`
- Modify: `tests/ui/contacts.spec.ts`
- Modify: `tests/ui/command-center.spec.ts`

**Interfaces:**
- Consumes: completed group and payroll behavior.
- Produces: synchronized user guidance and requirement-by-requirement acceptance evidence.

- [ ] **Step 1: Add failing tutorial tests for groups and partial payroll**

```ts
test("retrieves contact-group payroll and continue-on-failure guidance", () => {
  const vi = searchPaynaTutorial("payroll nhóm item thứ 10 thất bại", "vi");
  const en = searchPaynaTutorial("contact group payroll partial failure retry", "en");
  assert.match(vi.documents.map((document) => document.content).join(" "), /item 11.*25.*tiếp tục/i);
  assert.match(en.documents.map((document) => document.content).join(" "), /not retried automatically/i);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test lib/paycmd/ai/payna-tutorial.test.ts`

Expected: FAIL because current docs describe all active contacts and do not define group membership.

- [ ] **Step 3: Update bilingual docs with exact operational semantics**

Document manual/chat group management, command syntax, eligible/excluded members, the 25-recipient cap, snapshot fingerprint refresh, uniform amount, sequential execution, item 10 failure followed by items 11–25, retained successes, duplicate-confirm prevention, and the explicit lack of retry/queue/auto-resume. Update `lastUpdated` to `2026-08-07`.

- [ ] **Step 4: Sync and validate the tutorial**

Run: `npm run docs:sync && npm run docs:validate`

Expected: generated tutorial matches all public docs and package version.

- [ ] **Step 5: Add final UI acceptance flows**

Playwright must prove group creation/membership, group-specific payroll count/total, preview expiry, stale fingerprint refresh, partial result summary, focus restoration, mobile layout, and Axe checks. Mock the 10th transfer failure and assert requests 11–25 are still observed by the test server.

- [ ] **Step 6: Run the complete verification matrix**

Run:

```bash
npm test
npm run docs:validate
npm run lint
npm run build
npx playwright test tests/ui/contacts.spec.ts tests/ui/command-center.spec.ts
```

When local Supabase is available, also run `supabase db lint` and the non-destructive database ownership/RPC checks. Expected: every available command exits 0, and any unavailable external environment is reported separately rather than treated as passed.

- [ ] **Step 7: Audit the original requirements against evidence**

Record evidence for: group CRUD from UI/chat, exact group payroll, item 10 failure continuation, no rollback/retry/queue/resume, one-time confirmation, bilingual synchronized docs, and all regression checks. Do not mark the goal complete if any evidence is missing.

- [ ] **Step 8: Commit docs and acceptance coverage**

```bash
git add content/public-docs content/payna-tutorial.json lib/paycmd/ai/payna-tutorial.test.ts tests/ui/contacts.spec.ts tests/ui/command-center.spec.ts
git commit -m "docs: document contact groups and partial payroll"
```
