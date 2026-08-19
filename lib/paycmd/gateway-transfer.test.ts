import assert from "node:assert/strict";
import test from "node:test";
import { supportedChains } from "./chains.ts";

import {
  gatewayActualFeeAtomic,
  gatewayActualTransferAmounts,
  gatewayManualMintSupported,
  gatewayReceiptFeeComponents,
  gatewaySupportedMintGasModes,
  gatewayDestinationTxHash,
  gatewayFeeExecutionAmounts,
  gatewayForwardingFailureMessage,
  gatewayForwardingPollOutcome,
  pollGatewayForwardingTransfer,
  gatewayForwardingSettlementFrom,
  gatewayForwardingTransferId,
  gatewayForwardedMintReceiptMatches,
  gatewayBurnIntentTransferPayload,
  gatewayBurnIntentSetTransferPayload,
  gatewayScaSigningGroups,
  gatewayMintGasModeFrom,
  gatewayTransferAmounts,
  gatewayTransferExecutionPlan,
  parseGatewayFeeEstimate,
  parseGatewayFeeEstimateSet,
  requestGatewayFeeEstimate,
  requestGatewayFeeEstimateSet,
  requestGatewaySignedTransfer,
  usdcAmountToAtomic,
} from "./gateway-transfer.ts";

test("groups SCA burn intents per source chain while preserving first-seen order", () => {
  const baseA = { id: "base-a", spec: { sourceDomain: 6 } };
  const arc = { id: "arc", spec: { sourceDomain: 26 } };
  const baseB = { id: "base-b", spec: { sourceDomain: 6 } };
  const avax = { id: "avax", spec: { sourceDomain: 1 } };

  assert.deepEqual(gatewayScaSigningGroups([baseA, arc, baseB, avax]), [
    [baseA, baseB],
    [arc],
    [avax],
  ]);
});

test("submits all per-chain SCA signatures in one atomic Gateway request", async () => {
  const payloads = [
    { burnIntent: { spec: { sourceDomain: 6 } }, signature: "0xbase", contractSigner: true },
    { burnIntent: { spec: { sourceDomain: 26 } }, signature: "0xarc", contractSigner: true },
    { burnIntent: { spec: { sourceDomain: 1 } }, signature: "0xavax", contractSigner: true },
  ];
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const result = await requestGatewaySignedTransfer(payloads, {
    enableForwarder: true,
    fetchImpl: (async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ transferId: "atomic-transfer" }), { status: 200 });
    }) as typeof fetch,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.url, /\/v1\/transfer\?enableForwarder=true$/);
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), payloads);
  assert.deepEqual(result, { transferId: "atomic-transfer" });
});

test("uses Circle fees.total for a forwarding quote", () => {
  assert.deepEqual(
    parseGatewayFeeEstimate({
      body: [{ burnIntent: { maxFee: "19358" } }],
      fees: { token: "USDC", total: "0.017598", forwardingFee: "0.014098" },
    }, { enableForwarder: true }),
    {
      atomicFee: 17_598n,
      maxFeeAtomic: 19_358n,
      feeEstimateKind: "quoted_total",
      feeBreakdown: {
        forwardingFeeAtomic: 14_098n,
        totalAtomic: 17_598n,
      },
    },
  );
});

test("uses Circle's returned maxFee reserve for execution and balance preflight", () => {
  assert.deepEqual(
    gatewayFeeExecutionAmounts(
      1_000_000n,
      {
        atomicFee: 17_598n,
        maxFeeAtomic: 19_358n,
        feeEstimateKind: "quoted_total",
        feeBreakdown: { totalAtomic: 17_598n },
      },
    ),
    {
      estimatedFeeAtomic: 17_598n,
      maxFeeAtomic: 19_358n,
      requiredGatewayBalanceAtomic: 1_019_358n,
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
    ], { enableForwarder: true }),
    {
      atomicFee: 17_598n,
      maxFeeAtomic: 19_358n,
      feeEstimateKind: "quoted_total",
      feeBreakdown: { totalAtomic: 17_598n },
    },
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
    ], { enableForwarder: false }),
    {
      atomicFee: 3_850n,
      maxFeeAtomic: 3_850n,
      feeEstimateKind: "max_fee_reserve",
      feeBreakdown: {},
    },
  );
});

