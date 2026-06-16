import { NextRequest, NextResponse } from "next/server";

import { normalizeChain } from "@/lib/paycmd/chains";
import { resolveRecipient } from "@/lib/paycmd/recipients";
import { createClient } from "@/lib/supabase/server";

type GatewayTransferErrorBody = Record<string, unknown> & {
  error?: string;
  message?: string;
};

class GatewayTransferError extends Error {
  data: GatewayTransferErrorBody;
  status: number;

  constructor(message: string, status: number, data: GatewayTransferErrorBody) {
    super(message);
    this.name = "GatewayTransferError";
    this.status = status;
    this.data = data;
  }
}

async function callGatewayTransfer(req: NextRequest, payload: Record<string, unknown>) {
  const response = await fetch(new URL("/api/gateway/transfer", req.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as GatewayTransferErrorBody;

  if (!response.ok) {
    const message = data?.message ?? data?.error ?? `Gateway transfer failed: ${response.status}`;
    throw new GatewayTransferError(message, response.status, data);
  }

  return data;
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
    const amount = String(body.amount ?? "").trim();
    const recipientInput = String(body.recipient ?? "").trim();
    const sourceChain = normalizeChain(body.sourceChain) || "arcTestnet";

    if (!amount || Number(amount) <= 0 || !recipientInput) {
      return NextResponse.json(
        { error: "amount and recipient are required" },
        { status: 400 },
      );
    }

    const recipient = await resolveRecipient(
      supabase,
      user.id,
      recipientInput,
      body.destinationChain ?? body.chain,
    );

    const transfer = await callGatewayTransfer(req, {
      sourceChain,
      destinationChain: recipient.destinationChain,
      amount,
      recipientAddress: recipient.address,
      autoDeposit: true,
      mintGasMode: body.mintGasMode ?? "auto_forwarding",
    });

    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "payment_success",
      title: `Paid ${recipient.label}`,
      body: `${amount} USDC sent to ${recipient.label} on ${recipient.destinationChain}.`,
      status: "unread",
      metadata: {
        recipient,
        transfer,
      },
    });

    return NextResponse.json({
      success: true,
      payment: {
        amount: Number(amount),
        token: "USDC",
        sourceChain,
        destinationChain: recipient.destinationChain,
        recipient,
      },
      transfer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed";

    if (error instanceof GatewayTransferError) {
      return NextResponse.json(
        {
          ...error.data,
          message,
        },
        { status: error.status },
      );
    }

    const status =
      message.startsWith("Contact not found:") ||
      message.startsWith("Internal contact ")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
