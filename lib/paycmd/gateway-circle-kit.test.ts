import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  assertCircleKitMintGasMode,
  circleKitOperationFingerprint,
  circleKitQuoteFingerprint,
  circleKitQuoteMatches,
  circleKitSpendStepHasOnlyContractSigners,
  circleKitSupportedMintGasModes,
  isCircleKitGatewayChain,
  type CircleKitUnifiedEstimate,
} from "../circle/unified-balance-kit.ts";

function estimateBase(): Omit<CircleKitUnifiedEstimate, "quoteFingerprint" | "quoteExpiresAt"> {
  return {
    engine: "circle_kit",
    sourceMode: "unified",
    allocationPolicy: "circle_auto",
    authorizationMode: "sca_erc1271",
    amount: "5",
    destinationChain: "baseSepolia",
    recipient: "0x1234567890abcdef1234567890abcdef12345678",
    quoteSubject: "a".repeat(64),
    fundingFingerprint: "b".repeat(64),
    totalConfirmedBalance: "10",
    eligibleConfirmedBalance: "10",
    balanceBreakdown: [],
    fees: [{ type: "gasFee", token: "USDC", amount: "0.01" }],
    totalEstimatedFee: "0.01",
    feeToleranceBps: 500,
    maximumTotalFee: "0.0105",
    estimatedSourceDebit: "5.01",
    maximumSourceDebit: "5.0105",
    mintGasMode: "manual",
    forwarding: false,
    manualMintSupported: true,
    supportedMintGasModes: ["auto_forwarding", "manual"],
  };
}

test("Circle Kit allowlist excludes Gateway chains without approved SCA support", () => {
  for (const chain of [
    "arcTestnet",
    "arbitrumSepolia",
    "avalancheFuji",
    "baseSepolia",
    "sepolia",
    "optimismSepolia",
    "polygonAmoy",
    "unichainSepolia",
  ]) {
    assert.equal(isCircleKitGatewayChain(chain), true);
  }
  for (const chain of ["hyperEvmTestnet", "seiAtlantic", "sonicTestnet", "worldChainSepolia"]) {
    assert.equal(isCircleKitGatewayChain(chain), false);
  }
});

test("Arc Unified Balance derives destination forwarding from Circle Kit capability metadata", () => {
  assert.deepEqual(circleKitSupportedMintGasModes("arcTestnet"), ["auto_forwarding", "manual"]);
  assert.equal(assertCircleKitMintGasMode("arcTestnet", "manual"), "manual");
  assert.equal(assertCircleKitMintGasMode("arcTestnet", "auto_forwarding"), "auto_forwarding");
});

test("Circle quote fingerprint allows a signed five-percent fee tolerance", () => {
  const issuedAt = 1_800_000_000_000;
  const signingKey = "unit-test-gateway-quote-key";
  const base = estimateBase();
  const quoteFingerprint = circleKitQuoteFingerprint(base, issuedAt, signingKey);
  const estimate: CircleKitUnifiedEstimate = {
    ...base,
    quoteFingerprint,
    quoteExpiresAt: new Date(issuedAt + 60_000).toISOString(),
  };
  assert.equal(circleKitQuoteMatches(quoteFingerprint, estimate, issuedAt + 59_999, signingKey), true);
  assert.equal(circleKitQuoteMatches(quoteFingerprint, estimate, issuedAt + 60_001, signingKey), false);
  assert.equal(circleKitQuoteMatches(quoteFingerprint, {
    ...estimate,
    totalEstimatedFee: "0.0105",
  }, issuedAt + 1_000, signingKey), true);
  assert.equal(circleKitQuoteMatches(quoteFingerprint, {
    ...estimate,
    totalEstimatedFee: "0.010501",
  }, issuedAt + 1_000, signingKey), false);
  assert.equal(circleKitQuoteMatches(quoteFingerprint, {
    ...estimate,
    quoteSubject: "c".repeat(64),
  }, issuedAt + 1_000, signingKey), false);
  assert.equal(circleKitQuoteMatches(quoteFingerprint, {
    ...estimate,
    fundingFingerprint: "d".repeat(64),
  }, issuedAt + 1_000, signingKey), false);
  assert.equal(circleKitQuoteMatches(quoteFingerprint, estimate, issuedAt + 1_000, "wrong-key"), false);
});

test("operation identity is bound to the authenticated user and normalized money request", () => {
  const base = {
    userId: "11111111-1111-4111-8111-111111111111",
    amount: "5.000000",
    recipient: "0x1234567890abcdef1234567890abcdef12345678" as const,
    destinationChain: "arcTestnet" as const,
    mintGasMode: "auto_forwarding" as const,
  };
  assert.equal(
    circleKitOperationFingerprint(base),
    circleKitOperationFingerprint({ ...base, amount: "5" }),
  );
  assert.notEqual(
    circleKitOperationFingerprint(base),
    circleKitOperationFingerprint({ ...base, amount: "6" }),
  );
  assert.notEqual(
    circleKitOperationFingerprint(base),
    circleKitOperationFingerprint({
      ...base,
      userId: "22222222-2222-4222-8222-222222222222",
    }),
  );
});

