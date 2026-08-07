export type GroupResolution =
  | { status: "resolved"; groupId: string; contactId?: string }
  | { status: "ambiguous"; groupMatches: string[]; contactMatches: string[] }
  | { status: "missing"; missing: "group" | "contact" };

type NamedGroup = { id: string; name: string };
type NamedContact = { id: string; display_name: string };

function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("und");
}

export function resolveGroupMemberExpression(
  expression: string,
  groups: NamedGroup[],
  contacts: NamedContact[],
): GroupResolution {
  const words = expression.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { status: "missing", missing: "group" };

  const matches: Array<{ group: NamedGroup; contact: NamedContact }> = [];
  for (let index = 1; index < words.length; index += 1) {
    const groupName = normalized(words.slice(0, index).join(" "));
    const contactName = normalized(words.slice(index).join(" "));
    for (const group of groups.filter((candidate) => normalized(candidate.name) === groupName)) {
      for (const contact of contacts.filter((candidate) => normalized(candidate.display_name) === contactName)) {
        matches.push({ group, contact });
      }
    }
  }

  if (matches.length === 1) {
    return { status: "resolved", groupId: matches[0].group.id, contactId: matches[0].contact.id };
  }

  const groupMatches = groups
    .filter((group) => normalized(expression).includes(normalized(group.name)))
    .map((group) => group.name);
  const contactMatches = contacts
    .filter((contact) => normalized(expression).includes(normalized(contact.display_name)))
    .map((contact) => contact.display_name);
  if (matches.length > 1 || groupMatches.length > 1 || contactMatches.length > 1) {
    return { status: "ambiguous", groupMatches, contactMatches };
  }
  return { status: "missing", missing: groupMatches.length ? "contact" : "group" };
}
