# Delete Contact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a confirmed, ownership-scoped delete action to every row on the Contacts page.

**Architecture:** Keep `/contacts` server-rendered for authentication and initial data loading, then hand the contact array to a focused client component for confirmation-dialog and request state. A dynamic API route delegates authentication and deletion outcome mapping to a small testable use case, while the Supabase adapter explicitly filters by both contact id and authenticated user id.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Radix Dialog, Sonner, Node test runner, Playwright.

## Global Constraints

- Confirmation is required before any delete request is sent.
- Deletion is permanent; undo, archival, bulk deletion, and chat deletion are out of scope.
- Every database delete must match both `contacts.id` and the authenticated `user_id`.
- The visible row is removed only after the server confirms success.
- New user-facing copy must exist in Vietnamese and English.
- Existing contact creation, lookup, and payment behavior must remain unchanged.

## File Structure

- `lib/paycmd/contact-deletion.ts`: framework-independent delete use case and result mapping.
- `lib/paycmd/contact-deletion.test.ts`: authorization and delete-outcome tests using a stateful in-memory contact store.
- `app/api/contacts/[id]/route.ts`: Next.js/Supabase adapter for `DELETE /api/contacts/:id`.
- `components/contacts-list.tsx`: contact rows, confirmation dialog, request state, and toast feedback.
- `app/contacts/page.tsx`: server-side fetch that passes initial contacts into `ContactsList`.
- `lib/i18n.tsx`: Vietnamese and English contact-deletion UI strings.
- `app/dev/contacts-preview/page.tsx`: non-production fixture page for authenticated-UI-independent Playwright coverage.
- `tests/ui/contacts.spec.ts`: browser tests for confirm, cancel, success, empty state, and failure.

---

### Task 1: Ownership-scoped delete API

**Files:**
- Create: `lib/paycmd/contact-deletion.ts`
- Create: `lib/paycmd/contact-deletion.test.ts`
- Create: `app/api/contacts/[id]/route.ts`

**Interfaces:**
- Produces: `handleContactDeletion(contactId: string, dependencies: ContactDeletionDependencies): Promise<ContactDeletionHttpResult>`.
- `ContactDeletionDependencies.getAuthenticatedUserId()` returns the current user id or `null`.
- `ContactDeletionDependencies.deleteOwnedContact(contactId, userId)` returns `{ kind: "deleted"; id }`, `{ kind: "not_found" }`, or `{ kind: "error"; message }`.
- The dynamic route returns `{ deleted: true, id }` on `200`, `{ error: "Contact id is required" }` on `400`, `{ error: "Unauthorized" }` on `401`, `{ error: "Contact not found" }` on `404`, or the database message on `500`.

- [ ] **Step 1: Write failing use-case tests**

Create `lib/paycmd/contact-deletion.test.ts` with a stateful in-memory store so tests assert actual remaining records rather than assertions on a mock function:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { handleContactDeletion } from "./contact-deletion.ts";

type StoredContact = { id: string; userId: string };

function createDependencies(userId: string | null, seed: StoredContact[]) {
  const contacts = [...seed];

  return {
    contacts,
    dependencies: {
      getAuthenticatedUserId: async () => userId,
      deleteOwnedContact: async (contactId: string, ownerId: string) => {
        const index = contacts.findIndex(
          (contact) => contact.id === contactId && contact.userId === ownerId,
        );
        if (index === -1) return { kind: "not_found" as const };
        const [deleted] = contacts.splice(index, 1);
        return { kind: "deleted" as const, id: deleted.id };
      },
    },
  };
}

test("rejects contact deletion when there is no authenticated user", async () => {
  const fixture = createDependencies(null, [{ id: "contact-1", userId: "user-a" }]);
  const result = await handleContactDeletion("contact-1", fixture.dependencies);
  assert.deepEqual(result, { status: 401, body: { error: "Unauthorized" } });
  assert.equal(fixture.contacts.length, 1);
});

