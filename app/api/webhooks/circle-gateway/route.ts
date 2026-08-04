import { NextRequest, NextResponse } from "next/server";

import {
  fetchCircleNotificationPublicKey,
  isCircleWebhookTestNotification,
  parseGatewayDepositFinalized,
  verifyCircleWebhookSignature,
  type CircleEnvironment,
} from "@/lib/circle/gateway-webhook";
import { GATEWAY_CHAIN_CONFIGS } from "@/lib/circle/gateway-sdk";
import {
  findPendingGatewayDepositByTxHash,
  settleGatewayDeposit,
} from "@/lib/paycmd/gateway-deposit-settlement";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function configuredEnvironment(): CircleEnvironment {
  const value = (process.env.CIRCLE_GATEWAY_ENVIRONMENT ?? "TEST").toUpperCase();
  if (value === "TEST") return "testnet";
  if (value === "LIVE") return "mainnet";
  throw new Error("CIRCLE_GATEWAY_ENVIRONMENT must be TEST or LIVE.");
}

export async function POST(req: NextRequest) {
  if (process.env.CIRCLE_GATEWAY_WEBHOOK_ENABLED === "false") {
    return NextResponse.json({ error: "Circle Gateway webhook is disabled." }, { status: 503 });
  }

  const signature = req.headers.get("x-circle-signature");
  const keyId = req.headers.get("x-circle-key-id");
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!signature || !keyId || !apiKey) {
    return NextResponse.json({ error: "Missing Circle webhook credentials." }, { status: 401 });
  }

  const rawBody = await req.text();

  try {
    const publicKey = await fetchCircleNotificationPublicKey(keyId, apiKey);
    if (!verifyCircleWebhookSignature(rawBody, signature, publicKey)) {
      return NextResponse.json({ error: "Invalid Circle webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as unknown;
    if (isCircleWebhookTestNotification(payload)) {
      return NextResponse.json({ success: true, test: true });
    }

    const event = parseGatewayDepositFinalized(payload, configuredEnvironment());
    const supabase = createAdminClient();
    const auditRow = {
      notification_id: event.notificationId,
      notification_type: "gateway.deposit.finalized",
      tx_hash: event.txHash,
      wallet_address: event.walletAddress,
      domain: event.domain,
      environment: event.environment,
      payload: event.payload,
      processing_status: "received",
    };
    const { error: auditError } = await supabase
      .from("circle_gateway_webhook_events")
      .insert(auditRow);

    if (auditError?.code === "23505") {
      const { data: existing } = await supabase
        .from("circle_gateway_webhook_events")
        .select("processing_status")
        .eq("notification_id", event.notificationId)
        .single();
      if (existing?.processing_status === "processed") {
        return NextResponse.json({ success: true, duplicate: true });
      }
    }
    if (auditError && auditError.code !== "23505") {
      throw new Error(`Failed to persist Circle webhook: ${auditError.message}`);
    }

    const deposit = await findPendingGatewayDepositByTxHash(supabase, event.txHash);
    if (!deposit) {
      await supabase
        .from("circle_gateway_webhook_events")
        .update({ processing_status: "unmatched" })
        .eq("notification_id", event.notificationId);
      // A fast-chain webhook can beat the deposit route's database insert. A retryable response
      // lets Circle deliver the same notification again; the audit row makes that retry safe.
      return NextResponse.json({ success: false, matched: false }, { status: 503 });
    }

    const expectedDomain = GATEWAY_CHAIN_CONFIGS[deposit.chain]?.domain;
    const { data: wallets, error: walletsError } = await supabase
      .from("wallets")
      .select("address, wallet_address")
      .eq("user_id", deposit.user_id)
      .eq("type", "sca");
    if (walletsError) {
      throw new Error(`Failed to verify webhook wallet: ${walletsError.message}`);
    }

    const walletMatches = (wallets ?? []).some((wallet) =>
      [wallet.address, wallet.wallet_address]
        .filter(Boolean)
        .some((address) => address.toLowerCase() === event.walletAddress.toLowerCase()),
    );
    const amountMatches = Number(deposit.amount) === Number(event.amount);
    if (expectedDomain !== event.domain || !walletMatches || !amountMatches) {
      await supabase
        .from("circle_gateway_webhook_events")
        .update({
          processing_status: "failed",
          error_message: "Webhook evidence did not match deposit domain, wallet, and amount.",
        })
        .eq("notification_id", event.notificationId);
      return NextResponse.json({ error: "Circle webhook does not match deposit." }, { status: 409 });
    }

    const locale = process.env.PAYCMD_DEFAULT_LOCALE === "en" ? "en" : "vi";
    const settled = await settleGatewayDeposit({
      supabase,
      deposit,
      locale,
      source: "circle_webhook",
      finalizedAt: event.timestamp,
      notificationId: event.notificationId,
    });

    await supabase
      .from("circle_gateway_webhook_events")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("notification_id", event.notificationId);

    return NextResponse.json({ success: true, matched: true, settled: Boolean(settled) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Circle webhook processing failed.";
    console.error("Circle Gateway webhook failed:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
