import { NextRequest, NextResponse } from "next/server";
import { verifyMessage, type Hex } from "viem";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertArcPaymentFunds, paymentOwnershipMessage, type ArcWalletPayment } from "@/lib/paycmd/arc-payment";
import { arcWalletClient, assertArcWalletPaymentsEnabled, paymentNetworkOf, quoteArcPayment } from "@/lib/paycmd/arc-payment-server";
import { reconcileArcPayment } from "@/lib/paycmd/arc-payment-store";

export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), signature: z.string().regex(/^0x[\da-fA-F]{130}$/) }),
  z.object({ action: z.literal("submit"), txHash: z.string().regex(/^0x[\da-fA-F]{64}$/) }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("sync") }),
]);

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update this payment." }, { status: 401 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid payment ID." }, { status: 400 });
  const input = schema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid payment action." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("arc_wallet_payments").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Payment storage unavailable." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  let payment = data as ArcWalletPayment;
  try {
    const network = paymentNetworkOf(payment);
    const body = input.data;
    if (body.action === "sync") {
      return NextResponse.json({ payment: await reconcileArcPayment(payment) });
    }
    if (body.action === "submit") {
      // Always accept recovery of an already authorized broadcast, even when the kill switch
      // is off or the preview has expired. It must still be verified on the original chain.
      if (payment.tx_hash && payment.tx_hash.toLowerCase() !== body.txHash.toLowerCase()) return NextResponse.json({ error: "Payment already has a different transaction hash." }, { status: 409 });
      if (payment.status === "signing") {
        const result = await admin.from("arc_wallet_payments").update({ status: "submitted", tx_hash: body.txHash.toLowerCase(), updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).eq("status", "signing").select("*").maybeSingle();
        if (result.error || !result.data) return NextResponse.json({ error: "Could not save transaction hash. Keep the hash and retry status sync." }, { status: 409 });
        payment = result.data as ArcWalletPayment;
      } else if (!payment.tx_hash) {
        return NextResponse.json({ error: "Payment must be confirmed before recording a transaction." }, { status: 409 });
      }
      // Store hash before any RPC operation, so an outage cannot erase the broadcast.
      return NextResponse.json({ payment });
    }
    if (body.action === "reject") {
      if (payment.tx_hash || payment.status !== "signing") return NextResponse.json({ error: "A broadcast payment cannot be cancelled." }, { status: 409 });
      const result = await admin.from("arc_wallet_payments").update({ status: "rejected", error_message: "Wallet signing was rejected before broadcast.", updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).eq("status", "signing").is("tx_hash", null).select("*").maybeSingle();
      if (result.error || !result.data) return NextResponse.json({ error: "Payment state changed; reload history." }, { status: 409 });
      return NextResponse.json({ payment: result.data });
    }
    assertArcWalletPaymentsEnabled(network);
    if (payment.status !== "prepared") return NextResponse.json({ error: "This payment is already processing or completed. Check its status." }, { status: 409 });
    if (Date.parse(payment.expires_at) <= Date.now()) return NextResponse.json({ error: "Preview expired. Prepare a fresh preview." }, { status: 409 });
    const verified = await verifyMessage({ address: payment.sender, message: paymentOwnershipMessage(payment), signature: body.signature as Hex });
    if (!verified) return NextResponse.json({ error: "Wallet signature does not authorize this payment." }, { status: 403 });
    const quote = await quoteArcPayment(network, payment.sender, payment.recipient, BigInt(payment.amount_units));
    if (BigInt(quote.gas) > BigInt(payment.gas_limit) || BigInt(quote.maxFeePerGas) > BigInt(payment.max_fee_per_gas)) return NextResponse.json({ error: "Fees changed. Prepare a fresh preview before confirming." }, { status: 409 });
    const nativeBalance = await arcWalletClient(network).getBalance({ address: payment.sender, blockTag: "pending" });
    assertArcPaymentFunds(BigInt(payment.amount_units), BigInt(quote.balance), nativeBalance,
      BigInt(payment.gas_limit) * BigInt(payment.max_fee_per_gas));
    const result = await admin.from("arc_wallet_payments").update({ status: "signing", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).eq("status", "prepared").gt("expires_at", new Date().toISOString()).select("*").maybeSingle();
    if (result.error || !result.data) return NextResponse.json({ error: "A payment from this wallet is already in progress, or this preview expired. Check history before sending again." }, { status: 409 });
    return NextResponse.json({ payment: result.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment status unavailable." }, { status: 503 });
  }
}
