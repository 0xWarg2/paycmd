import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../../app/api/gateway/transfer/route.ts", import.meta.url);

test("Gateway quote failure returns before signer creation or balance mutation", async () => {
  const source = await readFile(routeUrl, "utf8");
  const quote = source.indexOf("await estimateGatewayTransferFee(");
  const unavailableReturn = source.indexOf('error: "GATEWAY_FEE_ESTIMATE_UNAVAILABLE"', quote);
  const signerCreation = source.indexOf("await getOrCreateGatewayEOAWallet", quote);
  const balanceRead = source.indexOf("await getSourceGatewayBalance", quote);
  const deposit = source.indexOf("await initiateDepositFromCustodialWallet", quote);
  const burn = source.indexOf("await transferGatewayBalanceWithEOA", quote);

  assert.ok(quote >= 0);
  assert.ok(unavailableReturn > quote);
  assert.ok(signerCreation > unavailableReturn);
  assert.ok(balanceRead > unavailableReturn);
  assert.ok(deposit > unavailableReturn);
  assert.ok(burn > unavailableReturn);
});

test("transfer route does not override forwarding for equal chains", async () => {
  const source = await readFile(routeUrl, "utf8");

  assert.match(source, /const useForwarding = executionPlan\.forwarding/);
  assert.doesNotMatch(source, /sourceChain\s*!==\s*destinationChain.*forward/i);
});
