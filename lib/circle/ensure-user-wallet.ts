import { circleDeveloperSdk } from "@/lib/circle/sdk";
import { CIRCLE_CHAIN_NAMES } from "@/lib/circle/gateway-sdk";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export type CircleWalletRecord = {
  user_id: string;
  circle_wallet_id: string;
  wallet_set_id: string;
  wallet_address: string;
  address: string;
  blockchain: string;
  type: string;
  name: string;
};

export async function ensureUserCircleWallet(supabase: SupabaseClientLike, userId: string) {
  const { data: existingWallets, error: existingError } = await supabase
    .from("wallets")
    .select("circle_wallet_id, wallet_set_id, wallet_address, address, blockchain, type, name")
    .eq("user_id", userId)
    .eq("type", "sca")
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  const existingWallet = existingWallets?.[0];

  if (existingWallet) {
    return {
      wallet: existingWallet,
      created: false,
    };
  }

  const walletSetResponse = await circleDeveloperSdk.createWalletSet({
    name: `User ${userId.substring(0, 8)} - Wallet Set`,
  });

  if (!walletSetResponse.data?.walletSet) {
    throw new Error("Failed to create wallet set");
  }

  const walletSetId = walletSetResponse.data.walletSet.id;
  const walletsResponse = await circleDeveloperSdk.createWallets({
    accountType: "SCA",
    blockchains: Object.values(CIRCLE_CHAIN_NAMES),
    count: 1,
    walletSetId,
  });

  if (!walletsResponse.data?.wallets?.length) {
    throw new Error("Failed to create wallet");
  }

  const wallet = walletsResponse.data.wallets[0];
  const walletRecord: CircleWalletRecord = {
    user_id: userId,
    circle_wallet_id: wallet.id,
    wallet_set_id: walletSetId,
    wallet_address: wallet.address,
    address: wallet.address,
    blockchain: "MULTICHAIN",
    type: "sca",
    name: "Multichain Wallet",
  };

  const { data: insertedWallet, error: insertError } = await supabase
    .from("wallets")
    .insert(walletRecord)
    .select("circle_wallet_id, wallet_set_id, wallet_address, address, blockchain, type, name")
    .single();

  if (insertError) {
    throw insertError;
  }

  return {
    wallet: insertedWallet ?? walletRecord,
    created: true,
  };
}
