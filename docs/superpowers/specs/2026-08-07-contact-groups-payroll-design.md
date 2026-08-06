# Contact Groups and Basic Payroll Design

**Date:** 2026-08-07
**Product version:** 1.0.0
**Status:** Approved

## Goal

Let a Payna user create contact groups, manage membership from chat or the Contacts UI, and run a basic payroll against one explicit group while preserving per-item results: if item 10 fails, items 11 through 25 still run, successful items are never rolled back, and no retry, queue, or auto-resume behavior is implied.

## Current-state findings

- Contacts are user-owned records with internal/external identity, preferred chain, and active status.
- The Contacts UI supports listing, adding, and deleting contacts but has no group model.
- `/payroll run team 25 from base` currently ignores `team` as a real membership boundary and selects the first 25 active contacts owned by the user.
- Payroll execution already uses a sequential loop with an item-level `try/catch`, so an ordinary transfer failure does not stop subsequent items.
- Payroll confirmation does not currently reject a second confirmation of a running/completed batch, and the preview does not enumerate an authoritative group snapshot.

## Scope

This design adds:

1. user-owned contact groups and group membership;
2. create, rename, delete, list, add-member, and remove-member operations;
3. manual group management in Contacts;
4. equivalent chatbot commands;
5. group-specific payroll preview and recipient snapshot;
6. sequential, continue-on-item-failure execution and item-level summary;
7. duplicate-confirm protection;
8. bilingual docs and tests.

It does not add CSV import, different amounts per member, recurring payroll, retry, queue workers, automatic resume, rollback, parallel transfers, or accounting/export integrations.

## Data model

Two tables are added by one migration:

```sql
contact_groups (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  description text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, normalized_name)
)

contact_group_members (
  group_id uuid not null references contact_groups(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  created_at timestamptz not null,
  primary key (group_id, contact_id)
)
```

`normalized_name` is trimmed, whitespace-collapsed, and lowercased for ownership-scoped uniqueness and chat lookup. Display casing remains in `name`.

RLS permits access only when `auth.uid()` owns the group. The membership `WITH CHECK` policy uses two `exists` clauses—one against the owned group and one against the owned contact—so another user's contact cannot be attached even if an API bug passes the wrong ID.

`payroll_batches` gains nullable `contact_group_id`, `recipient_count`, `per_recipient_amount`, `total_amount`, and `recipient_fingerprint`. Existing batches remain readable.

## Contact-group API

The API follows current Supabase ownership patterns:

- `GET /api/contact-groups` lists owned groups with member count and optionally expanded members.
- `POST /api/contact-groups` creates a group.
- `PATCH /api/contact-groups/[id]` renames or edits its description.
- `DELETE /api/contact-groups/[id]` deletes the group and memberships, never the contacts.
- `POST /api/contact-groups/[id]/members` adds one or more owned contacts idempotently.
- `DELETE /api/contact-groups/[id]/members/[contactId]` removes one membership idempotently.

Validation includes non-empty names, a bounded length, normalized uniqueness, owned group, owned contact, and explicit errors for missing records. API responses never expose contacts belonging to another user.

Deleting a contact automatically removes its memberships through the foreign key. Deleting a group does not delete or deactivate any contact.

## Chat commands

The command grammar adds:

```text
/contacts group create Core Team
/contacts group list
/contacts group add Core Team Minh
/contacts group remove Core Team Minh
/contacts group delete Core Team
/payroll run Core Team 25 from base
```

The parser produces explicit fields rather than overloading a batch label:

```ts
type ContactGroupAction = "create_group" | "list_groups" | "add_group_member" | "remove_group_member" | "delete_group";

type PayrollFields = {
  groupName: string;
  amount: string;
  sourceChain: string;
};
```

Group and contact names with spaces use the parser's recognized action boundaries. When a name is genuinely ambiguous, Payna asks the user to choose from owned matches instead of guessing. A contact must already exist before it can be added to a group; the response offers the existing add-contact flow when necessary.

Read-only list commands execute immediately. Create, delete, membership changes, and payroll keep the existing explicit preview/confirmation policy, including the shared 15-second preview lease from the companion design.

## Contacts UI

The Contacts page gains a Groups area without hiding the existing all-contacts directory.

Primary interactions:

- create a named group;
- select a group to filter/highlight its members;
- rename or delete a group;
- add members through searchable contact checkboxes;
- remove a member from the group without deleting the contact;
- open a contact and view/change its group memberships.

The common path is optimized for a small demo directory: a group list with counts and a member-management dialog. It does not introduce drag-and-drop, bulk CSV tooling, org charts, or nested groups.

Empty, loading, duplicate-name, stale membership, and API-error states have explicit bilingual copy. Destructive group deletion uses a confirmation dialog that states contacts will remain. Controls are keyboard accessible, dialogs restore focus, and membership is never conveyed by color alone.

## Payroll preview contract

`POST /api/payroll/preview` accepts `groupId`, `amount`, and `sourceChain`. The server resolves the owned group and returns:

```ts
type PayrollPreview = {
  group: { id: string; name: string };
  recipients: Array<{
    contactId: string;
    label: string;
    address: string;
    destinationChain: string;
  }>;
  excluded: Array<{ contactId: string; label: string; reason: "inactive" | "invalid_address" }>;
  perRecipientAmount: string;
  recipientCount: number;
  totalAmount: string;
  sourceChain: string;
  recipientFingerprint: string;
};
```

