import { NextRequest, NextResponse } from "next/server";

import { normalizeChain } from "@/lib/paycmd/chains";
import { createClient } from "@/lib/supabase/server";

async function callGatewayTransfer(req: NextRequest, payload: Record<string, unknown>) {
  const response = await fetch(new URL("/api/gateway/transfer", req.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message ?? data?.error ?? `Gateway transfer failed: ${response.status}`);
  }

  return data;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { data: paymentRequest, error } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!paymentRequest) {
      return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
    }

    if (paymentRequest.status !== "pending") {
      return NextResponse.json({ error: `Request is ${paymentRequest.status}` }, { status: 400 });
    }

    const sourceChain = normalizeChain(body.sourceChain) || paymentRequest.destination_chain;
    const transfer = await callGatewayTransfer(req, {
      sourceChain,
      destinationChain: paymentRequest.destination_chain,
      amount: String(paymentRequest.amount),
      recipientAddress: paymentRequest.recipient_address,
      autoDeposit: true,
    });

    await supabase
      .from("payment_requests")
      .update({
        status: "paid",
        payer_user_id: user.id,
        paid_tx_hash: transfer.mintTxHash ?? transfer.txHash ?? null,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "payment_request_paid",
      title: "Payment request paid",
      body: `${paymentRequest.amount} USDC paid on ${paymentRequest.destination_chain}.`,
      status: "unread",
      metadata: { requestId: id, transfer },
    });

    return NextResponse.json({
      success: true,
      requestId: id,
      transfer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
