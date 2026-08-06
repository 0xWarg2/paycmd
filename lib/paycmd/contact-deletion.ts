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

type ContactDeletionSingleResult = {
  data: { id: string } | null;
  error: { message: string } | null;
};

type ContactDeletionSingleQuery = {
  maybeSingle: () => PromiseLike<ContactDeletionSingleResult>;
};

type ContactDeletionFilterQuery = {
  eq: (column: string, value: string) => ContactDeletionFilterQuery;
  select: (columns: string) => ContactDeletionSingleQuery;
};

export type ContactDeletionQuery = {
  delete: () => ContactDeletionFilterQuery;
};

export async function deleteOwnedContactWithSupabase(
  query: ContactDeletionQuery,
  contactId: string,
  userId: string,
): Promise<ContactDeletionStoreResult> {
  const { data, error } = await query
    .delete()
    .eq("id", contactId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return { kind: "error", message: error.message };
  if (!data) return { kind: "not_found" };
  return { kind: "deleted", id: data.id };
}

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
