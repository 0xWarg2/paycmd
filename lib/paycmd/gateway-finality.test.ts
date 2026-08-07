import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import * as gatewayWebhook from "../circle/gateway-webhook.ts";
import * as gatewayFinalityModule from "./gateway-finality.ts";
import {
  gatewayDepositPollingIntervalMs,
  reconciliationDecision,
} from "./gateway-finality.ts";
import {
  buildGatewayWebhookSubscription,
  fetchCircleNotificationPublicKey,
  parseGatewayDepositFinalized,
  verifyCircleWebhookSignature,
} from "../circle/gateway-webhook.ts";

const finalizedPayload = {
  subscriptionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  notificationId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  notificationType: "gateway.deposit.finalized",
  notification: {
    id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    walletAddress: "0xf70da97812cb96acdf810712aa562db8dfa3dbef",
    domain: "26",
    env: "testnet",
    tokenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    amount: "1.000000",
    from: "0xf70da97812cb96acdf810712aa562db8dfa3dbef",
    to: "0x19330d10d9cc8751218eaf51e8885d058642e08a",
    txHash: "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b",
  },
  timestamp: "2026-08-03T12:05:00.000Z",
  version: 2,
};

const webhookTestPayload = {
  subscriptionId: "00000000-0000-0000-0000-000000000000",
  notificationId: "00000000-0000-0000-0000-000000000000",
  notificationType: "webhooks.test",
  notification: { hello: "world" },
  timestamp: "2026-08-04T04:42:39.000Z",
  version: 2,
};

test("recognizes Circle's signed endpoint-verification notification", () => {
  const recognizesTestNotification = (
    gatewayWebhook as Record<string, unknown>
  ).isCircleWebhookTestNotification;

  assert.equal(typeof recognizesTestNotification, "function");
  assert.equal(
    (recognizesTestNotification as (input: unknown) => boolean)(webhookTestPayload),
    true,
  );
});

test("requires an existing Circle subscription in update-only mode", () => {
  const resolveRequest = (
    gatewayWebhook as Record<string, unknown>
  ).resolveGatewayWebhookSubscriptionRequest;

  assert.equal(typeof resolveRequest, "function");
  assert.throws(
    () =>
      (resolveRequest as (input: unknown) => unknown)({
        subscriptionId: undefined,
        updateOnly: true,
      }),
    /CIRCLE_GATEWAY_WEBHOOK_SUBSCRIPTION_ID is required in update-only mode/,
  );
});

test("updates an existing Circle subscription without creating a duplicate", () => {
  const resolveRequest = (
    gatewayWebhook as Record<string, unknown>
  ).resolveGatewayWebhookSubscriptionRequest as (input: unknown) => unknown;

  assert.deepEqual(
    resolveRequest({ subscriptionId: "subscription-123", updateOnly: true }),
    {
      method: "PATCH",
      url: "https://api.circle.com/v2/notifications/subscriptions/permissionless/subscription-123",
    },
  );
});

test("allows the manual configure command to create the first Circle subscription", () => {
  const resolveRequest = (
    gatewayWebhook as Record<string, unknown>
  ).resolveGatewayWebhookSubscriptionRequest as (input: unknown) => unknown;

  assert.deepEqual(resolveRequest({ subscriptionId: undefined, updateOnly: false }), {
    method: "POST",
    url: "https://api.circle.com/v2/notifications/subscriptions/permissionless",
  });
});

test("classifies an already-settled deposit as a successful webhook acknowledgement", () => {
  const classifyDeposit = (
    gatewayWebhook as Record<string, unknown>
  ).classifyGatewayWebhookDeposit;

  assert.equal(typeof classifyDeposit, "function");
  assert.equal(
    (classifyDeposit as (status: string | null) => string)("success"),
    "already_settled",
  );
  assert.equal(
    (classifyDeposit as (status: string | null) => string)("pending_gateway_finality"),
    "settle",
  );
  assert.equal(
    (classifyDeposit as (status: string | null) => string)(null),
    "retry",
  );
});

test("accepts only a matching Circle Gateway deposit-finalized event", () => {
  const parsed = parseGatewayDepositFinalized(finalizedPayload, "testnet");

  assert.equal(parsed.notificationId, finalizedPayload.notificationId);
  assert.equal(parsed.txHash, finalizedPayload.notification.txHash);
  assert.equal(parsed.walletAddress, finalizedPayload.notification.walletAddress);
  assert.equal(parsed.domain, 26);
  assert.equal(parsed.amount, "1.000000");
});

test("rejects a finalized event from the wrong Circle environment", () => {
  assert.throws(
    () => parseGatewayDepositFinalized(finalizedPayload, "mainnet"),
    /environment/i,
  );
});

