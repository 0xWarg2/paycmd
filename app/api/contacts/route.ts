import { NextRequest, NextResponse } from "next/server";

import { normalizeChain } from "@/lib/paycmd/chains";
import { isEvmAddress } from "@/lib/paycmd/recipients";
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
    .from("contacts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contacts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const displayName = String(body.displayName ?? body.name ?? "").trim();
  const walletAddress = String(body.walletAddress ?? body.address ?? "").trim();
  const preferredChain = normalizeChain(body.preferredChain ?? body.chain) || "arcTestnet";

  if (!displayName || !walletAddress) {
    return NextResponse.json(
      { error: "displayName and walletAddress are required" },
      { status: 400 },
    );
  }

  if (!isEvmAddress(walletAddress)) {
    return NextResponse.json({ error: "Invalid EVM wallet address" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: user.id,
      display_name: displayName,
      wallet_address: walletAddress,
      preferred_chain: preferredChain,
      role: body.role ?? null,
      label: body.label ?? null,
      metadata: {},
      status: "active",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contact: data }, { status: 201 });
}