test("rejects an empty contact id before accessing the store", async () => {
  const fixture = createDependencies("user-a", [{ id: "contact-1", userId: "user-a" }]);
  const result = await handleContactDeletion("  ", fixture.dependencies);
  assert.deepEqual(result, { status: 400, body: { error: "Contact id is required" } });
  assert.equal(fixture.contacts.length, 1);
});

test("deletes only the authenticated user's matching contact", async () => {
  const fixture = createDependencies("user-a", [
    { id: "contact-1", userId: "user-a" },
    { id: "contact-1", userId: "user-b" },
  ]);
  const result = await handleContactDeletion("contact-1", fixture.dependencies);
  assert.deepEqual(result, { status: 200, body: { deleted: true, id: "contact-1" } });
  assert.deepEqual(fixture.contacts, [{ id: "contact-1", userId: "user-b" }]);
});

test("returns not found without deleting another user's contact", async () => {
  const fixture = createDependencies("user-a", [{ id: "contact-2", userId: "user-b" }]);
  const result = await handleContactDeletion("contact-2", fixture.dependencies);
  assert.deepEqual(result, { status: 404, body: { error: "Contact not found" } });
  assert.equal(fixture.contacts.length, 1);
});

test("maps a contact-store failure to a server error", async () => {
  const result = await handleContactDeletion("contact-1", {
    getAuthenticatedUserId: async () => "user-a",
    deleteOwnedContact: async () => ({ kind: "error", message: "database unavailable" }),
  });
  assert.deepEqual(result, { status: 500, body: { error: "database unavailable" } });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test lib/paycmd/contact-deletion.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `contact-deletion.ts`.

- [ ] **Step 3: Implement the minimal delete use case**

Create `lib/paycmd/contact-deletion.ts`:

```ts
export type ContactDeletionStoreResult =
  | { kind: "deleted"; id: string }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

export type ContactDeletionDependencies = {
  getAuthenticatedUserId: () => Promise<string | null>;
  deleteOwnedContact: (
    contactId: string,
    userId: string,
  ) => Promise<ContactDeletionStoreResult>;
};

export type ContactDeletionHttpResult = {
  status: 200 | 400 | 401 | 404 | 500;
  body: { deleted: true; id: string } | { error: string };
};

export async function handleContactDeletion(
  contactId: string,
  dependencies: ContactDeletionDependencies,
): Promise<ContactDeletionHttpResult> {
  if (!contactId.trim()) {
    return { status: 400, body: { error: "Contact id is required" } };
  }

  const userId = await dependencies.getAuthenticatedUserId();
  if (!userId) return { status: 401, body: { error: "Unauthorized" } };

  const result = await dependencies.deleteOwnedContact(contactId, userId);
  if (result.kind === "not_found") {
    return { status: 404, body: { error: "Contact not found" } };
  }
  if (result.kind === "error") {
    return { status: 500, body: { error: result.message } };
  }
  return { status: 200, body: { deleted: true, id: result.id } };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `node --test lib/paycmd/contact-deletion.test.ts`.

Expected: 5 tests pass with no warnings.

- [ ] **Step 5: Add the Next.js/Supabase adapter**

Create `app/api/contacts/[id]/route.ts`. Resolve `params`, create the server Supabase client, and call `handleContactDeletion`. The `deleteOwnedContact` dependency must perform this exact ownership-scoped query:

```ts
import { NextResponse } from "next/server";

import { handleContactDeletion } from "@/lib/paycmd/contact-deletion";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const result = await handleContactDeletion(id, {
    getAuthenticatedUserId: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    deleteOwnedContact: async (requestedContactId, userId) => {
      const { data, error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", requestedContactId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      if (error) return { kind: "error" as const, message: error.message };
      if (!data) return { kind: "not_found" as const };
      return { kind: "deleted" as const, id: data.id };
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
```

- [ ] **Step 6: Run API tests and static checks**

Run:

```bash
node --test lib/paycmd/contact-deletion.test.ts
npx tsc --noEmit
```

Expected: both commands exit `0`.

- [ ] **Step 7: Commit the API slice**

```bash
git add lib/paycmd/contact-deletion.ts lib/paycmd/contact-deletion.test.ts 'app/api/contacts/[id]/route.ts'
git commit -m "feat(contacts): add ownership-scoped delete API"
```

---

### Task 2: Confirmed delete interaction

**Files:**
- Create: `components/contacts-list.tsx`
- Modify: `app/contacts/page.tsx:1-55`
- Modify: `lib/i18n.tsx` in both `vi` and `en` dictionaries.
- Create: `app/dev/contacts-preview/page.tsx`
- Create: `tests/ui/contacts.spec.ts`

**Interfaces:**
- Consumes: `DELETE /api/contacts/:id` from Task 1.
- Produces: `ContactsList({ initialContacts }: { initialContacts: ContactListItem[] })`.
- `ContactListItem` contains `id`, `display_name`, `role`, `preferred_chain`, `wallet_address`, and `status`; nullable display fields are represented as `string | null`.
- The development preview supplies two deterministic contacts and is available only when `PAYNA_UI_FIXTURE=1` outside production.

- [ ] **Step 1: Add failing browser tests for cancel and confirmed success**

Create `tests/ui/contacts.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("requires confirmation before deleting the selected contact", async ({ page }) => {
  let deleteRequests = 0;
  await page.route("**/api/contacts/contact-minh", async (route) => {
    deleteRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true, id: "contact-minh" }) });
  });
  await page.goto("/dev/contacts-preview");

  await page.getByRole("button", { name: "Xoá contact Minh" }).click();
  await expect(page.getByRole("dialog")).toContainText("Minh");
  await page.getByRole("button", { name: "Hủy" }).click();
  expect(deleteRequests).toBe(0);
  await expect(page.getByText("Minh", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Xoá contact Minh" }).click();
  await page.getByRole("button", { name: "Xoá contact", exact: true }).click();
  await expect(page.getByText("Minh", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Đã xoá contact Minh.")).toBeVisible();
  expect(deleteRequests).toBe(1);
});

test("shows the empty state after deleting the final contact", async ({ page }) => {
  await page.route("**/api/contacts/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true, id: "contact-minh" }) }),
  );
  await page.goto("/dev/contacts-preview?single=1");
  await page.getByRole("button", { name: "Xoá contact Minh" }).click();
  await page.getByRole("button", { name: "Xoá contact", exact: true }).click();
  await expect(page.getByText(/Chưa có contact\./)).toBeVisible();
});
```

- [ ] **Step 2: Add failing browser tests for pending and failure behavior**

Append these tests, using a deferred response to observe the real pending UI state:

```ts
test("disables the destructive action while deletion is pending", async ({ page }) => {
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/contacts/contact-minh", async (route) => {
    await responseGate;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true, id: "contact-minh" }) });
  });
  await page.goto("/dev/contacts-preview");
  await page.getByRole("button", { name: "Xoá contact Minh" }).click();
  await page.getByRole("button", { name: "Xoá contact", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đang xoá..." })).toBeDisabled();
  releaseResponse();
  await expect(page.getByText("Minh", { exact: true })).toHaveCount(0);
});

test("keeps the contact and dialog available when deletion fails", async ({ page }) => {
  await page.route("**/api/contacts/contact-minh", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "database unavailable" }) }),
  );
  await page.goto("/dev/contacts-preview");
  await page.getByRole("button", { name: "Xoá contact Minh" }).click();
  await page.getByRole("button", { name: "Xoá contact", exact: true }).click();
  await expect(page.getByText("Minh", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Không thể xoá contact. Vui lòng thử lại.")).toBeVisible();
});
```

- [ ] **Step 3: Run the new browser test and verify RED**

Run:

```bash
npx playwright test tests/ui/contacts.spec.ts --project=desktop-1440
```

Expected: FAIL because `/dev/contacts-preview` and the delete controls do not exist.

- [ ] **Step 4: Add bilingual copy**

Add the following keys to both dictionaries in `lib/i18n.tsx`:

```ts
// Vietnamese
"contacts.deleteLabel": "Xoá contact {name}",
"contacts.deleteTitle": "Xoá contact?",
"contacts.deleteDescription": "Bạn có chắc muốn xoá {name} khỏi danh bạ? Hành động này không thể hoàn tác.",
"contacts.deleteAction": "Xoá contact",
"contacts.deletePending": "Đang xoá...",
"contacts.deleteSuccess": "Đã xoá contact {name}.",
"contacts.deleteError": "Không thể xoá contact. Vui lòng thử lại.",
"pages.contacts.empty": "Chưa có contact. Thử /contacts add Minh 0x... on arc trong chat.",

