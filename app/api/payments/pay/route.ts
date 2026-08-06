import { NextRequest, NextResponse } from "next/server";

import { requestLocale, tr } from "@/lib/i18n/server";
import {
  PaymentChainValidationError,
  requirePaymentChains,
} from "@/lib/paycmd/payment-chains";
import { resolveInternalWalletOwner, resolveRecipient } from "@/lib/paycmd/recipients";
import {
  gatewayPaymentEstimateFields,
  gatewayUnifiedRequestFields,
} from "@/lib/paycmd/gateway-transfer-request";
import { recordRaReceipt, updateRaProofColumns } from "@/lib/ra/receipt-registry";
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

async function getSenderLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null },
) {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, handle")
    .eq("user_id", user.id)
    .maybeSingle();

  return profile?.display_name?.trim() || profile?.handle?.trim() || user.email || "Payna user";
}

async function notifyPaymentRecipient(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  recipientUserId: string | null;
  senderLabel: string;
  amount: string;
  destinationChain: string;
  locale: ReturnType<typeof requestLocale>;
  metadata: Record<string, unknown>;
}) {
  if (!params.recipientUserId) return;

  const { error } = await params.supabase.rpc("create_payment_received_notification", {
    p_recipient_user_id: params.recipientUserId,
    p_sender_label: params.senderLabel,
    p_amount: params.amount,
    p_chain: params.destinationChain,
    p_title: tr(params.locale, "notifications.paymentReceivedTitle"),
    p_body: tr(params.locale, "notifications.paymentReceivedBody", {
      sender: params.senderLabel,
      amount: params.amount,
      chain: params.destinationChain,
    }),
    p_metadata: params.metadata,
  });

  if (error) {
    console.warn("Could not notify payment recipient.", error.message);
  }
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
    const recipientInput = String(body.recipient ?? "").trim();

    if (!amount || Number(amount) <= 0 || !recipientInput) {
      return NextResponse.json(
        { error: "amount and recipient are required" },
        { status: 400 },
      );
    }

    const paymentChains = requirePaymentChains({
      sourceMode: body.sourceMode,
      sourceChain: body.sourceChain,
      destinationChain: body.destinationChain,
    });
    const { sourceChain, destinationChain } = paymentChains;
    const sourceMode = "sourceMode" in paymentChains ? paymentChains.sourceMode : "scoped";

    const recipient = await resolveRecipient(
      supabase,
      user.id,
      recipientInput,
      destinationChain,
      locale,
    );

    if (body.estimateOnly === true) {
      const estimateResponse = await fetch(new URL("/api/gateway/transfer/estimate", req.url), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify(gatewayPaymentEstimateFields(body, recipient.address)),
      });
      const estimate = await estimateResponse.json().catch(() => ({}));
      return NextResponse.json(estimate, { status: estimateResponse.status });
    }

    const directRecipientUserId =
      recipient.contactUserId ||
      (recipient.resolution === "direct"
        ? await resolveInternalWalletOwner(supabase, recipient.address, locale).catch(() => null)
        : null);

    const transfer = await callGatewayTransfer(req, {
      sourceMode,
      sourceChain,
      destinationChain: recipient.destinationChain,
      amount,
      recipientAddress: recipient.address,
      autoDeposit: false,
      mintGasMode: body.mintGasMode ?? "auto_forwarding",
      selectedSourceChains: body.selectedSourceChains,
      ...gatewayUnifiedRequestFields(body),
      skipReceipt: true,
    });

    if (body.preflightOnly === true && transfer.valid === true) {
      return NextResponse.json(transfer);
    }

    let proof:
      | Awaited<ReturnType<typeof recordRaReceipt>>
      | undefined;
    const transferTransactionId =
      typeof transfer.transactionId === "string" ? transfer.transactionId : null;

    if (transferTransactionId) {
      try {
        proof = await recordRaReceipt({
          action: "pay",
          userAddress: typeof transfer.sourceWalletAddress === "string" ? transfer.sourceWalletAddress : undefined,
          recipientAddress: recipient.address,
          amount,
          sourceChain: sourceChain ?? "gateway",
          destinationChain: recipient.destinationChain,
          sourceTxHash: typeof transfer.autoDepositTxHash === "string" ? transfer.autoDepositTxHash : undefined,
          destinationTxHash:
            typeof transfer.destinationTxHash === "string"
              ? transfer.destinationTxHash
              : typeof transfer.mintTxHash === "string"
                ? transfer.mintTxHash
                : undefined,
          metadata: {
            transactionHistoryId: transferTransactionId,
            recipientLabel: recipient.label,
            recipientResolution: recipient.resolution,
            recipientUserId: directRecipientUserId,
            transferId: typeof transfer.transferId === "string" ? transfer.transferId : null,
            forwarding: Boolean(transfer.forwarding),
            mintGasMode: transfer.mintGasMode ?? null,
          },
        });
        await updateRaProofColumns({ supabase, transactionId: transferTransactionId, result: proof });
      } catch (proofError) {
        console.warn("Failed to record Payna payment proof.", proofError);
        await updateRaProofColumns({
          supabase,
          transactionId: transferTransactionId,
          result: { enabled: false, status: "skipped", reason: "proof write failed" },
          error: proofError,
        });
      }
    }

    if (proof?.enabled) {
      transfer.proofTxHash = proof.txHash;
      transfer.proofStatus = proof.status;
      transfer.proofContractAddress = proof.contractAddress;
    }

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

    await notifyPaymentRecipient({
      supabase,
      recipientUserId: directRecipientUserId,
      senderLabel: await getSenderLabel(supabase, user),
      amount,
      destinationChain: recipient.destinationChain,
      locale,
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
        sourceMode,
        destinationChain: recipient.destinationChain,
        recipient,
      },
      transfer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed";

    if (error instanceof PaymentChainValidationError) {
      return NextResponse.json({ error: message, field: error.field }, { status: 400 });
    }

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
