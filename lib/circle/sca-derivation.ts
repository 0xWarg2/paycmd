export const SCA_DERIVATION_TARGETS = [
  "ARB-SEPOLIA",
  "OP-SEPOLIA",
  "MATIC-AMOY",
  "UNI-SEPOLIA",
] as const;

export type ScaDerivationTarget = (typeof SCA_DERIVATION_TARGETS)[number];

export type CircleScaWalletIdentity = {
  id: string;
  address: string;
  blockchain: string;
  walletSetId: string;
  accountType: string;
  custodyType: string;
};

export type ScaDerivationPlanEntry = {
  blockchain: ScaDerivationTarget;
  status: "existing" | "missing";
};

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function assertSourceSca(source: CircleScaWalletIdentity) {
  if (!source.id || !source.walletSetId) {
    throw new Error("Source SCA identity is missing an internal wallet or wallet set identifier.");
  }
  if (!EVM_ADDRESS_PATTERN.test(source.address)) {
    throw new Error("Source SCA address is not a valid EVM address.");
  }
  if (source.accountType !== "SCA") {
    throw new Error("Source wallet account type must be SCA.");
  }
  if (source.custodyType !== "DEVELOPER") {
    throw new Error("Source wallet custody type must be DEVELOPER.");
  }
}

function walletConflictReason(
  source: CircleScaWalletIdentity,
  wallet: CircleScaWalletIdentity,
): string | null {
  if (wallet.accountType !== "SCA") return "account type does not match";
  if (wallet.custodyType !== "DEVELOPER") return "custody type does not match";
  if (wallet.walletSetId !== source.walletSetId) return "wallet set does not match";
  if (wallet.address.toLowerCase() !== source.address.toLowerCase()) return "address does not match";
  return null;
}

export function buildScaDerivationPlan(
  source: CircleScaWalletIdentity,
  walletSet: readonly CircleScaWalletIdentity[],
): ScaDerivationPlanEntry[] {
  assertSourceSca(source);

  return SCA_DERIVATION_TARGETS.map((blockchain) => {
    const targetWallets = walletSet.filter((wallet) => wallet.blockchain === blockchain);
    for (const wallet of targetWallets) {
      const conflict = walletConflictReason(source, wallet);
      if (conflict) {
        throw new Error(`Found conflicting SCA identity for ${blockchain}: ${conflict}.`);
      }
    }

    return {
      blockchain,
      status: targetWallets.length > 0 ? "existing" : "missing",
    };
  });
}

export function validateDerivedScaWallet(
  source: CircleScaWalletIdentity,
  expectedBlockchain: ScaDerivationTarget,
  derived: CircleScaWalletIdentity,
): CircleScaWalletIdentity {
  assertSourceSca(source);

  if (derived.blockchain !== expectedBlockchain) {
    throw new Error(
      `Derived SCA blockchain mismatch: expected ${expectedBlockchain}, received ${derived.blockchain}.`,
    );
  }
  if (derived.accountType !== "SCA") {
    throw new Error(`Derived wallet account type must be SCA on ${expectedBlockchain}.`);
  }
  if (derived.custodyType !== "DEVELOPER") {
    throw new Error(`Derived wallet custody type must be DEVELOPER on ${expectedBlockchain}.`);
  }
  if (derived.walletSetId !== source.walletSetId) {
    throw new Error(`Derived SCA wallet set does not match the source on ${expectedBlockchain}.`);
  }
  if (!EVM_ADDRESS_PATTERN.test(derived.address)) {
    throw new Error(`Derived SCA address is invalid on ${expectedBlockchain}.`);
  }
  if (derived.address.toLowerCase() !== source.address.toLowerCase()) {
    throw new Error(`Derived SCA address does not match the source on ${expectedBlockchain}.`);
  }
  if (!derived.id) {
    throw new Error(`Derived SCA wallet identifier is missing on ${expectedBlockchain}.`);
  }

  return derived;
}
