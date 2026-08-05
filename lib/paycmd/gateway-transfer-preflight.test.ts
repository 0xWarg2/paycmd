import assert from "node:assert/strict";
import test from "node:test";

import { gatewayTransferPreflight } from "./gateway-transfer.ts";

test("unsupported Manual fails before quote and execution side effects", async () => {
  const calls: string[] = [];

  await assert.rejects(
    gatewayTransferPreflight(
      {
        amountAtomic: 1_000_000n,
        sourceChain: "baseSepolia",
        destinationChain: "seiAtlantic",
        mintGasMode: "manual",
      },
      {
        estimate: async () => {
          calls.push("estimate");
          throw new Error("must not run");
        },
      },
    ),
    (error: any) => error?.code === "GATEWAY_MANUAL_MINT_UNSUPPORTED",
  );

  assert.deepEqual(calls, []);
});

test("quote failure does not produce an execution-ready preflight", async () => {
  let executionReady = false;

  await assert.rejects(
    gatewayTransferPreflight(
      {
        amountAtomic: 1_000_000n,
        sourceChain: "baseSepolia",
        destinationChain: "arcTestnet",
        mintGasMode: "auto_forwarding",
      },
      {
        estimate: async () => {
          throw new Error("estimate unavailable");
        },
      },
    ).then(() => {
      executionReady = true;
    }),
    /estimate unavailable/,
  );

  assert.equal(executionReady, false);
});

test("successful preflight returns the authoritative reserve before execution", async () => {
  const preflight = await gatewayTransferPreflight(
    {
      amountAtomic: 1_000_000n,
      sourceChain: "baseSepolia",
      destinationChain: "baseSepolia",
      mintGasMode: "manual",
    },
    {
      estimate: async ({ forwarding }) => {
        assert.equal(forwarding, false);
        return {
          atomicFee: 3_500n,
          maxFeeAtomic: 3_850n,
          feeEstimateKind: "quoted_total",
          feeBreakdown: { baseFeeAtomic: 3_500n, totalAtomic: 3_500n },
        };
      },
    },
  );

  assert.equal(preflight.amounts.requiredGatewayBalanceAtomic, 1_003_850n);
  assert.equal(preflight.plan.destinationGasPreflight, true);
});
