import { createClient } from "@supabase/supabase-js";
import {
  initiateDeveloperControlledWalletsClient,
  type EvmBlockchain,
} from "@circle-fin/developer-controlled-wallets";

import {
  buildScaDerivationPlan,
  executeScaDerivationPlan,
  parseScaDerivationArgs,
  ScaDerivationApplyError,
  type CircleScaWalletIdentity,
} from "../lib/circle/sca-derivation.ts";

type DbScaWallet = {
  circle_wallet_id: string;
  wallet_set_id: string;
  address: string;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function requiredText(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Circle wallet response is missing ${field}.`);
  }
  return value;
}

function circleWalletIdentity(value: unknown): CircleScaWalletIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Circle wallet response is malformed.");
  }
  const record = value as Record<string, unknown>;
  return {
    id: requiredText(record, "id"),
    address: requiredText(record, "address"),
    blockchain: requiredText(record, "blockchain"),
    walletSetId: requiredText(record, "walletSetId"),
    accountType: requiredText(record, "accountType"),
    custodyType: requiredText(record, "custodyType"),
  };
}

function assertDatabaseIdentity(source: CircleScaWalletIdentity, row: DbScaWallet) {
  if (source.walletSetId !== row.wallet_set_id) {
    throw new Error("Circle source SCA wallet set does not match the Payna database record.");
  }
  if (source.address.toLowerCase() !== row.address.toLowerCase()) {
    throw new Error("Circle source SCA address does not match the Payna database record.");
  }
}

function printStatuses(
  heading: string,
  entries: readonly { blockchain: string; status: string }[],
) {
  console.log(heading);
  for (const entry of entries) {
    console.log(`- ${entry.blockchain}: ${entry.status} · address matched`);
  }
}

async function main() {
  const { userId, apply } = parseScaDerivationArgs(process.argv.slice(2));
  const supabase = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const circle = initiateDeveloperControlledWalletsClient({
    apiKey: requiredEnvironment("CIRCLE_API_KEY"),
    entitySecret: requiredEnvironment("CIRCLE_ENTITY_SECRET"),
  });

  const { data: databaseWallets, error: databaseError } = await supabase
    .from("wallets")
    .select("circle_wallet_id, wallet_set_id, address")
    .eq("user_id", userId)
    .eq("type", "sca")
    .limit(2);

  if (databaseError) throw databaseError;
  if (databaseWallets?.length !== 1) {
    throw new Error(`Expected exactly one Payna SCA wallet record; found ${databaseWallets?.length ?? 0}.`);
  }
  const databaseWallet = databaseWallets[0] as DbScaWallet;

  const sourceResponse = await circle.getWallet({ id: databaseWallet.circle_wallet_id });
  const source = circleWalletIdentity(sourceResponse.data?.wallet);
  assertDatabaseIdentity(source, databaseWallet);

  const listWallets = async () => {
    const response = await circle.listWallets({
      walletSetId: source.walletSetId,
      pageSize: 50,
    });
    return (response.data?.wallets ?? []).map(circleWalletIdentity);
  };

  const wallets = await listWallets();
  const preview = buildScaDerivationPlan(source, wallets);
  printStatuses(apply ? "SCA derivation apply plan:" : "SCA derivation preview:", preview);

  if (!apply) {
    console.log("Preview only. Re-run with --apply to derive missing SCA targets.");
    return;
  }

  const applied = await executeScaDerivationPlan({
    source,
    wallets,
    apply: true,
    derive: async (sourceWalletId, blockchain) => {
      const response = await circle.deriveWallet({
        id: sourceWalletId,
        blockchain: blockchain as EvmBlockchain,
      });
      return circleWalletIdentity(response.data?.wallet);
    },
  });
  printStatuses("SCA derivation results:", applied);

  const verified = buildScaDerivationPlan(source, await listWallets());
  const incomplete = verified.filter((entry) => entry.status !== "existing");
  if (incomplete.length) {
    throw new Error(
      `Circle verification is incomplete for: ${incomplete.map((entry) => entry.blockchain).join(", ")}.`,
    );
  }
  printStatuses("Verified Circle SCA targets:", verified);
}

main().catch((error: unknown) => {
  if (error instanceof ScaDerivationApplyError) {
    console.error(error.message);
    if (error.completed.length) printStatuses("Completed before failure:", error.completed);
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
});
