import { NextRequest, NextResponse } from "next/server";

import { requestLocale } from "@/lib/i18n/server";
import { normalizeChain } from "@/lib/paycmd/chains";
import { resolveRecipient } from "@/lib/paycmd/recipients";
import { createClient } from "@/lib/supabase/server";

async function getOwnWalletAddress(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: wallets, error } = await supabase
    .from("wallets")
    .select("address, wallet_address")
    .eq("user_id", userId)
    .eq("type", "sca")
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const wallet = wallets?.[0];
  const address = wallet?.address ?? wallet?.wallet_address;

  if (!address) {
    throw new Error("Create your wallet first with /wallet create");
  }

  return address as string;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("payment_requests")
    .select("*")
    .or(`requester_user_id.eq.${user.id},payer_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: NextRequest) {
  const locale = requestLocale(req);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const amount = String(body.amount ?? "").trim();
    const payerInput = String(body.payer ?? body.from ?? "").trim();
    const destinationChain = normalizeChain(body.destinationChain ?? body.chain) || "arcTestnet";

    if (!amount || Number(amount) <= 0 || !payerInput) {
      return NextResponse.json(
        { error: "amount and payer are required" },
        { status: 400 },
      );
    }

    const recipientAddress = await getOwnWalletAddress(supabase, user.id);
    let payerContactId: string | null = null;
    let payerLabel = payerInput;

    try {
      const payer = await resolveRecipient(supabase, user.id, payerInput, destinationChain, locale);
      payerContactId = payer.contactId;
      payerLabel = payer.label;
    } catch {
      payerLabel = payerInput;
    }

    const { data, error } = await supabase
      .from("payment_requests")
      .insert({
        requester_user_id: user.id,
        payer_contact_id: payerContactId,
        amount: Number(amount),
        token: "USDC",
        destination_chain: destinationChain,
        recipient_address: recipientAddress,
        payer_label: payerLabel,
        memo: body.memo ?? null,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const url = new URL(`/pay/request/${data.id}`, req.url).toString();
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;

    return NextResponse.json({
      request: data,
      paymentUrl: url,
      qrImageUrl,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create payment request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
