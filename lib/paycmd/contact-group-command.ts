import type { ParsedCommand } from "./commands.ts";
import { resolveGroupMemberExpression } from "./group-resolution.ts";

type RequestJson = (path: string, init?: RequestInit) => Promise<any>;

function exactGroupId(groups: Array<{ id: string; name: string }>, name: string) {
  const normalized = name.trim().replace(/\s+/g, " ").toLocaleLowerCase("und");
  const matches = groups.filter((group) => group.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("und") === normalized);
  if (matches.length !== 1) throw new Error(matches.length ? "GROUP_COMMAND_AMBIGUOUS" : "GROUP_NOT_FOUND");
  return matches[0].id;
}

export async function executeContactGroupCommand(draft: ParsedCommand, requestJson: RequestJson) {
  const action = draft.fields.action;
  if (action === "list_groups") return requestJson("/api/contact-groups");
  if (action === "create_group") {
    return requestJson("/api/contact-groups", {
      method: "POST",
      body: JSON.stringify({ name: draft.fields.groupName }),
    });
  }

  const groupsResponse = await requestJson("/api/contact-groups");
  const groups = Array.isArray(groupsResponse?.groups) ? groupsResponse.groups : [];
  if (action === "delete_group") {
    const groupId = exactGroupId(groups, draft.fields.groupName);
    return requestJson(`/api/contact-groups/${encodeURIComponent(groupId)}`, { method: "DELETE" });
  }

  if (action === "add_group_member" || action === "remove_group_member") {
    const contactsResponse = await requestJson("/api/contacts");
    const resolution = resolveGroupMemberExpression(
      draft.fields.memberExpression,
      groups,
      Array.isArray(contactsResponse?.contacts) ? contactsResponse.contacts : [],
    );
    if (resolution.status === "ambiguous") throw new Error("GROUP_COMMAND_AMBIGUOUS");
    if (resolution.status === "missing") {
      throw new Error(`GROUP_COMMAND_${resolution.missing.toUpperCase()}_MISSING`);
    }
    if (!resolution.contactId) throw new Error("GROUP_COMMAND_CONTACT_MISSING");
    if (action === "add_group_member") {
      return requestJson(`/api/contact-groups/${encodeURIComponent(resolution.groupId)}/members`, {
        method: "POST",
        body: JSON.stringify({ contactIds: [resolution.contactId] }),
      });
    }
    return requestJson(
      `/api/contact-groups/${encodeURIComponent(resolution.groupId)}/members/${encodeURIComponent(resolution.contactId)}`,
      { method: "DELETE" },
    );
  }

  throw new Error("GROUP_COMMAND_UNSUPPORTED");
}
