import assert from "node:assert/strict";
import test from "node:test";

import { normalizeContactGroupName, validateContactGroupName } from "./contact-groups.ts";

test("normalizes owned group names deterministically", () => {
  assert.equal(normalizeContactGroupName("  Core   Team  "), "core team");
  assert.equal(normalizeContactGroupName("NHÓM KỸ THUẬT"), "nhóm kỹ thuật");
});

test("requires a bounded visible group name", () => {
  assert.deepEqual(validateContactGroupName(""), { ok: false, code: "GROUP_NAME_REQUIRED" });
  assert.deepEqual(validateContactGroupName("a".repeat(81)), { ok: false, code: "GROUP_NAME_TOO_LONG" });
  assert.deepEqual(validateContactGroupName("Core Team"), {
    ok: true,
    name: "Core Team",
    normalizedName: "core team",
  });
});
