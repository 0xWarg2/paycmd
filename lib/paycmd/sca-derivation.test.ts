import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScaDerivationPlan,
  executeScaDerivationPlan,
  parseScaDerivationArgs,
  validateDerivedScaWallet,
  type CircleScaWalletIdentity,
} from "../circle/sca-derivation.ts";

const SOURCE_ADDRESS = "0x1111111111111111111111111111111111111111";
const OTHER_ADDRESS = "0x2222222222222222222222222222222222222222";
const USER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const source: CircleScaWalletIdentity = {
  id: "11111111-1111-4111-8111-111111111111",
  address: SOURCE_ADDRESS,
  blockchain: "ARC-TESTNET",
  walletSetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  accountType: "SCA",
  custodyType: "DEVELOPER",
};

const arbSca: CircleScaWalletIdentity = {
  ...source,
  id: "22222222-2222-4222-8222-222222222222",
  blockchain: "ARB-SEPOLIA",
};

const opSca: CircleScaWalletIdentity = {
  ...source,
  id: "33333333-3333-4333-8333-333333333333",
  blockchain: "OP-SEPOLIA",
};

test("plans all four reviewed SCA targets when none are derived", () => {
  assert.deepEqual(buildScaDerivationPlan(source, [source]), [
    { blockchain: "ARB-SEPOLIA", status: "missing" },
    { blockchain: "OP-SEPOLIA", status: "missing" },
    { blockchain: "MATIC-AMOY", status: "missing" },
    { blockchain: "UNI-SEPOLIA", status: "missing" },
  ]);
});

test("skips matching SCA targets and rejects a conflicting target identity", () => {
  assert.equal(buildScaDerivationPlan(source, [source, arbSca])[0]?.status, "existing");

  assert.throws(
    () =>
      buildScaDerivationPlan(source, [
        source,
        {
          ...arbSca,
          address: OTHER_ADDRESS,
        },
      ]),
    /conflicting SCA identity for ARB-SEPOLIA/,
  );
});

test("ignores the expected EOA record when planning an SCA on the same blockchain", () => {
  const plan = buildScaDerivationPlan(source, [
    source,
    {
      ...arbSca,
      accountType: "EOA",
    },
  ]);

  assert.equal(plan[0]?.status, "missing");
});

test("rejects a derived SCA response whose identity differs from the source", () => {
  assert.throws(
    () => validateDerivedScaWallet(source, "OP-SEPOLIA", { ...opSca, address: OTHER_ADDRESS }),
    /address/,
  );
  assert.throws(
    () => validateDerivedScaWallet(source, "OP-SEPOLIA", { ...opSca, accountType: "EOA" }),
    /account type/,
  );
  assert.throws(
    () => validateDerivedScaWallet(source, "OP-SEPOLIA", { ...opSca, walletSetId: "other-set" }),
    /wallet set/,
  );
  assert.throws(
    () => validateDerivedScaWallet(source, "OP-SEPOLIA", { ...opSca, custodyType: "ENDUSER" }),
    /custody type/,
  );
  assert.throws(
    () => validateDerivedScaWallet(source, "OP-SEPOLIA", { ...opSca, blockchain: "ARB-SEPOLIA" }),
    /blockchain/,
  );
});

test("accepts a derived SCA with the same identity on the requested blockchain", () => {
  assert.deepEqual(validateDerivedScaWallet(source, "OP-SEPOLIA", opSca), opSca);
});

test("parses a required user UUID and keeps preview as the default mode", () => {
  assert.deepEqual(parseScaDerivationArgs(["--user-id", USER_ID]), {
    userId: USER_ID,
    apply: false,
  });
  assert.deepEqual(parseScaDerivationArgs(["--user-id", USER_ID, "--apply"]), {
    userId: USER_ID,
    apply: true,
  });
  assert.throws(() => parseScaDerivationArgs(["--apply"]), /--user-id/);
  assert.throws(() => parseScaDerivationArgs(["--user-id", "not-a-uuid"]), /UUID/);
  assert.throws(() => parseScaDerivationArgs(["--user-id", USER_ID, "--all"]), /Unknown argument/);
});

test("preview reports missing targets without calling the Circle derive dependency", async () => {
  let calls = 0;
  const preview = await executeScaDerivationPlan({
    source,
    wallets: [source],
    apply: false,
    derive: async () => {
      calls += 1;
      return opSca;
    },
  });

  assert.equal(calls, 0);
  assert.deepEqual(preview, [
    { blockchain: "ARB-SEPOLIA", status: "missing" },
    { blockchain: "OP-SEPOLIA", status: "missing" },
    { blockchain: "MATIC-AMOY", status: "missing" },
    { blockchain: "UNI-SEPOLIA", status: "missing" },
  ]);
});

test("apply stops on the first Circle failure and reports earlier derived targets", async () => {
  const calls: string[] = [];

  await assert.rejects(
    () =>
      executeScaDerivationPlan({
        source,
        wallets: [source],
        apply: true,
        derive: async (_sourceWalletId, blockchain) => {
          calls.push(blockchain);
          if (blockchain === "OP-SEPOLIA") {
            throw new Error("Circle unavailable");
          }
          return {
            ...source,
            id: `derived-${blockchain}`,
            blockchain,
          };
        },
      }),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      const derivationError = error as Error & {
        blockchain?: string;
        completed?: unknown[];
      };
      assert.match(derivationError.message, /OP-SEPOLIA/);
      assert.equal(derivationError.blockchain, "OP-SEPOLIA");
      assert.deepEqual(derivationError.completed, [
        { blockchain: "ARB-SEPOLIA", status: "derived" },
      ]);
      return true;
    },
  );

  assert.deepEqual(calls, ["ARB-SEPOLIA", "OP-SEPOLIA"]);
});
