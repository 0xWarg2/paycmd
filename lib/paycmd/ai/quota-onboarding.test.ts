import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeQuotaOnboardingState,
  shouldShowQuotaOnboarding,
} from "./quota-onboarding.ts";
import { getDeepSeekQuota } from "./access.ts";

const newLimitedUser = {
  quota: {
    enabled: true,
    unlimited: false,
    limit: 10,
    used: 0,
    remaining: 10,
  },
  noticeSeenAt: null,
};

function restoreQuotaFlag(previous: string | undefined) {
  if (previous === undefined) delete process.env.DEEPSEEK_QUOTA_ENABLED;
  else process.env.DEEPSEEK_QUOTA_ENABLED = previous;
}

test("shows the beta quota banner only to a new limited user", () => {
  assert.equal(shouldShowQuotaOnboarding(newLimitedUser), true);
});

test("hides the banner from whitelisted, disabled, used, and dismissed accounts", () => {
  assert.equal(
    shouldShowQuotaOnboarding({
      ...newLimitedUser,
      quota: { ...newLimitedUser.quota, unlimited: true, limit: null, used: null, remaining: null },
    }),
    false,
  );
  assert.equal(
    shouldShowQuotaOnboarding({
      ...newLimitedUser,
      quota: { ...newLimitedUser.quota, enabled: false, unlimited: true, limit: null, used: null, remaining: null },
    }),
    false,
  );
  assert.equal(
    shouldShowQuotaOnboarding({
      ...newLimitedUser,
      quota: { ...newLimitedUser.quota, used: 1, remaining: 9 },
    }),
    false,
  );
  assert.equal(
    shouldShowQuotaOnboarding({ ...newLimitedUser, noticeSeenAt: "2026-08-03T10:00:00.000Z" }),
    false,
  );
});

test("fails closed for missing or malformed quota responses", () => {
  assert.equal(normalizeQuotaOnboardingState(null), null);
  assert.equal(normalizeQuotaOnboardingState({ quota: { enabled: true } }), null);
  assert.equal(shouldShowQuotaOnboarding(null), false);
});

test("normalizes the server response used by the onboarding UI", () => {
  assert.deepEqual(normalizeQuotaOnboardingState(newLimitedUser), newLimitedUser);
});

test("reads quota through the non-consuming snapshot RPC", async () => {
  const previous = process.env.DEEPSEEK_QUOTA_ENABLED;
  process.env.DEEPSEEK_QUOTA_ENABLED = "true";
  const calls: string[] = [];

  try {
    const quota = await getDeepSeekQuota({
      rpc(fn: string) {
        calls.push(fn);
        return Promise.resolve({
          data: [{ unlimited: false, used: 0, remaining: 10 }],
          error: null,
        });
      },
    });

    assert.deepEqual(calls, ["get_deepseek_quota"]);
    assert.deepEqual(quota, newLimitedUser.quota);
  } finally {
    restoreQuotaFlag(previous);
  }
});

test("does not call the quota RPC while the server flag is disabled", async () => {
  const previous = process.env.DEEPSEEK_QUOTA_ENABLED;
  process.env.DEEPSEEK_QUOTA_ENABLED = "false";
  let called = false;

  try {
    const quota = await getDeepSeekQuota({
      rpc() {
        called = true;
        return Promise.resolve({ data: [], error: null });
      },
    });

    assert.equal(called, false);
    assert.deepEqual(quota, {
      enabled: false,
      unlimited: true,
      limit: null,
      used: null,
      remaining: null,
    });
  } finally {
    restoreQuotaFlag(previous);
  }
});
