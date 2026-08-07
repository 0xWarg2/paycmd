import assert from "node:assert/strict";
import test from "node:test";

import {
  PREVIEW_LEASE_MS,
  createPreviewExpiresAt,
  previewCanConfirm,
  previewLeaseState,
} from "./preview-lease.ts";

test("creates an exact fifteen-second preview lease", () => {
  assert.equal(PREVIEW_LEASE_MS, 15_000);
  assert.equal(createPreviewExpiresAt(1_000), new Date(16_000).toISOString());
});

test("rounds remaining display time up and expires at the boundary", () => {
  const expiresAt = new Date(15_000).toISOString();
  assert.deepEqual(previewLeaseState(expiresAt, 10_001), {
    expiresAt,
    remainingMs: 4_999,
    remainingSeconds: 5,
    expired: false,
  });
  assert.equal(previewLeaseState(expiresAt, 15_000).expired, true);
});

test("refuses cancelled, confirmed, missing-expiry, and late previews", () => {
  const expiresAt = new Date(15_000).toISOString();
  assert.equal(previewCanConfirm({ draftState: "active", previewExpiresAt: expiresAt }, 14_999), true);
  assert.equal(previewCanConfirm({ draftState: "active", previewExpiresAt: expiresAt }, 15_000), false);
  assert.equal(previewCanConfirm({ draftState: "cancelled", previewExpiresAt: expiresAt }, 1), false);
  assert.equal(previewCanConfirm({ draftState: "confirmed", previewExpiresAt: expiresAt }, 1), false);
  assert.equal(previewCanConfirm({ draftState: "active" }, 1), false);
});