// English
"contacts.deleteLabel": "Delete contact {name}",
"contacts.deleteTitle": "Delete contact?",
"contacts.deleteDescription": "Are you sure you want to remove {name} from your contacts? This action cannot be undone.",
"contacts.deleteAction": "Delete contact",
"contacts.deletePending": "Deleting...",
"contacts.deleteSuccess": "Deleted contact {name}.",
"contacts.deleteError": "Could not delete contact. Please try again.",
"pages.contacts.empty": "No contacts yet. Try /contacts add Minh 0x... on arc in chat.",
```

- [ ] **Step 5: Implement `ContactsList` minimally**

Create a client component that:

1. Initializes local `contacts` from `initialContacts`.
2. Tracks `selectedContact` and `deleting`.
3. Renders the existing icon, name, role/chain, address, and status badge.
4. Adds an outline icon button with `Trash2`, `aria-label={t("contacts.deleteLabel", { name })}`, and `aria-haspopup="dialog"`.
5. Uses one controlled Radix `Dialog` after the list so only one confirmation dialog exists.
6. Prevents dialog dismissal and disables both actions while `deleting` is true.
7. Calls `fetch(`/api/contacts/${encodeURIComponent(selectedContact.id)}`, { method: "DELETE" })`.
8. Parses an error response defensively, throws when `response.ok` is false, and removes only the selected id after success.
9. Shows `toast.success` or `toast.error` with the localized copy; on error, leave the selected contact and dialog open so the user can retry.
10. Renders `t("pages.contacts.empty")` when local state becomes empty.

Use `Button` with `variant="destructive"` for the confirm action and `variant="outline"` for cancel. Give the trash button `variant="ghost"`, `size="icon"`, and danger-colored hover/focus styling without making every row visually alarming.

Use this component shape so the behavior under Playwright is the same code shipped on `/contacts`:

```tsx
"use client";