Recipients are active group members with valid EVM addresses, ordered deterministically by membership creation time and contact ID. The first release caps eligible recipients at 25 and clearly reports members beyond the cap as excluded. Total amount uses decimal-safe arithmetic, not floating-point multiplication.

The preview card shows group, eligible count, excluded count, per-recipient amount, aggregate exposure, source chain, and a collapsible recipient list with destination networks and shortened addresses. Confirm is disabled while the snapshot is loading, when no eligible member exists, or after the 15-second lease expires.

## Batch creation and snapshot consistency

`POST /api/payroll/batches` requires `groupId`, amount, source chain, and the preview's `recipientFingerprint`. The server rebuilds the recipient set. If membership, active state, address, or preferred chain changed, it returns `409 PAYROLL_PREVIEW_STALE`; the UI refreshes the preview and requires a new confirmation lease.

On success, the server creates one draft batch and immutable payroll-item snapshots in a transaction. Each item stores contact ID, display label, address, destination chain, amount, and token at confirmation time. Later contact edits do not change the running batch.

The batch stores the group reference for display, but deletion of the group sets that reference to null rather than deleting payroll history.

## Execution semantics

Confirmation accepts only a batch with status `draft`. A batch that is `running`, `success`, `partial_failed`, `failed`, or `cancelled` returns a conflict and never sends payments again.

Execution remains deliberately sequential:

```text
for each queued payroll item in snapshot order:
  mark item running
  attempt Gateway transfer
  on success: persist success + transaction reference
  on transfer failure: persist failed + safe error, then continue
after every item was attempted:
  compute batch status and summary
```

Therefore, if item 10 of 25 fails because its transfer cannot pay gas or another item-local preflight/transfer condition fails, items 11 through 25 are still attempted. Successful items are never rolled back. A failed item is not retried automatically.

Only failures that prevent the batch from being safely loaded or transitioned to `running` abort before item execution. Once iteration begins, item-local transfer failures are isolated. Unexpected persistence failure is surfaced as a batch-level operational error because the system cannot safely claim an unknown item result.

Final batch status is:

- `success`: every item succeeded;
- `failed`: every attempted item failed;
- `partial_failed`: at least one succeeded and at least one failed.

The API returns counts and item results. Notification and chat receipt say, for example, `23/25 succeeded · 2 failed`, and link to item details. They do not suggest that failed items are queued for later.

## Error and safety behavior

- Empty or unknown groups cannot produce a payroll preview.
- Duplicate group names return a localized conflict, not an accidental rename.
- Inactive/invalid members are excluded visibly before confirmation.
- A stale recipient fingerprint prevents confirmation against a changed group.
- A second confirm request cannot duplicate an already-started batch.
- Item errors are stored in sanitized user-facing form; provider internals and secrets are not persisted.
- A partial batch is never automatically rerun. The user must reconcile successful items before any manual follow-up.
- Payroll does not claim atomicity, rollback, retry, queueing, or auto-resume.

## Documentation contract

Implementation updates the English and Vietnamese versions of:

- `features/payments-and-contacts` for groups and manual membership;
- `features/payment-requests-and-payroll` for group snapshots and continue-on-failure semantics;
- `commands/payments` or the appropriate command catalog for new syntax;
- safety/troubleshooting guidance for partial batches and duplicate-payment prevention.

`npm run docs:sync` regenerates the Payna tutorial, and `npm run docs:validate` must pass before completion.

## Testing strategy

Database/API tests cover RLS ownership, normalized group uniqueness, cross-owner membership rejection, idempotent add/remove, contact/group delete cascades, group lookup, deterministic recipient order, the 25-member cap, decimal totals, fingerprint stability, stale-preview rejection, and duplicate-confirm rejection.

Parser tests cover English/Vietnamese names, multi-word group/contact names, missing fields, ambiguity, and every group command.

Executor tests use a real orchestration helper with a deterministic transfer dependency. They prove that a failure at item 10 still invokes items 11 through 25, success records are retained, no failed item is retried, final status/counts are correct, and a completed batch cannot run twice.

Component/UI tests cover group CRUD, membership management, focus restoration, empty/error states, payroll preview details, exclusions, countdown expiry, stale-preview refresh, and the final per-item summary.

Full verification includes migration checks, unit tests, docs validation, ESLint, production build, and targeted Playwright flows at desktop and 390-pixel mobile widths.

## Acceptance criteria

1. A user can create, rename, delete, and inspect owned groups in Contacts.
2. A user can add or remove existing contacts through either chat commands or the Contacts UI.
3. `/payroll run <group> <amount> from <chain>` previews only that group's eligible members, never all active contacts globally.
4. Preview count, recipient list, and aggregate exposure match the batch snapshot accepted by the server.
5. A changed group invalidates the old preview instead of silently paying a different recipient set.
6. If item 10 fails, items 11 through 25 still run; prior successes remain successful and no automatic retry occurs.
7. A batch can be confirmed only once.
8. Final UI and notification expose total, success, and failure counts plus item-level status.
9. Existing contacts and historical payroll batches remain readable after migration.
10. Bilingual docs, tutorial sync/validation, tests, lint, build, and targeted UI flows pass.

## Out of scope

- CSV or spreadsheet import.
- Nested groups or one group containing another group.
- Variable salary amounts within one batch.
- Retry, queue workers, automatic resume, rollback, or parallel execution.
- Recurring payroll schedules, tax/accounting integrations, or exports.
- Automatic creation of a contact from an unresolved chat name.
