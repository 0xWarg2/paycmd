import assert from "node:assert/strict";
import test from "node:test";

import {
  gatewayActualFeeAtomic,
  gatewayDestinationTxHash,
  gatewayForwardingFailureMessage,
  gatewayForwardingSettlementFrom,
  gatewayMintGasModeFrom,
  gatewayTransferAmounts,
  gatewayTransferExecutionPlan,
  parseGatewayFeeEstimate,
  requestGatewayFeeEstimate,
  usdcAmountToAtomic,
} from "./gateway-transfer.ts";

test("uses Circle fees.total for a forwarding quote", () => {
  assert.deepEqual(
    parseGatewayFeeEstimate({
      body: [{ burnIntent: { maxFee: "19358" } }],
      fees: { token: "USDC", total: "0.017598", forwardingFee: "0.014098" },
    }),
    {
      atomicFee: 17_598n,
      feeEstimateKind: "quoted_total",
    },
  );
});

test("uses fees.total when Circle wraps the forwarding quote in an array", () => {
  assert.deepEqual(
    parseGatewayFeeEstimate([
      {
        burnIntent: { maxFee: "19358" },
        fees: { token: "USDC", total: "0.017598" },
      },
    ]),
    { atomicFee: 17_598n, feeEstimateKind: "quoted_total" },
  );
});

test("uses Circle burnIntent.maxFee as the reserve for a legacy manual quote", () => {
  assert.deepEqual(
    parseGatewayFeeEstimate([
      {
        burnIntent: {
          maxFee: "3850",
        },
      },
    ]),
    {
      atomicFee: 3_850n,
      feeEstimateKind: "max_fee_reserve",
    },
  );
});

test("rejects a malformed or zero Gateway fee quote", () => {
  assert.throws(() => parseGatewayFeeEstimate({ body: [] }), /usable fee/i);
  assert.throws(
    () => parseGatewayFeeEstimate([{ burnIntent: { maxFee: "0" } }]),
    /usable fee/i,
  );
});

test("accepts only explicit Gateway mint gas modes", () => {
  assert.equal(gatewayMintGasModeFrom("auto_forwarding"), "auto_forwarding");
  assert.equal(gatewayMintGasModeFrom("manual"), "manual");
  assert.throws(() => gatewayMintGasModeFrom("automatic"), /mintGasMode/i);
  assert.throws(() => gatewayMintGasModeFrom(undefined), /mintGasMode/i);
});

test("parses positive USDC amounts without floating point rounding", () => {
  assert.equal(usdcAmountToAtomic("1"), 1_000_000n);
  assert.equal(usdcAmountToAtomic("1.000001"), 1_000_001n);
  assert.throws(() => usdcAmountToAtomic("0"), /positive/i);
  assert.throws(() => usdcAmountToAtomic("1.0000001"), /six decimal/i);
});

test("requests a forwarding quote without sending the caller's maxFee", async () => {
  let requestedUrl = "";
  let requestedBody: unknown;
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        body: [{ burnIntent: { maxFee: "19358" } }],
        fees: { token: "USDC", total: "0.017598" },
      }),
      { status: 200 },
    );
  };

  const estimate = await requestGatewayFeeEstimate(
    {
      maxBlockHeight: 100n,
      maxFee: 1_000_000n,
      spec: { value: 1_000_000n, sourceDomain: 26, destinationDomain: 26 },
    },
    { enableForwarder: true, fetchImpl: fetchImpl as typeof fetch },
  );

  assert.equal(requestedUrl.endsWith("/v1/estimate?enableForwarder=true"), true);
  assert.deepEqual(requestedBody, [
    {
      maxBlockHeight: "100",
      spec: { value: "1000000", sourceDomain: 26, destinationDomain: 26 },
    },
  ]);
  assert.deepEqual(estimate, {
    atomicFee: 17_598n,
    feeEstimateKind: "quoted_total",
  });
});

test("fails closed when Circle Gateway estimate returns an error", async () => {
  const fetchImpl = async () => new Response("upstream unavailable", { status: 503 });

  await assert.rejects(
    requestGatewayFeeEstimate(
      { maxFee: 1n, spec: { value: 1_000_000n } },
      { enableForwarder: false, fetchImpl: fetchImpl as typeof fetch },
    ),
    /503.*upstream unavailable/i,
  );
});

test("reads the actual Circle fee and forwarded destination transaction hash", () => {
  assert.equal(gatewayActualFeeAtomic({ token: "USDC", total: "0.0035" }), 3_500n);
  assert.equal(
    gatewayDestinationTxHash({
      forwardingDetails: {
        transactionHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      },
    }),
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  );
});

