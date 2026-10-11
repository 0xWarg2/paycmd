import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { arcWalletNetworks, parseArcWalletPayment, paymentOwnershipMessage, requireArcPaymentNetwork, type ArcWalletPayment } from "@/lib/paycmd/arc-payment";
import { quoteArcPayment } from "@/lib/paycmd/arc-payment-server";

export const runtime = "nodejs";
const schema = z.object({ network: z.enum(["mainnet", "testnet"]), command: z.string().max(500), sender: z.string(), requestKey: z.uuid() });

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view payment history." }, { status: 401 });
  try {
    const network = requireArcPaymentNetwork(req.nextUrl.searchParams.get("network"));
    const { data, error } = await supabase.from("arc_wallet_payments").select("*").eq("user_id", user.id).eq("network", network).order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "Arc payment history is unavailable. Apply the database migration first." }, { status: 503 });
    return NextResponse.json({ payments: data, userId: user.id, network });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid network." }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in before preparing a payment." }, { status: 401 });
  const input = schema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
  const body = input.data;
  try {
    const draft = parseArcWalletPayment(body.command, body.network);
    const admin = createAdminClient();
    const existing = await admin.from("arc_wallet_payments").select("*").eq("user_id", user.id).eq("request_key", body.requestKey).maybeSingle();
    if (existing.error) throw new Error("Payment storage is unavailable. Apply the database migration first.");
    if (existing.data) {
      const payment = existing.data as ArcWalletPayment;
      if (payment.network !== body.network || payment.sender.toLowerCase() !== body.sender.toLowerCase() || payment.recipient.toLowerCase() !== draft.recipient.toLowerCase() || payment.amount_units !== draft.units.toString()) return NextResponse.json({ error: "Idempotency key belongs to a different payment." }, { status: 409 });
      return NextResponse.json({ payment, ownershipMessage: paymentOwnershipMessage(payment) });
    }
    const quote = await quoteArcPayment(body.network, body.sender, draft.recipient, draft.units);
    const { data, error } = await admin.from("arc_wallet_payments").insert({
      user_id: user.id, request_key: body.requestKey, network: body.network,
      chain_id: arcWalletNetworks[body.network].chainId, sender: quote.sender, recipient: draft.recipient,
      amount: draft.fields.amount, amount_units: draft.units.toString(), call_data: quote.data,
      gas_limit: quote.gas, max_fee_per_gas: quote.maxFeePerGas, max_priority_fee_per_gas: quote.maxPriorityFeePerGas,
      expires_at: new Date(Date.now() + 120_000).toISOString(),
    }).select("*").single();
    // A duplicate request may win the INSERT race. The caller can recover with the same key.
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Payment already prepared; retry preview with the same request." : "Could not save payment preview." }, { status: 409 });
    const payment = data as ArcWalletPayment;
    return NextResponse.json({ payment, ownershipMessage: paymentOwnershipMessage(payment) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment preview unavailable." }, { status: 422 });
  }
}
