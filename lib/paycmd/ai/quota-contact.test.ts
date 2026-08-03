import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowQuotaContactCta } from "./quota-contact.ts";

test("shows the X contact CTA only when the quota marker is present", () => {
  assert.equal(shouldShowQuotaContactCta({ quotaContactCta: true }), true);
  assert.equal(shouldShowQuotaContactCta({ quotaContactCta: false }), false);
  assert.equal(shouldShowQuotaContactCta({}), false);
});