test("rejects a malformed or zero Gateway fee quote", () => {
  assert.throws(() => parseGatewayFeeEstimate({ body: [] }, { enableForwarder: false }), /usable fee/i);
  assert.throws(
    () => parseGatewayFeeEstimate({ body: [{ burnIntent: {} }], fees: { total: "0.017598" } }, { enableForwarder: true }),
    /usable maxFee/i,
  );
  assert.throws(
    () => parseGatewayFeeEstimate([{ burnIntent: { maxFee: "0" } }], { enableForwarder: false }),
    /usable fee/i,
  );
});

test("fails closed for inconsistent Circle fee metadata", () => {
  const base = { body: [{ burnIntent: { maxFee: "20000" } }] };
  for (const fees of [
    undefined,
    { token: "USDC", total: "0" },
    { token: "USDC", total: "bad" },
    { token: "EURC", total: "0.01" },
    { token: "USDC", total: "0.020001" },
  ]) {
    assert.throws(
      () => parseGatewayFeeEstimate({ ...base, ...(fees ? { fees } : {}) }, { enableForwarder: true }),
      /Gateway fee|fees\.total|USDC|maxFee/i,
    );
  }

  assert.throws(
    () => parseGatewayFeeEstimate({ ...base, fees: { token: "USDC", total: "0" } }, { enableForwarder: false }),
    /fees\.total/i,
  );
});

test("normalizes Circle per-intent and forwarding fee breakdown", () => {
  const estimate = parseGatewayFeeEstimate({
    body: [{ burnIntent: { maxFee: "12000" } }],
    fees: {
      token: "USDC",
      total: "0.01",
      forwardingFee: "0.004",
      perIntent: [
        { baseFee: "0.001", transferFee: "0.002" },
        { baseFee: "0.001", transferFee: "0.002" },
      ],
    },
  }, { enableForwarder: true });

  assert.deepEqual(estimate.feeBreakdown, {
    baseFeeAtomic: 2_000n,
    transferFeeAtomic: 4_000n,
    forwardingFeeAtomic: 4_000n,
    totalAtomic: 10_000n,
  });
});

test("exposes Manual mint capability for every Gateway destination", () => {
  const supported = [
    "arcTestnet", "arbitrumSepolia", "avalancheFuji", "baseSepolia", "sepolia",
    "optimismSepolia", "polygonAmoy", "unichainSepolia",
  ];
  const forwardingOnly = ["hyperEvmTestnet", "seiAtlantic", "sonicTestnet", "worldChainSepolia"];

  for (const chain of supported) {
    assert.equal(gatewayManualMintSupported(chain), true);
    assert.deepEqual(gatewaySupportedMintGasModes(chain), ["auto_forwarding", "manual"]);
  }
  for (const chain of forwardingOnly) {
    assert.equal(gatewayManualMintSupported(chain), false);
    assert.deepEqual(gatewaySupportedMintGasModes(chain), ["auto_forwarding"]);
  }
});

test("enforces the destination capability for same-chain and cross-chain plans", () => {
  for (const sourceChain of supportedChains) {
    for (const destinationChain of supportedChains) {
      assert.equal(
        gatewayTransferExecutionPlan({
          sourceChain,
          destinationChain,
          mintGasMode: "auto_forwarding",
        }).forwarding,
        true,
      );

      if (gatewayManualMintSupported(destinationChain)) {
        assert.equal(
          gatewayTransferExecutionPlan({
            sourceChain,
            destinationChain,
            mintGasMode: "manual",
          }).destinationGasPreflight,
          true,
        );
      } else {
        assert.throws(
          () => gatewayTransferExecutionPlan({
            sourceChain,
            destinationChain,
            mintGasMode: "manual",
          }),
          (error: any) =>
            error?.code === "GATEWAY_MANUAL_MINT_UNSUPPORTED" &&
            error?.supportedMintGasModes?.[0] === "auto_forwarding",
        );
      }
    }
  }
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
    maxFeeAtomic: 19_358n,
    feeEstimateKind: "quoted_total",
    feeBreakdown: { totalAtomic: 17_598n },
  });
});