test("Circle auto spend path omits delegate and explicit allocation fields", () => {
  const contents = readFileSync(
    path.join(process.cwd(), "lib/circle/unified-balance-kit.ts"),
    "utf8",
  );
  const spendParams = contents.slice(
    contents.indexOf("function spendParams"),
    contents.indexOf("export async function estimateCircleKitUnifiedSpend"),
  );
  assert.doesNotMatch(spendParams, /allocations\s*:/);
  assert.doesNotMatch(spendParams, /sourceAccount\s*:/);
  assert.doesNotMatch(contents, /addDelegate\s*\(/);
  assert.match(contents, /bytecode === "0x"/);
  assert.match(contents, /GATEWAY_SCA_CONTRACT_REQUIRED/);
});

test("Circle signing guard reads nested SpendStep data and rejects any EOA unit", () => {
  assert.equal(circleKitSpendStepHasOnlyContractSigners({
    name: "signBurnIntents",
    state: "success",
    data: {
      signedSetCount: 2,
      signatures: [
        { intentCount: 1, contractSigner: true },
        { intentCount: 1, contractSigner: true },
      ],
    },
  }), true);
  assert.equal(circleKitSpendStepHasOnlyContractSigners({
    name: "signBurnIntents",
    state: "success",
    data: {
      signedSetCount: 2,
      signatures: [
        { intentCount: 1, contractSigner: true },
        { intentCount: 1, contractSigner: false },
      ],
    },
  }), false);
  assert.equal(circleKitSpendStepHasOnlyContractSigners({ signatures: [{ contractSigner: true }] }), false);
});

test("Circle auto UI hides source customization and requires a quote before confirm", () => {
  const contents = readFileSync(
    path.join(process.cwd(), "components/paycmd-app.tsx"),
    "utf8",
  );
  assert.match(contents, /effectiveGatewaySourceMode === "unified"/);
  assert.doesNotMatch(contents, /UnifiedGatewaySourceSelector/);
  assert.match(contents, /effectiveGatewaySourceMode === "unified" && !gatewayEstimate\.quoteFingerprint/);
  assert.match(contents, /<ChainIcon chain=\{balance\.sourceChain\}/);
  assert.match(contents, /fee\.type === "forwarder"/);
  assert.match(contents, /formatDecimalAmount\(gatewayEstimate\.totalEstimatedFee\)/);
  assert.match(contents, /function InlineInfoPopover/);
  assert.match(contents, /aria-haspopup="dialog"/);
  assert.doesNotMatch(contents, /<div className="mt-1 text-muted-foreground">\{t\("preview\.gatewaySources\.circleAutoHelp"\)\}/);
});

test("Unified Gateway route uses the Circle Gateway logo instead of a generic chain dot", () => {
  const contents = readFileSync(
    path.join(process.cwd(), "components/chain-identity.tsx"),
    "utf8",
  );
  assert.match(contents, /chain\?\.trim\(\)\.toLowerCase\(\) === "gateway"/);
  assert.match(contents, /<CircleGatewayIcon className=\{className\} size=\{size\}/);
  assert.match(contents, /circle-aqua/);
  assert.match(contents, /circle-blue/);
});

test("Circle Kit receipts persist and display actual allocations and fees", () => {
  const route = readFileSync(
    path.join(process.cwd(), "app/api/gateway/transfer/route.ts"),
    "utf8",
  );
  const history = readFileSync(
    path.join(process.cwd(), "components/transaction-history.tsx"),
    "utf8",
  );
  assert.match(route, /gateway_fees: result\.fees \?\? null/);
  assert.match(route, /gateway_actual_fee: actualFee/);
  assert.doesNotMatch(route, /steps:\s*safeSteps/);
  assert.doesNotMatch(route, /attestation:\s*attestationHash/);
  assert.match(history, /Actual sources used/);
  assert.match(history, /Actual fee breakdown/);
  assert.match(history, /SCA · ERC-1271/);
  assert.match(history, /Circle did not return an actual fee breakdown/);
  const receipt = readFileSync(
    path.join(process.cwd(), "components/paycmd-app.tsx"),
    "utf8",
  );
  assert.match(receipt, /sourceChain: displayedSourceChain/);
  assert.match(receipt, /receipt\.gatewaySourcesUsed/);
  assert.match(receipt, /<ChainIcon chain=\{allocation\.sourceChain\}/);
  assert.match(receipt, /receipt\.estimatedFeeMeaning/);
  assert.match(receipt, /receipt\.actualFeeMeaning/);
});

test("server-side quote refresh errors are translated instead of exposing an i18n key", () => {
  const contents = readFileSync(
    path.join(process.cwd(), "lib/i18n/server.ts"),
    "utf8",
  );
  assert.equal(contents.match(/"preview\.gatewayQuoteRefreshed":/g)?.length, 2);
});

test("Manual mint recovery is private, claimed once, and never repeats the spend", () => {
  const retryRoute = readFileSync(
    path.join(process.cwd(), "app/api/gateway/transfer/retry-mint/route.ts"),
    "utf8",
  );
  const migration = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260818000000_harden_gateway_circle_kit_operations.sql"),
    "utf8",
  );
  assert.match(retryRoute, /retryCircleKitUnifiedMint\s*\(/);
  assert.doesNotMatch(retryRoute, /spendCircleKitUnified\s*\(/);
  assert.match(retryRoute, /\.is\("claimed_at", null\)/);
  assert.match(retryRoute, /GATEWAY_MINT_RECONCILIATION_REQUIRED/);
  assert.match(migration, /revoke all on table public\.gateway_operation_recovery from anon, authenticated/);
  assert.match(migration, /Invalid Circle Kit Gateway state transition/);
});
