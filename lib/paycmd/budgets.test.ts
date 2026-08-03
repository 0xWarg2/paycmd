import assert from "node:assert/strict";
import test from "node:test";

import { rollingWindowStartIso } from "./budgets.ts";

test("calculates a deterministic rolling budget window outside React render", () => {
  const now = Date.UTC(2026, 7, 3, 12, 0, 0);

  assert.equal(rollingWindowStartIso(30, now), "2026-07-04T12:00:00.000Z");
});
