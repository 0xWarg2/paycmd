import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeWalletContextStatus,
  walletContextMetadata,
  walletContextMetadataFromResearch,
} from "./wallet-context-status.ts";

const fullAddress = "0x2222222222222222222222222222222222222222";

test("persists and reloads only normalized wallet availability from a research response", () => {
  for (const status of ["verified", "partial", "unavailable"] as const) {
    const apiResponse = {
      assistantText: "Grounded guidance",
      walletContextStatus: status,
      walletContext: {
        externalWallets: [{ address: fullAddress, usdc: "30" }],
      },
    };

    const persisted = walletContextMetadataFromResearch(apiResponse);
    const reloaded = normalizeWalletContextStatus(persisted.walletContextStatus);

    assert.deepEqual(persisted, { walletContextStatus: status });
    assert.equal(reloaded, status);
    assert.equal(JSON.stringify(persisted).includes(fullAddress), false);
  }
});

test("fails closed for malformed API and stored wallet status metadata", () => {
  assert.deepEqual(walletContextMetadataFromResearch({ walletContextStatus: "ready" }), {
    walletContextStatus: null,
  });
  assert.deepEqual(walletContextMetadata("ready"), { walletContextStatus: null });
  assert.equal(normalizeWalletContextStatus({ status: "verified" }), undefined);
});
