import assert from "node:assert/strict";
import test from "node:test";

import {
  addContactGroupMember,
  ContactGroupError,
  createContactGroup,
  type Contact,
  type ContactGroup,
  type ContactGroupRepository,
  removeContactGroupMember,
} from "./contact-group-service.ts";

type Membership = { group_id: string; contact_id: string };

function createMemoryContactGroupRepository(seed: {
  groups: ContactGroup[];
  contacts: Contact[];
  memberships: Membership[];
}): ContactGroupRepository & { memberships: Membership[] } {
  const groups = [...seed.groups];
  const contacts = [...seed.contacts];
  const memberships = [...seed.memberships];

  return {
    memberships,
    async list(userId) {
      return groups
        .filter((group) => group.user_id === userId)
        .map((group) => ({
          ...group,
          members: memberships
            .filter((membership) => membership.group_id === group.id)
            .map((membership) => contacts.find((contact) => contact.id === membership.contact_id)!)
            .filter(Boolean),
        }));
    },
    async findGroup(userId, groupId) {
      return groups.find((group) => group.user_id === userId && group.id === groupId) ?? null;
    },
    async findContact(userId, contactId) {
      return contacts.find((contact) => contact.user_id === userId && contact.id === contactId) ?? null;
    },
    async insertGroup(row) {
      const group = { id: `group-${groups.length + 1}`, ...row };
      groups.push(group);
      return group;
    },
    async updateGroup(userId, groupId, patch) {
      const index = groups.findIndex((group) => group.user_id === userId && group.id === groupId);
      if (index < 0) return null;
      groups[index] = { ...groups[index], ...patch };
      return groups[index];
    },
    async deleteGroup(userId, groupId) {
      const index = groups.findIndex((group) => group.user_id === userId && group.id === groupId);
      if (index < 0) return false;
      groups.splice(index, 1);
      for (let memberIndex = memberships.length - 1; memberIndex >= 0; memberIndex -= 1) {
        if (memberships[memberIndex].group_id === groupId) memberships.splice(memberIndex, 1);
      }
      return true;
    },
    async addMember(groupId, contactId) {
      if (!memberships.some((membership) => membership.group_id === groupId && membership.contact_id === contactId)) {
        memberships.push({ group_id: groupId, contact_id: contactId });
      }
    },
    async removeMember(groupId, contactId) {
      const index = memberships.findIndex(
        (membership) => membership.group_id === groupId && membership.contact_id === contactId,
      );
      if (index >= 0) memberships.splice(index, 1);
    },
  };
}

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
  const otherUsersContact = {
    id: "c2",
    user_id: "u2",
    display_name: "Other",
    wallet_address: "0x2222222222222222222222222222222222222222",
  };
  const repository = createMemoryContactGroupRepository({
    groups: [ownedGroup],
    contacts: [otherUsersContact],
    memberships: [],
  });
  await assert.rejects(
    () => addContactGroupMember({ userId: "u1", groupId: ownedGroup.id, contactId: otherUsersContact.id }, repository),
    (error: ContactGroupError) => error.code === "CONTACT_NOT_FOUND",
  );
});

test("adds and removes membership idempotently", async () => {
  const ownedGroup = { id: "g1", user_id: "u1", name: "Core Team", normalized_name: "core team" };
  const ownedContact = {
    id: "c1",
    user_id: "u1",
    display_name: "Minh",
    wallet_address: "0x1111111111111111111111111111111111111111",
  };
  const input = { userId: "u1", groupId: ownedGroup.id, contactId: ownedContact.id };
  const repository = createMemoryContactGroupRepository({
    groups: [ownedGroup],
    contacts: [ownedContact],
    memberships: [],
  });
  await addContactGroupMember(input, repository);
  await addContactGroupMember(input, repository);
  assert.equal(repository.memberships.length, 1);
  await removeContactGroupMember(input, repository);
  await removeContactGroupMember(input, repository);
  assert.equal(repository.memberships.length, 0);
});
