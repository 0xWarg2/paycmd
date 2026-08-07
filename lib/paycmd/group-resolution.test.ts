import assert from "node:assert/strict";
import test from "node:test";

import { resolveGroupMemberExpression } from "./group-resolution.ts";

test("resolves only one exact catalog group/contact pair", () => {
  assert.deepEqual(
    resolveGroupMemberExpression(
      "Core Team Minh",
      [{ id: "g1", name: "Core Team" }],
      [{ id: "c1", display_name: "Minh" }],
    ),
    { status: "resolved", groupId: "g1", contactId: "c1" },
  );
});

test("does not guess an ambiguous or missing group member expression", () => {
  assert.equal(
    resolveGroupMemberExpression("Core Team Minh", [{ id: "g1", name: "Core Team" }], []).status,
    "missing",
  );
  assert.equal(
    resolveGroupMemberExpression(
      "Core Team Minh",
      [{ id: "g1", name: "Core Team" }, { id: "g2", name: "Core Team" }],
      [{ id: "c1", display_name: "Minh" }],
    ).status,
    "ambiguous",
  );
});