test("rejects a Circle notification that is not deposit-finalized", () => {
  assert.throws(
    () =>
      parseGatewayDepositFinalized(
        { ...finalizedPayload, notificationType: "gateway.mint.finalized" },
        "testnet",
      ),
    /notification type/i,
  );
});

test("verifies the raw Circle webhook body and rejects a forged body", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const body = JSON.stringify(finalizedPayload);
  const signature = sign("sha256", Buffer.from(body), privateKey).toString("base64");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" }).toString("base64");

  assert.equal(verifyCircleWebhookSignature(body, signature, publicKeyDer), true);
  assert.equal(verifyCircleWebhookSignature(`${body} `, signature, publicKeyDer), false);
});

test("loads only an ECDSA SHA-256 Circle notification key", async () => {
  let calls = 0;
  const fetchKey = () => fetchCircleNotificationPublicKey(
    "test-cache-key",
    "api-key",
    async (input, init) => {
      calls += 1;
      assert.equal(String(input), "https://api.circle.com/v2/notifications/publicKey/test-cache-key");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer api-key");
      return Response.json({
        data: { id: "test-cache-key", algorithm: "ECDSA_SHA_256", publicKey: "public-key" },
      });
    },
  );

  assert.equal(await fetchKey(), "public-key");
  assert.equal(await fetchKey(), "public-key");
  assert.equal(calls, 1);
});

test("builds a restricted deposit-finalized subscription without duplicate addresses", () => {
  assert.deepEqual(
    buildGatewayWebhookSubscription({
      environment: "TEST",
      endpoint: "https://payna.example/api/webhooks/circle-gateway",
      addresses: ["0xAbC", "0xabc"],
      domains: [26, 6, 26],
    }),
    {
      environment: "TEST",
      endpoint: "https://payna.example/api/webhooks/circle-gateway",
      addresses: ["0xAbC"],
      domains: ["26", "6"],
      name: "Payna Gateway deposits",
      enabled: true,
      notificationTypes: ["gateway.deposit.finalized"],
    },
  );
});

test("reconciliation waits until Circle processed the deposit block", () => {
  assert.deepEqual(
    reconciliationDecision({
      txHash: "0xabc",
      pendingTxHashes: new Set<string>(),
      depositBlockNumber: 101n,
      processedHeight: 100n,
    }),
    { settled: false, reason: "circle_behind_deposit_block" },
  );
});

test("reconciliation keeps a deposit finalizing while Circle lists its hash", () => {
  assert.deepEqual(
    reconciliationDecision({
      txHash: "0xAbC",
      pendingTxHashes: new Set(["0xabc"]),
      depositBlockNumber: 100n,
      processedHeight: 100n,
    }),
    { settled: false, reason: "listed_pending" },
  );
});

test("reconciliation settles only after processed height passes and hash is absent", () => {
  assert.deepEqual(
    reconciliationDecision({
      txHash: "0xAbC",
      pendingTxHashes: new Set<string>(),
      depositBlockNumber: 100n,
      processedHeight: 101n,
    }),
    { settled: true, reason: "processed_and_not_pending" },
  );
});

test("polling backs off while webhook remains the primary completion path", () => {
  assert.equal(gatewayDepositPollingIntervalMs(30_000), 15_000);
  assert.equal(gatewayDepositPollingIntervalMs(3 * 60_000), 30_000);
  assert.equal(gatewayDepositPollingIntervalMs(12 * 60_000), 60_000);
});

test("builds a catch-up snapshot from a webhook-settled chat message", () => {
  const buildSnapshots = (
    gatewayFinalityModule as Record<string, unknown>
  ).gatewayDepositSettlementSnapshotsFromMessages;

  assert.equal(typeof buildSnapshots, "function");
  assert.deepEqual(
    (buildSnapshots as (rows: unknown[]) => unknown[])([
      {
        content: "1 USDC is available in Gateway.",
        metadata: {
          execution: {
            command: "deposit",
            status: "success",
            txHash: "0xABC",
            finalitySource: "circle_webhook",
          },
        },
      },
      {
        content: "Still waiting",
        metadata: {
          execution: { command: "deposit", status: "waiting_gateway", txHash: "0xDEF" },
        },
      },
    ]),
    [{ txHash: "0xABC", message: "1 USDC is available in Gateway." }],
  );
});

test("uses settled snapshots when polling missed the realtime completion", () => {
  const readSettlements = (
    gatewayFinalityModule as Record<string, unknown>
  ).gatewayDepositSettlementsFromSync;

  assert.equal(typeof readSettlements, "function");
  assert.deepEqual(
    (readSettlements as (payload: unknown) => unknown[])({
      completed: [],
      settled: [{ txHash: "0xABC", message: "Deposit complete" }],
    }),
    [{ txHash: "0xABC", message: "Deposit complete" }],
  );
});
