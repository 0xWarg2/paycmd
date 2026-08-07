import { validateContactGroupName } from "./contact-groups.ts";

export type ContactGroup = {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  created_at?: string;
  updated_at?: string;
};

export type Contact = {
  id: string;
  user_id: string;
  display_name: string;
  wallet_address: string;
  preferred_chain?: string;
  status?: string;
};

export type ContactGroupWithMembers = ContactGroup & { members: Contact[] };
export type NewContactGroup = Pick<ContactGroup, "user_id" | "name" | "normalized_name">;
export type ContactGroupPatch = Pick<ContactGroup, "name" | "normalized_name">;

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

export type ContactGroupErrorCode =
  | "GROUP_NAME_REQUIRED"
  | "GROUP_NAME_TOO_LONG"
  | "GROUP_NAME_EXISTS"
  | "GROUP_NOT_FOUND"
  | "CONTACT_NOT_FOUND"
  | "GROUP_OPERATION_FAILED";

export class ContactGroupError extends Error {
  readonly code: ContactGroupErrorCode;

  constructor(code: ContactGroupErrorCode) {
    super(code);
    this.name = "ContactGroupError";
    this.code = code;
  }
}

function groupNameError(code: "GROUP_NAME_REQUIRED" | "GROUP_NAME_TOO_LONG") {
  return new ContactGroupError(code);
}

function validatedGroupName(name: string) {
  const result = validateContactGroupName(name);
  if (!result.ok) throw groupNameError(result.code);
  return result;
}

async function requireOwnedGroup(userId: string, groupId: string, repository: ContactGroupRepository) {
  const group = await repository.findGroup(userId, groupId);
  if (!group) throw new ContactGroupError("GROUP_NOT_FOUND");
  return group;
}

export async function listContactGroups(userId: string, repository: ContactGroupRepository) {
  return repository.list(userId);
}

export async function createContactGroup(
  input: { userId: string; name: string },
  repository: ContactGroupRepository,
) {
  const name = validatedGroupName(input.name);
  const groups = await repository.list(input.userId);
  if (groups.some((group) => group.normalized_name === name.normalizedName)) {
    throw new ContactGroupError("GROUP_NAME_EXISTS");
  }
  return repository.insertGroup({
    user_id: input.userId,
    name: name.name,
    normalized_name: name.normalizedName,
  });
}

export async function updateContactGroup(
  input: { userId: string; groupId: string; name: string },
  repository: ContactGroupRepository,
) {
  await requireOwnedGroup(input.userId, input.groupId, repository);
  const name = validatedGroupName(input.name);
  const groups = await repository.list(input.userId);
  if (groups.some((group) => group.id !== input.groupId && group.normalized_name === name.normalizedName)) {
    throw new ContactGroupError("GROUP_NAME_EXISTS");
  }
  const group = await repository.updateGroup(input.userId, input.groupId, {
    name: name.name,
    normalized_name: name.normalizedName,
  });
  if (!group) throw new ContactGroupError("GROUP_NOT_FOUND");
  return group;
}

export async function deleteContactGroup(
  input: { userId: string; groupId: string },
  repository: ContactGroupRepository,
) {
  await requireOwnedGroup(input.userId, input.groupId, repository);
  const deleted = await repository.deleteGroup(input.userId, input.groupId);
  if (!deleted) throw new ContactGroupError("GROUP_NOT_FOUND");
}

export async function addContactGroupMember(
  input: { userId: string; groupId: string; contactId: string },
  repository: ContactGroupRepository,
) {
  await requireOwnedGroup(input.userId, input.groupId, repository);
  const contact = await repository.findContact(input.userId, input.contactId);
  if (!contact) throw new ContactGroupError("CONTACT_NOT_FOUND");
  await repository.addMember(input.groupId, input.contactId);
}

export async function removeContactGroupMember(
  input: { userId: string; groupId: string; contactId: string },
  repository: ContactGroupRepository,
) {
  await requireOwnedGroup(input.userId, input.groupId, repository);
  await repository.removeMember(input.groupId, input.contactId);
}

function throwDatabaseError(error: { code?: string } | null | undefined): never {
  if (error?.code === "23505") throw new ContactGroupError("GROUP_NAME_EXISTS");
  throw new ContactGroupError("GROUP_OPERATION_FAILED");
}

export function createSupabaseContactGroupRepository(supabase: any): ContactGroupRepository {
  return {
    async list(userId) {
      const { data, error } = await supabase
        .from("contact_groups")
        .select("*, contact_group_members(contact_id, contacts(id, user_id, display_name, wallet_address, preferred_chain, status))")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throwDatabaseError(error);
      return (data ?? []).map((group: any) => ({
        ...group,
        members: (group.contact_group_members ?? [])
          .map((member: any) => member.contacts)
          .filter(Boolean),
      }));
    },
    async findGroup(userId, groupId) {
      const { data, error } = await supabase
        .from("contact_groups")
        .select("*")
        .eq("user_id", userId)
        .eq("id", groupId)
        .maybeSingle();
      if (error) throwDatabaseError(error);
      return data ?? null;
    },
    async findContact(userId, contactId) {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, user_id, display_name, wallet_address, preferred_chain, status")
        .eq("user_id", userId)
        .eq("id", contactId)
        .maybeSingle();
      if (error) throwDatabaseError(error);
      return data ?? null;
    },
    async insertGroup(row) {
      const { data, error } = await supabase.from("contact_groups").insert(row).select("*").single();
      if (error) throwDatabaseError(error);
      return data;
    },
    async updateGroup(userId, groupId, patch) {
      const { data, error } = await supabase
        .from("contact_groups")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("id", groupId)
        .select("*")
        .maybeSingle();
      if (error) throwDatabaseError(error);
      return data ?? null;
    },
    async deleteGroup(userId, groupId) {
      const { error, count } = await supabase
        .from("contact_groups")
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .eq("id", groupId);
      if (error) throwDatabaseError(error);
      return (count ?? 0) > 0;
    },
    async addMember(groupId, contactId) {
      const { error } = await supabase
        .from("contact_group_members")
        .upsert({ group_id: groupId, contact_id: contactId }, { onConflict: "group_id,contact_id", ignoreDuplicates: true });
      if (error) throwDatabaseError(error);
    },
    async removeMember(groupId, contactId) {
      const { error } = await supabase
        .from("contact_group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("contact_id", contactId);
      if (error) throwDatabaseError(error);
    },
  };
}
