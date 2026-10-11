import "server-only";
import { TransactionNotFoundError, TransactionReceiptNotFoundError } from "viem";
import { createAdminClient } from "../supabase/admin";
import { arcPaymentReceiptOutcome, assertArcPaymentTransaction, type ArcWalletPayment } from "./arc-payment";
import { paymentNetworkOf, validateArcPaymentRpc } from "./arc-payment-server";

export async function reconcileArcPayment(payment: ArcWalletPayment): Promise<ArcWalletPayment> {
  if (!payment.tx_hash || payment.status !== "submitted") return payment;
  const network = paymentNetworkOf(payment);
  const client = await validateArcPaymentRpc(network);
  try {
    const tx = await client.getTransaction({ hash: payment.tx_hash });
    assertArcPaymentTransaction(payment, tx);
    const receipt = await client.getTransactionReceipt({ hash: payment.tx_hash });
    const status = arcPaymentReceiptOutcome(payment, receipt);
    const { data, error } = await createAdminClient().from("arc_wallet_payments").update({
      status, settled_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      error_message: status === "failed" ? "Transaction reverted onchain." : null,
    }).eq("id", payment.id).eq("user_id", payment.user_id).eq("status", "submitted").select("*").maybeSingle();
    if (error) throw new Error("Could not save the verified receipt. Check status again.");
    return (data as ArcWalletPayment | null) ?? payment;
  } catch (error) {
    // Missing receipt means pending. RPC outages and mismatched transactions stay unverified;
    // never turn them into success, or a retryable failure that could send a second payment.
    if (error instanceof TransactionNotFoundError || error instanceof TransactionReceiptNotFoundError) return payment;
    throw error;
  }
}
