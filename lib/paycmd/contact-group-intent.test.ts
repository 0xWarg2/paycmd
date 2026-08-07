import assert from "node:assert/strict";
import test from "node:test";

import { contactGroupIntentFromNaturalLanguage } from "./contact-group-intent.ts";

test("routes bilingual contact-group imperatives into the slash grammar", () => {
  assert.deepEqual(contactGroupIntentFromNaturalLanguage("Tạo nhóm Core Team", "vi"), {
    canonicalCommand: "/contacts group create Core Team",
    assistantText: "Tạo nhóm contact.",
  });
  assert.deepEqual(contactGroupIntentFromNaturalLanguage("add Minh to group Core Team", "en"), {
    canonicalCommand: "/contacts group add Core Team Minh",
    assistantText: "Update the contact group membership.",
  });
  assert.deepEqual(contactGroupIntentFromNaturalLanguage("Xóa Lan khỏi nhóm Core Team", "vi"), {
    canonicalCommand: "/contacts group remove Core Team Lan",
    assistantText: "Cập nhật thành viên nhóm contact.",
  });
  assert.deepEqual(contactGroupIntentFromNaturalLanguage("delete group Core Team", "en"), {
    canonicalCommand: "/contacts group delete Core Team",
    assistantText: "The group will be deleted, but its contacts will remain.",
  });
});

test("does not turn group questions or slash commands into executable actions", () => {
  assert.equal(contactGroupIntentFromNaturalLanguage("Làm sao tạo nhóm Core Team?", "vi"), null);
  assert.equal(contactGroupIntentFromNaturalLanguage("/contacts group create Core Team", "vi"), null);
});