test("parses every returned BurnIntentSet reserve and the aggregate Circle fee", () => {
  const estimate = parseGatewayFeeEstimateSet({
    body: [{
      burnIntentSet: {
        intents: [
          { maxBlockHeight: "100", maxFee: "7000", spec: { sourceDomain: 0, value: "3000000" } },
          { maxBlockHeight: "101", maxFee: "9000", spec: { sourceDomain: 6, value: "2000000" } },
        ],
      },
    }],
    fees: {
      token: "USDC",
      total: "0.014",
      forwardingFee: "0.004",
      perIntent: [
        { baseFee: "0.001", transferFee: "0.004" },
        { baseFee: "0.001", transferFee: "0.004" },
      ],
    },
  }, { enableForwarder: true });

  assert.equal(estimate.atomicFee, 14_000n);
  assert.equal(estimate.maxFeeAtomic, 16_000n);
  assert.deepEqual(estimate.intents.map((intent) => ({
    sourceDomain: intent.sourceDomain,
    maxBlockHeight: intent.maxBlockHeight,
    maxFeeAtomic: intent.maxFeeAtomic,
    estimatedFeeAtomic: intent.estimatedFeeAtomic,
  })), [
    { sourceDomain: 0, maxBlockHeight: 100n, maxFeeAtomic: 7_000n, estimatedFeeAtomic: 5_000n },
    { sourceDomain: 6, maxBlockHeight: 101n, maxFeeAtomic: 9_000n, estimatedFeeAtomic: 5_000n },
  ]);
});

test("requests a partial BurnIntentSet and omits every caller maxFee", async () => {
  let requestedBody: unknown;
  const fetchImpl = async (_input: string | URL | Request, init?: RequestInit) => {
    requestedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      body: [{
        burnIntentSet: {
          intents: [
            { maxBlockHeight: "100", maxFee: "7000", spec: { sourceDomain: 0, value: "3000000" } },
            { maxBlockHeight: "101", maxFee: "9000", spec: { sourceDomain: 6, value: "2000000" } },
          ],
        },
      }],
      fees: { token: "USDC", total: "0.014" },
    }), { status: 200 });
  };

  const estimate = await requestGatewayFeeEstimateSet([
    { maxBlockHeight: 100n, maxFee: 123n, spec: { sourceDomain: 0, value: 3_000_000n } },
    { maxBlockHeight: 101n, maxFee: 456n, spec: { sourceDomain: 6, value: 2_000_000n } },
  ], { enableForwarder: true, fetchImpl: fetchImpl as typeof fetch });

  assert.deepEqual(requestedBody, [{
    intents: [
      { maxBlockHeight: "100", spec: { sourceDomain: 0, value: "3000000" } },
      { maxBlockHeight: "101", spec: { sourceDomain: 6, value: "2000000" } },
    ],
  }]);
  assert.equal(estimate.intents.length, 2);
  assert.equal(estimate.maxFeeAtomic, 16_000n);
});

test("serializes one signed BurnIntentSet transfer with a shared signature", () => {
  assert.deepEqual(gatewayBurnIntentSetTransferPayload([
    { maxBlockHeight: 100n, maxFee: 7_000n, spec: { sourceDomain: 0, value: 3_000_000n } },
    { maxBlockHeight: 101n, maxFee: 9_000n, spec: { sourceDomain: 6, value: 2_000_000n } },
  ], "0x1234"), [{
    burnIntentSet: {
      intents: [
        { maxBlockHeight: "100", maxFee: "7000", spec: { sourceDomain: 0, value: "3000000" } },
        { maxBlockHeight: "101", maxFee: "9000", spec: { sourceDomain: 6, value: "2000000" } },
      ],
    },
    signature: "0x1234",
  }]);
});

test("marks only SCA transfer payloads for ERC-1271 contract verification", () => {
  const burnIntent = {
    maxBlockHeight: 100n,
    maxFee: 7_000n,
    spec: { sourceDomain: 0, value: 3_000_000n },
  };

  assert.deepEqual(gatewayBurnIntentTransferPayload(burnIntent, "0x1234"), [{
    burnIntent: {
      maxBlockHeight: "100",
      maxFee: "7000",
      spec: { sourceDomain: 0, value: "3000000" },
    },
    signature: "0x1234",
  }]);

  assert.deepEqual(
    gatewayBurnIntentTransferPayload(burnIntent, "0x1234", { contractSigner: true }),
    [{
      burnIntent: {
        maxBlockHeight: "100",
        maxFee: "7000",
        spec: { sourceDomain: 0, value: "3000000" },
      },
      signature: "0x1234",
      contractSigner: true,
    }],
  );
});

test("can mark a contract-signed intent set without changing the legacy payload", () => {
  const intents = [
    { maxBlockHeight: 100n, maxFee: 7_000n, spec: { sourceDomain: 0, value: 3_000_000n } },
  ];

  assert.equal(
    "contractSigner" in gatewayBurnIntentSetTransferPayload(intents, "0x1234")[0],
    false,
  );
  assert.equal(
    gatewayBurnIntentSetTransferPayload(intents, "0x1234", { contractSigner: true })[0].contractSigner,
    true,
  );
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
  assert.equal(gatewayActualFeeAtomic({ token: "EURC", total: "0.0035" }), undefined);
  assert.equal(gatewayActualFeeAtomic({ token: "USDC", total: "0" }), undefined);
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
  );

  assert.equal(settlement.destinationTxHash, hash);
  assert.equal(settlement.forwardingDetails.transactionHash, hash);
  assert.deepEqual(settlement.fees, { token: "USDC", total: "0.017838" });
});

