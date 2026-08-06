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
