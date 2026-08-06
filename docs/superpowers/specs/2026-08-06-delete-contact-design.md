# Delete Contact Design

## Goal

Allow an authenticated user to delete one of their contacts from the Contacts page after explicitly confirming the destructive action.

## Scope

- Add a delete control to every contact row on `/contacts`.
- Require confirmation before sending the delete request.
- Delete only a contact owned by the authenticated user.
- Update the visible list without a full-page reload and show success or error feedback.
- Keep the existing contact creation, lookup, and payment behavior unchanged.

## User Experience

Each contact row keeps its current status badge and adds a subtle trash icon button at the far right. The button has an accessible label that includes the contact name.

Selecting the button opens a confirmation dialog that identifies the contact by display name. The dialog provides:

- A neutral **Cancel** action that closes the dialog without changing data.
- A destructive **Delete contact** action that begins deletion.

While deletion is in progress, the destructive action is disabled to prevent duplicate requests. On success, the dialog closes, the deleted row disappears immediately, and a success toast is shown. When the final contact is deleted, the existing empty state appears. On failure, the contact remains visible, the dialog stays available, and an error toast explains that deletion did not complete.

All new user-facing labels and messages are provided in both Vietnamese and English through the existing i18n dictionaries.

## Architecture

### Contacts page

The server-rendered Contacts page continues to authenticate the user and fetch the initial contact list. It passes the serializable contact data into a focused client component responsible for rendering rows and managing deletion state.

The client component owns:

- The current visible contact list.
- The contact selected for deletion.
- The pending request state.
- Opening and closing the confirmation dialog.
- Calling the delete endpoint and presenting toast feedback.

The component uses the repository's existing button, dialog, badge, and toast conventions so the new control matches the application.

### Delete endpoint

Add `DELETE /api/contacts/[id]`. The handler:

1. Creates the authenticated Supabase client and rejects unauthenticated requests with `401`.
2. Validates that the route parameter is present.
3. Deletes from `contacts` only where both `id` equals the requested id and `user_id` equals the authenticated user's id.
4. Returns `404` when no owned contact matches.
5. Returns a structured error response for database failures.
6. Returns a success response containing the deleted contact id.

The ownership filter is enforced in the query even when database row-level security is active, making the authorization rule explicit at the API boundary.

## Error Handling

- `401 Unauthorized`: the UI reports the failure and keeps the row unchanged.
- `404 Not Found`: the UI reports that the contact could not be deleted and keeps the local row so a refresh remains the source of truth.
- Database or network failure: the dialog remains usable, pending state is cleared, and the user can retry.
- Repeated clicks: prevented by disabling the confirm action while the request is pending.

## Testing

Implementation follows test-driven development.

- API tests cover unauthenticated access, ownership-scoped deletion, successful deletion, missing contacts, and database errors.
- UI tests cover opening the correct confirmation dialog, cancelling without a request, disabling during deletion, removing only the deleted row after success, showing the empty state after the final deletion, and preserving the row when deletion fails.
- Existing lint, type/build checks, and relevant test suites run before completion.

## Non-goals

- Undo or restoration after deletion.
- Soft deletion or contact archival.
- Bulk deletion.
- Deleting contacts through chat commands.
- Refactoring unrelated contact creation or payment flows.