test("keeps legacy nested forwarding hashes without inventing settlement fees", () => {
  const hash = "0x2222222222222222222222222222222222222222222222222222222222222222";
  const settlement = gatewayForwardingSettlementFrom(
    { status: "finalized", forwardingDetails: { transactionHash: hash } },
  );

  assert.equal(settlement.destinationTxHash, hash);
  assert.equal(settlement.forwardingDetails.transactionHash, hash);
  assert.equal(settlement.fees, undefined);
});

test("marks a successful mint fee pending when Circle settlement fee is unavailable", () => {
  assert.deepEqual(
    gatewayActualTransferAmounts(1_000_000n, { token: "USDC", total: "0.0035" }),
    {
      actualFeeStatus: "actual",
      actualGatewayFee: 0.0035,
      actualSourceDebit: 1.0035,
    },
  );
  assert.deepEqual(
    gatewayActualTransferAmounts(1_000_000n, { token: "USDC", total: "bad" }),
    {
      actualFeeStatus: "pending",
      actualGatewayFee: null,
      actualSourceDebit: null,
    },
  );
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

test("recovers a Circle failed status only after the expected mint is confirmed onchain", () => {
  assert.equal(
    gatewayForwardingPollOutcome({ status: "failed", mintReceiptMatches: true }),
    "settled",
  );
  assert.equal(
    gatewayForwardingPollOutcome({ status: "failed", mintReceiptMatches: false }),
    "failed",
  );
  assert.equal(
    gatewayForwardingPollOutcome({ status: "pending", mintReceiptMatches: true }),
    "pending",
  );
});

test("polling returns finalized Circle details", async () => {
  const details = await pollGatewayForwardingTransfer({
    transferId: "transfer-finalized",
    maxAttempts: 1,
    sleep: async () => {},
    fetchTransfer: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: "finalized", transactionHash: "0xabc" }),
    }),
    confirmMint: async () => false,
  });

  assert.deepEqual(details, { status: "finalized", transactionHash: "0xabc" });
});

test("polling retries HTTP errors and fails with the transfer ID", async () => {
  let calls = 0;
  await assert.rejects(
    pollGatewayForwardingTransfer({
      transferId: "transfer-http-error",
      maxAttempts: 2,
      sleep: async () => {},
      fetchTransfer: async () => {
        calls++;
        return { ok: false, status: 503, json: async () => ({}) };
      },
      confirmMint: async () => false,
    }),
    /did not complete.*transfer-http-error/i,
  );
  assert.equal(calls, 2);
});

test("polling treats Circle failed as settled only after exact mint confirmation", async () => {
  const recovered = await pollGatewayForwardingTransfer({
    transferId: "transfer-recovered",
    maxAttempts: 1,
    sleep: async () => {},
    fetchTransfer: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: "failed", forwardingDetails: { failureReason: "timeout" } }),
    }),
    confirmMint: async () => true,
  });
  assert.deepEqual(recovered.forwardingDetails, {
    failureReason: "timeout",
    onchainMintConfirmed: true,
    reportedStatus: "failed",
  });

  await assert.rejects(
    pollGatewayForwardingTransfer({
      transferId: "transfer-failed",
      maxAttempts: 1,
      sleep: async () => {},
      fetchTransfer: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: "failed", forwardingDetails: { failureReason: "reverted" } }),
      }),
      confirmMint: async () => false,
    }),
    /Forwarded transfer failed: reverted/,
  );
});

