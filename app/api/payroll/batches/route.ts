import { NextRequest, NextResponse } from "next/server";

import { normalizeChain } from "@/lib/paycmd/chains";
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
    .from("payroll_batches")
    .select("*, payroll_items(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ batches: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? `batch-${Date.now()}`).trim();
    const amount = Number(body.amount ?? 0);
    const sourceChain = normalizeChain(body.sourceChain) || "arcTestnet";

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "amount is required" }, { status: 400 });
    }

    const { data: contacts, error: contactError } = await supabase
      .from("contacts")
      .select("id, display_name, wallet_address, preferred_chain")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(25);

    if (contactError) {
      throw new Error(contactError.message);
    }

    if (!contacts?.length) {
      return NextResponse.json(
        { error: "No active contacts found for payroll" },
        { status: 400 },
      );
    }

    const { data: batch, error: batchError } = await supabase
      .from("payroll_batches")
      .insert({
        user_id: user.id,
        name,
        source_chain: sourceChain,
        status: "draft",
      })
      .select("*")
      .single();

    if (batchError) {
      throw new Error(batchError.message);
    }

    const items = contacts.map((contact) => ({
      batch_id: batch.id,
      contact_id: contact.id,
      recipient_label: contact.display_name,
      recipient_address: contact.wallet_address,
      destination_chain: contact.preferred_chain || "arcTestnet",
      amount,
      token: "USDC",
      status: "queued",
    }));

    const { data: createdItems, error: itemError } = await supabase
      .from("payroll_items")
      .insert(items)
      .select("*");

    if (itemError) {
      throw new Error(itemError.message);
    }

    return NextResponse.json({ batch, items: createdItems ?? [] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create payroll batch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
