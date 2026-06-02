import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("wallets")
    .select("id, circle_wallet_id, wallet_set_id, wallet_address, address, blockchain, type, name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const wallets = data ?? [];
  const scaWallet = wallets.find((wallet) => wallet.type === "sca") ?? null;
  const gatewaySigner = wallets.find((wallet) => wallet.type === "gateway_signer") ?? null;

  return NextResponse.json({
    success: true,
    hasWallet: Boolean(scaWallet),
    scaWallet,
    gatewaySigner,
    wallets,
  });
}
