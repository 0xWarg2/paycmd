import type { PayCmdLocale } from "@/lib/i18n/server";

type ContactGroupIntent = {
  canonicalCommand: string;
  assistantText: string;
};

function cleanName(value: string) {
  return value
    .replace(/[.?!]+$/g, "")
    .replace(/\s+(?:đi|di|nhé|nhe|nha|giúp tôi|giup toi|please)$/i, "")
    .trim()
    .slice(0, 80);
}

function copy(locale: PayCmdLocale, key: "create" | "list" | "delete" | "member") {
  const vi = {
    create: "Tạo nhóm contact.",
    list: "Xem các nhóm contact.",
    delete: "Nhóm sẽ bị xoá, nhưng contacts vẫn được giữ lại.",
    member: "Cập nhật thành viên nhóm contact.",
  };
  const en = {
    create: "Create the contact group.",
    list: "List contact groups.",
    delete: "The group will be deleted, but its contacts will remain.",
    member: "Update the contact group membership.",
  };
  return (locale === "en" ? en : vi)[key];
}

/** Converts unambiguous group-management imperatives into the existing slash grammar. */
export function contactGroupIntentFromNaturalLanguage(input: string, locale: PayCmdLocale): ContactGroupIntent | null {
  const value = input.trim();
  if (!value || value.startsWith("/")) return null;

  if (/^(?:list|show|view|xem|liệt\s*kê|liet\s*ke)(?:\s+(?:contact\s*)?(?:groups?|nhóm|nhom))?\s*$/i.test(value)) {
    return { canonicalCommand: "/contacts group list", assistantText: copy(locale, "list") };
  }

  const create = value.match(/^(?:create|make|tạo|tao)\s+(?:a\s+)?(?:contact\s*)?(?:group|nhóm|nhom)\s+(.+)$/i);
  if (create) {
    const groupName = cleanName(create[1] ?? "");
    return groupName
      ? { canonicalCommand: `/contacts group create ${groupName}`, assistantText: copy(locale, "create") }
      : null;
  }

  const removeMember = value.match(/^(?:remove|xoá|xóa|bo\s*ra)\s+(.+?)\s+(?:from|khỏi|khoi)\s+(?:the\s+)?(?:contact\s*)?(?:group|nhóm|nhom)\s+(.+)$/i);
  if (removeMember) {
    const member = cleanName(removeMember[1] ?? "");
    const groupName = cleanName(removeMember[2] ?? "");
    return member && groupName
      ? { canonicalCommand: `/contacts group remove ${groupName} ${member}`, assistantText: copy(locale, "member") }
      : null;
  }

  const addMember = value.match(/^(?:add|thêm|them)\s+(.+?)\s+(?:to|vào|vao)\s+(?:the\s+)?(?:contact\s*)?(?:group|nhóm|nhom)\s+(.+)$/i);
  if (addMember) {
    const member = cleanName(addMember[1] ?? "");
    const groupName = cleanName(addMember[2] ?? "");
    return member && groupName
      ? { canonicalCommand: `/contacts group add ${groupName} ${member}`, assistantText: copy(locale, "member") }
      : null;
  }

  const deleteGroup = value.match(/^(?:delete|remove|xoá|xóa)\s+(?:the\s+)?(?:contact\s*)?(?:group|nhóm|nhom)\s+(.+)$/i);
  if (deleteGroup) {
    const groupName = cleanName(deleteGroup[1] ?? "");
    return groupName
      ? { canonicalCommand: `/contacts group delete ${groupName}`, assistantText: copy(locale, "delete") }
      : null;
  }

  return null;
}
