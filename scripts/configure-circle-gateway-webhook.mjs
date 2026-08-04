import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

import {
  buildGatewayWebhookSubscription,
  resolveGatewayWebhookSubscriptionRequest,
} from "../lib/circle/gateway-webhook.ts";

nextEnv.loadEnvConfig(process.cwd());

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  const apiKey = required("CIRCLE_API_KEY");
  const supabase = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: wallets, error } = await supabase
    .from("wallets")
    .select("address, wallet_address")
    .eq("type", "sca")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const addresses = (wallets ?? [])
    .map((wallet) => wallet.address || wallet.wallet_address)
    .filter(Boolean);
  const domains = required("CIRCLE_GATEWAY_DOMAINS")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isSafeInteger);
  const body = buildGatewayWebhookSubscription({
    environment: process.env.CIRCLE_GATEWAY_ENVIRONMENT === "LIVE" ? "LIVE" : "TEST",
    endpoint: required("CIRCLE_GATEWAY_WEBHOOK_URL"),
    addresses,
    domains,
  });

  const subscriptionId = process.env.CIRCLE_GATEWAY_WEBHOOK_SUBSCRIPTION_ID;
  const request = resolveGatewayWebhookSubscriptionRequest({
    subscriptionId,
    updateOnly: process.argv.includes("--update-only"),
  });
  const response = await fetch(request.url, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Circle subscription request failed (${response.status}): ${JSON.stringify(result)}`);
  }

  console.log(`Circle Gateway webhook subscription ready: ${result.data?.id ?? subscriptionId}`);
  console.log(`Registered ${addresses.length} SCA addresses across ${domains.length} domains.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
