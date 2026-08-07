export const CONTACT_GROUP_NAME_MAX = 80;

export function normalizeContactGroupName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("und");
}

export function validateContactGroupName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false as const, code: "GROUP_NAME_REQUIRED" as const };
  if (name.length > CONTACT_GROUP_NAME_MAX) {
    return { ok: false as const, code: "GROUP_NAME_TOO_LONG" as const };
  }

  return { ok: true as const, name, normalizedName: normalizeContactGroupName(name) };
}