test("uses the canonical forwarded destination hash returned by the Circle adapter", () => {
  const hash = "0x3333333333333333333333333333333333333333333333333333333333333333";

  assert.equal(
    gatewayDestinationTxHash({
      forwardedDestinationTxHash: hash,
      forwardingDetails: { forwardingEnabled: true },
    }),
    hash,
  );
});

test("normalizes Circle's top-level forwarding transaction hash", () => {
  const hash = "0x1111111111111111111111111111111111111111111111111111111111111111";
  const settlement = gatewayForwardingSettlementFrom(
    {
      transferId: "transfer-123",
      status: "confirmed",
      transactionHash: hash,
      fees: { token: "USDC", total: "0.017838" },
      forwardingDetails: { forwardingEnabled: true },
    },
    { token: "USDC", total: "0.02" },
  );

  assert.equal(settlement.destinationTxHash, hash);
  assert.equal(settlement.forwardingDetails.transactionHash, hash);
  assert.deepEqual(settlement.fees, { token: "USDC", total: "0.017838" });
});

test("keeps legacy nested forwarding hashes and fallback fees", () => {
  const hash = "0x2222222222222222222222222222222222222222222222222222222222222222";
  const fallbackFees = { token: "USDC", total: "0.00385" };
  const settlement = gatewayForwardingSettlementFrom(
    { status: "finalized", forwardingDetails: { transactionHash: hash } },
    fallbackFees,
  );

  assert.equal(settlement.destinationTxHash, hash);
  assert.equal(settlement.forwardingDetails.transactionHash, hash);
  assert.deepEqual(settlement.fees, fallbackFees);
});

test("rejects malformed forwarding transaction identifiers", () => {
  const settlement = gatewayForwardingSettlementFrom({
    status: "confirmed",
    transactionHash: "circle-transfer-uuid",
    forwardingDetails: { transactionHash: "also-not-a-hash" },
  });

  assert.equal(settlement.destinationTxHash, undefined);
  assert.equal(settlement.forwardingDetails.transactionHash, undefined);
});

test("keeps the Circle transfer ID in an ambiguous settlement warning", () => {
  const message = gatewayForwardingFailureMessage("transfer-123");

  assert.match(message, /Circle transfer ID: transfer-123\./);
  assert.match(message, /did not retry or fall back to Manual/);
  assert.match(message, /avoid sending twice/);
  assert.doesNotMatch(gatewayForwardingFailureMessage(undefined), /Circle transfer ID:/);
});

test("prefers a manual mint hash and rejects non-hash forwarding identifiers", () => {
  const manual = "0x2222222222222222222222222222222222222222222222222222222222222222";
  assert.equal(
    gatewayDestinationTxHash({
      mintTxHash: manual,
      forwardingDetails: { transactionHash: "not-a-hash" },
    }),
    manual,
  );
  assert.equal(gatewayDestinationTxHash({ forwardingDetails: { transactionHash: "uuid" } }), undefined);
  assert.equal(gatewayActualFeeAtomic({ total: "invalid" }), undefined);
});

test("uses the preflight reserve for preview source debit", () => {
  assert.deepEqual(
    gatewayTransferAmounts(
      { amount: "1", estimatedGatewayFee: "0.00385", requiredGatewayBalance: "1.00385" },
      "preview",
    ),
    { amount: 1, gatewayFee: 0.00385, sourceDebit: 1.00385, actual: false },
  );
});

test("replaces a legacy reserve with Circle's actual fee on the receipt", () => {
  assert.deepEqual(
    gatewayTransferAmounts(
      {
        amount: "1",
        estimatedGatewayFee: "0.00385",
        requiredGatewayBalance: "1.00385",
        fees: { total: "0.0035" },
      },
      "receipt",
    ),
    { amount: 1, gatewayFee: 0.0035, sourceDebit: 1.0035, actual: true },
  );
});

test("keeps Arc to Arc auto forwarding enabled", () => {
  assert.deepEqual(
    gatewayTransferExecutionPlan({
      sourceChain: "arcTestnet",
      destinationChain: "arcTestnet",
      mintGasMode: "auto_forwarding",
    }),
    { mintGasMode: "auto_forwarding", forwarding: true, destinationGasPreflight: false },
  );
});

test("keeps Arc to Arc manual and requires destination gas preflight", () => {
  assert.deepEqual(
    gatewayTransferExecutionPlan({
      sourceChain: "arcTestnet",
      destinationChain: "arcTestnet",
      mintGasMode: "manual",
    }),
    { mintGasMode: "manual", forwarding: false, destinationGasPreflight: true },
  );
});
