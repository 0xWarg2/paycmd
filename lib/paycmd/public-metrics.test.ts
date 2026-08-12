import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPublicCount,
  formatPublicUsdc,
  loadPublicPlatformMetrics,
  normalizePublicPlatformMetrics,
} from "./public-metrics.ts";

const validRow = {
  registered_users: 1250,
  completed_payments: "987",
  usdc_moved: "12345.678900",
  research_answers: 321,
  network: "testnet",
  as_of: "2026-08-13T12:00:00.000Z",
};

test("normalizes exactly one aggregate RPC row", () => {
  assert.deepEqual(normalizePublicPlatformMetrics([validRow]), {
    registeredUsers: 1250,
    completedPayments: 987,
    usdcMoved: "12345.678900",
    researchAnswers: 321,
    network: "testnet",
    asOf: "2026-08-13T12:00:00.000Z",
  });
});

test("fails closed for partial, negative, unsafe, or ambiguous metrics", () => {
  assert.equal(normalizePublicPlatformMetrics([]), null);
  assert.equal(normalizePublicPlatformMetrics([validRow, validRow]), null);
  assert.equal(normalizePublicPlatformMetrics({ ...validRow, registered_users: -1 }), null);
  assert.equal(normalizePublicPlatformMetrics({ ...validRow, completed_payments: "not-a-count" }), null);
  assert.equal(normalizePublicPlatformMetrics({ ...validRow, usdc_moved: "Infinity" }), null);
  assert.equal(normalizePublicPlatformMetrics({ ...validRow, network: "production-ish" }), null);
  assert.equal(normalizePublicPlatformMetrics({ ...validRow, as_of: "not-a-date" }), null);
});

test("formats social-proof values without inventing a suffix for small counts", () => {
  assert.equal(formatPublicCount(987), "987");
  assert.equal(formatPublicCount(1250), "1.3K");
  assert.equal(formatPublicUsdc("12.5"), "12.5");
  assert.equal(formatPublicUsdc("12345.6789"), "12.3K");
  assert.equal(formatPublicUsdc("invalid"), null);
});

test("loader returns null when telemetry is not configured", async () => {
  assert.equal(
    await loadPublicPlatformMetrics({ supabaseUrl: "", supabasePublishableKey: "" }),
    null,
  );
});

test("loader calls the aggregate RPC and rejects an upstream failure", async () => {
  let requestedUrl = "";
  const success = await loadPublicPlatformMetrics({
    supabaseUrl: "https://example.supabase.co/",
    supabasePublishableKey: "anon-key",
    fetcher: (async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify([validRow]), { status: 200 });
    }) as typeof fetch,
  });
  assert.equal(
    requestedUrl,
    "https://example.supabase.co/rest/v1/rpc/get_public_platform_metrics",
  );
  assert.equal(success?.completedPayments, 987);

  const failed = await loadPublicPlatformMetrics({
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "anon-key",
    fetcher: (async () => new Response("unavailable", { status: 503 })) as typeof fetch,
  });
  assert.equal(failed, null);
});
