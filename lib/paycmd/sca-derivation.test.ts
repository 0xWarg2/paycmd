import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScaDerivationPlan,
  validateDerivedScaWallet,
  type CircleScaWalletIdentity,
} from "../circle/sca-derivation.ts";

const SOURCE_ADDRESS = "0x1111111111111111111111111111111111111111";
const OTHER_ADDRESS = "0x2222222222222222222222222222222222222222";

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
