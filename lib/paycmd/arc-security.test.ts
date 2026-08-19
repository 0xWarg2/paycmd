import assert from "node:assert/strict";
import test from "node:test";

import {
  ArcAddressSafetyError,
  assertArcAddressTransferable,
} from "./arc-security.ts";
import {
  ARC_TESTNET_CHAIN_ID,
  arcMainnetReadiness,
  assertArcNetworkEnabled,
} from "./arc-rpc.ts";

const recipient = "0x1234567890abcdef1234567890abcdef12345678";

test("Arc transfer safety fails closed for a blocklisted recipient", async () => {
  await assert.rejects(
    () => assertArcAddressTransferable(recipient, {
      getChainId: async () => ARC_TESTNET_CHAIN_ID,
      readContract: async () => true,
    } as never),
    (error) => error instanceof ArcAddressSafetyError &&
      error.code === "ARC_ADDRESS_BLOCKLISTED" &&
      error.status === 422,
  );
});

test("Arc transfer safety rejects an RPC connected to another chain", async () => {
  await assert.rejects(
    () => assertArcAddressTransferable(recipient, {
      getChainId: async () => 1,
      readContract: async () => false,
    } as never),
    (error) => error instanceof ArcAddressSafetyError &&
      error.code === "ARC_BLOCKLIST_CHECK_UNAVAILABLE" &&
      error.status === 503,
  );
});

test("Arc mainnet remains fail-closed even when its registry is populated", () => {
  const populated = Object.fromEntries([
    "ARC_MAINNET_CHAIN_ID",
    "ARC_MAINNET_RPC_URL",
    "ARC_MAINNET_EXPLORER_URL",
    "ARC_MAINNET_USDC_ADDRESS",
    "ARC_MAINNET_GATEWAY_WALLET_ADDRESS",
    "ARC_MAINNET_GATEWAY_MINTER_ADDRESS",
    "ARC_MAINNET_CCTP_DOMAIN",
    "ARC_MAINNET_TOKEN_MESSENGER_ADDRESS",
    "ARC_MAINNET_MESSAGE_TRANSMITTER_ADDRESS",
  ].map((name) => [name, "verified-value"])) as NodeJS.ProcessEnv;
  assert.equal(arcMainnetReadiness(populated).ready, true);
  assert.throws(
    () => assertArcNetworkEnabled({ ...populated, ARC_NETWORK: "mainnet" }),
    /ARC_MAINNET_NOT_ENABLED/,
  );
});