test("matches only a successful exact USDC mint receipt", () => {
  const tokenAddress = "0x3600000000000000000000000000000000000000";
  const recipient = "0xe8c0bc40c7a94901c75521713736a0de2abf37d9";
  const mintLog = {
    address: tokenAddress,
    topics: [
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x000000000000000000000000e8c0bc40c7a94901c75521713736a0de2abf37d9",
    ],
    data: "0x00000000000000000000000000000000000000000000000000000000000f4240",
  };

  assert.equal(
    gatewayForwardedMintReceiptMatches({
      receiptStatus: "success",
      tokenAddress,
      recipient,
      amountAtomic: 1_000_000n,
      logs: [mintLog],
    }),
    true,
  );
  assert.equal(
    gatewayForwardedMintReceiptMatches({
      receiptStatus: "reverted",
      tokenAddress,
      recipient,
      amountAtomic: 1_000_000n,
      logs: [mintLog],
    }),
    false,
  );
  assert.equal(
    gatewayForwardedMintReceiptMatches({
      receiptStatus: "success",
      tokenAddress,
      recipient,
      amountAtomic: 2_000_000n,
      logs: [mintLog],
    }),
    false,
  );
  assert.equal(
    gatewayForwardedMintReceiptMatches({
      receiptStatus: "success",
      tokenAddress: "0x1111111111111111111111111111111111111111",
      recipient,
      amountAtomic: 1_000_000n,
      logs: [mintLog],
    }),
    false,
  );
  assert.equal(
    gatewayForwardedMintReceiptMatches({
      receiptStatus: "success",
      tokenAddress,
      recipient: "0x2222222222222222222222222222222222222222",
      amountAtomic: 1_000_000n,
      logs: [mintLog],
    }),
    false,
  );
});

test("retains a structurally present forwarding transfer ID", () => {
  assert.equal(gatewayForwardingTransferId({ transferId: "transfer-123" }), "transfer-123");
  assert.equal(gatewayForwardingTransferId({ transferId: "" }), undefined);
  assert.equal(gatewayForwardingTransferId(new Error("failed")), undefined);
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
    {
      amount: 1,
      gatewayFee: 0.00385,
      sourceDebit: 1.00385,
      actual: false,
      actualFeeStatus: "pending",
      estimatedGatewayFee: 0.00385,
      estimatedSourceDebit: 1.00385,
    },
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
    {
      amount: 1,
      gatewayFee: 0.0035,
      sourceDebit: 1.0035,
      actual: true,
      actualFeeStatus: "actual",
      estimatedGatewayFee: 0.00385,
      estimatedSourceDebit: 1.00385,
    },
  );
});

test("does not label a preflight estimate as actual on a successful receipt", () => {
  assert.deepEqual(
    gatewayTransferAmounts(
      {
        amount: "1",
        estimatedGatewayFee: "0.00385",
        requiredGatewayBalance: "1.00385",
        actualFeeStatus: "pending",
        actualGatewayFee: null,
        actualSourceDebit: null,
        fees: { token: "USDC", total: "0.00385" },
      },
      "receipt",
    ),
    {
      amount: 1,
      gatewayFee: null,
      sourceDebit: null,
      actual: false,
      actualFeeStatus: "pending",
      estimatedGatewayFee: 0.00385,
      estimatedSourceDebit: 1.00385,
    },
  );
});

test("accepts an explicit zero actual fee from Circle Kit", () => {
  const amounts = gatewayTransferAmounts(
    { amount: "1", actualFeeStatus: "actual", actualGatewayFee: 0 },
    "receipt",
  );
  assert.equal(amounts.actualFeeStatus, "actual");
  assert.equal(amounts.gatewayFee, 0);
  assert.equal(amounts.sourceDebit, 1);
});

test("receipt uses Circle Kit actual fields when legacy fees.total is unavailable", () => {
  const amounts = gatewayTransferAmounts(
    {
      amount: "1",
      actualFeeStatus: "actual",
      actualGatewayFee: 0.5,
      actualSourceDebit: 1.5,
      fees: {},
    },
    "receipt",
  );
  assert.equal(amounts.actualFeeStatus, "actual");
  assert.equal(amounts.gatewayFee, 0.5);
  assert.equal(amounts.sourceDebit, 1.5);
});

test("same-chain receipt omits transfer fee and keeps forwarding fee mode-specific", () => {
  assert.deepEqual(
    gatewayReceiptFeeComponents({
      sourceChain: "baseSepolia",
      destinationChain: "baseSepolia",
      forwarding: false,
    }),
    ["Gateway base fee"],
  );
  assert.deepEqual(
    gatewayReceiptFeeComponents({
      sourceChain: "baseSepolia",
      destinationChain: "baseSepolia",
      forwarding: true,
    }),
    ["Gateway base fee", "forwarding fee"],
  );
  assert.deepEqual(
    gatewayReceiptFeeComponents({
      sourceChain: "baseSepolia",
      destinationChain: "arcTestnet",
      forwarding: true,
    }),
    ["Gateway base fee", "transfer fee", "forwarding fee"],
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
