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