import { Contact, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

export type ContactListItem = {
  id: string;
  display_name: string;
  role: string | null;
  preferred_chain: string | null;
  wallet_address: string;
  status: string;
};

export function ContactsList({ initialContacts }: { initialContacts: ContactListItem[] }) {
  const { t } = useI18n();
  const [contacts, setContacts] = useState(initialContacts);
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function deleteSelectedContact() {
    if (!selectedContact || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/contacts/${encodeURIComponent(selectedContact.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Contact deletion failed");
      const deletedName = selectedContact.display_name;
      const deletedId = selectedContact.id;
      setContacts((current) => current.filter((contact) => contact.id !== deletedId));
      setSelectedContact(null);
      toast.success(t("contacts.deleteSuccess", { name: deletedName }));
    } catch {
      toast.error(t("contacts.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="command-panel divide-y divide-border/60 overflow-hidden rounded-2xl">
        {contacts.map((contact) => (
          <article key={contact.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Contact className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">{contact.display_name}</div>
                <div className="text-sm text-muted-foreground">{contact.role ?? contact.preferred_chain}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{contact.wallet_address}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={contact.status === "active" ? "default" : "secondary"}>{contact.status}</Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:text-destructive"
                aria-label={t("contacts.deleteLabel", { name: contact.display_name })}
                aria-haspopup="dialog"
                onClick={() => setSelectedContact(contact)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </article>
        ))}
        {contacts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("pages.contacts.empty")}</div>
        ) : null}
      </div>

      <Dialog
        open={selectedContact !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setSelectedContact(null);
        }}
      >
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>{t("contacts.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("contacts.deleteDescription", { name: selectedContact?.display_name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setSelectedContact(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={deleteSelectedContact}>
              {deleting ? t("contacts.deletePending") : t("contacts.deleteAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 6: Wire the production and fixture pages**

Replace the inline list in `app/contacts/page.tsx` with:

```tsx
<ContactsList initialContacts={contacts ?? []} />
```

Keep authentication and the existing Supabase query on the server page.

Create `app/dev/contacts-preview/page.tsx`, guard it with the same production/`PAYNA_UI_FIXTURE` check as `/dev/ui-preview`, read the optional `single=1` search parameter, and render `ContactsList` with `Minh` plus a second contact unless single mode is active.

```tsx
import { notFound } from "next/navigation";

import { ContactsList, type ContactListItem } from "@/components/contacts-list";

const fixtureContacts: ContactListItem[] = [
  {
    id: "contact-minh",
    display_name: "Minh",
    role: "Contributor",
    preferred_chain: "arcTestnet",
    wallet_address: "0x1111111111111111111111111111111111111111",
    status: "active",
  },
  {
    id: "contact-lan",
    display_name: "Lan",
    role: null,
    preferred_chain: "baseSepolia",
    wallet_address: "0x2222222222222222222222222222222222222222",
    status: "active",
  },
];

export default async function ContactsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ single?: string }>;
}) {
  if (process.env.NODE_ENV === "production" || process.env.PAYNA_UI_FIXTURE !== "1") {
    notFound();
  }
  const { single } = await searchParams;

  return (
    <main className="command-center-canvas min-h-dvh p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-semibold">Contacts fixture</h1>
        <ContactsList initialContacts={single === "1" ? fixtureContacts.slice(0, 1) : fixtureContacts} />
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Run the focused browser test and verify GREEN**

Run:

```bash
npx playwright test tests/ui/contacts.spec.ts --project=desktop-1440
```

Expected: all contact interaction tests pass.

- [ ] **Step 8: Run mobile accessibility coverage**

Add this Axe and overflow test for `/dev/contacts-preview` after opening the dialog:

```ts
import AxeBuilder from "@axe-core/playwright";

test("keeps the contact confirmation accessible without horizontal overflow", async ({ page }) => {
  await page.goto("/dev/contacts-preview");
  await page.getByRole("button", { name: "Xoá contact Minh" }).click();

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
```

Then run:

```bash
npx playwright test tests/ui/contacts.spec.ts --project=mobile-360 --project=desktop-1440
```

Expected: interaction and accessibility tests pass in both projects with no horizontal overflow.

- [ ] **Step 9: Commit the UI slice**

```bash
git add components/contacts-list.tsx app/contacts/page.tsx lib/i18n.tsx app/dev/contacts-preview/page.tsx tests/ui/contacts.spec.ts
git commit -m "feat(contacts): add confirmed delete action"
```

---

### Task 3: Full verification

**Files:**
- Verify only; modify implementation files only if a verification command exposes a defect.

**Interfaces:**
- Consumes the API and UI delivered by Tasks 1 and 2.
- Produces a verified feature with clean repository checks.

- [ ] **Step 1: Run the complete unit suite**

```bash
npm test
```

Expected: every Node test passes, including `contact-deletion.test.ts`.

- [ ] **Step 2: Run lint and TypeScript checks**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both commands exit `0` with no new warnings or errors.

- [ ] **Step 3: Run focused cross-viewport UI tests**

```bash
npx playwright test tests/ui/contacts.spec.ts --project=mobile-360 --project=desktop-1440
```

Expected: all tests pass.

- [ ] **Step 4: Run a production build**

```bash
npm run build
```

Expected: Next.js completes the optimized production build and recognizes `/api/contacts/[id]`.

- [ ] **Step 5: Inspect the final diff**

```bash
git status --short
git diff --check HEAD~2..HEAD
git diff --stat HEAD~2..HEAD
```

Expected: no whitespace errors; only contact deletion implementation, tests, i18n, and approved documentation are present. Existing untracked `output/` and `tmp/` remain untouched.

- [ ] **Step 6: Commit verification-only fixes if needed**

If verification required an implementation correction, stage only the affected contact-deletion files and commit it with:

```bash
git commit -m "fix(contacts): resolve delete verification findings"
```

If every check passed without edits, do not create an empty commit.
