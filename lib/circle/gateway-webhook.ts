import { createPublicKey, verify } from "node:crypto";

const notificationPublicKeys = new Map<string, string>();

export type CircleEnvironment = "testnet" | "mainnet";

export type GatewayDepositFinalizedEvent = {
  notificationId: string;
  subscriptionId: string;
  txHash: string;
  walletAddress: string;
  domain: number;
  environment: CircleEnvironment;
  amount: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

export function buildGatewayWebhookSubscription(input: {
  environment: "TEST" | "LIVE";
  endpoint: string;
  addresses: string[];
  domains: number[];
}) {
  const addressMap = new Map<string, string>();
  for (const address of input.addresses) {
    const normalized = address.toLowerCase();
    if (!addressMap.has(normalized)) addressMap.set(normalized, address);
  }
  const addresses = [...addressMap.values()];
  const domains = [...new Set(input.domains)].map(String);

  if (!input.endpoint.startsWith("https://")) {
    throw new Error("Circle Gateway webhook endpoint must use HTTPS.");
  }
  if (addresses.length === 0 || addresses.length > 50) {
    throw new Error("Circle Gateway webhook subscriptions require 1-50 wallet addresses.");
  }

  return {
    environment: input.environment,
    endpoint: input.endpoint,
    addresses,
    domains,
    name: "Payna Gateway deposits",
    enabled: true,
    notificationTypes: ["gateway.deposit.finalized"],
  } as const;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid Circle webhook field: ${field}`);
  }
  return value;
}

export function isCircleWebhookTestNotification(input: unknown) {
  if (!input || typeof input !== "object") return false;
  return (input as Record<string, unknown>).notificationType === "webhooks.test";
}

export type GatewayWebhookDepositDisposition =
  | "retry"
  | "settle"
  | "already_settled"
  | "reject";

export function classifyGatewayWebhookDeposit(
  status: string | null,
): GatewayWebhookDepositDisposition {
  if (status === null) return "retry";
  if (status === "pending_gateway_finality") return "settle";
  if (status === "success") return "already_settled";
  return "reject";
}

const CIRCLE_GATEWAY_SUBSCRIPTIONS_URL =
  "https://api.circle.com/v2/notifications/subscriptions/permissionless";

export function resolveGatewayWebhookSubscriptionRequest({
  subscriptionId,
  updateOnly,
}: {
  subscriptionId?: string;
  updateOnly: boolean;
}) {
  const normalizedSubscriptionId = subscriptionId?.trim();
  if (updateOnly && !normalizedSubscriptionId) {
    throw new Error(
      "CIRCLE_GATEWAY_WEBHOOK_SUBSCRIPTION_ID is required in update-only mode.",
    );
  }

  return normalizedSubscriptionId
    ? {
        method: "PATCH" as const,
        url: `${CIRCLE_GATEWAY_SUBSCRIPTIONS_URL}/${normalizedSubscriptionId}`,
      }
    : { method: "POST" as const, url: CIRCLE_GATEWAY_SUBSCRIPTIONS_URL };
}

export function parseGatewayDepositFinalized(
  input: unknown,
  expectedEnvironment: CircleEnvironment,
): GatewayDepositFinalizedEvent {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid Circle webhook payload");
  }

  const payload = input as Record<string, unknown>;
  if (payload.notificationType !== "gateway.deposit.finalized") {
    throw new Error("Unsupported Circle notification type");
  }

  const notification = payload.notification;
  if (!notification || typeof notification !== "object") {
    throw new Error("Invalid Circle webhook notification");
  }

  const detail = notification as Record<string, unknown>;
  const environment = requiredString(detail.env, "notification.env") as CircleEnvironment;
  if (environment !== expectedEnvironment) {
    throw new Error("Circle webhook environment does not match this deployment");
  }

  const domainText = requiredString(detail.domain, "notification.domain");
  const domain = Number(domainText);
  if (!Number.isSafeInteger(domain) || domain < 0) {
    throw new Error("Invalid Circle webhook field: notification.domain");
  }

  return {
    notificationId: requiredString(payload.notificationId, "notificationId"),
    subscriptionId: requiredString(payload.subscriptionId, "subscriptionId"),
    txHash: requiredString(detail.txHash, "notification.txHash"),
    walletAddress: requiredString(detail.walletAddress, "notification.walletAddress"),
    domain,
    environment,
    amount: requiredString(detail.amount, "notification.amount"),
    timestamp: requiredString(payload.timestamp, "timestamp"),
    payload,
  };
}

export function verifyCircleWebhookSignature(
  rawBody: string,
  signatureBase64: string,
  publicKeyBase64: string,
) {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, "base64"),
      format: "der",
      type: "spki",
    });

    return verify(
      "sha256",
      Buffer.from(rawBody),
      publicKey,
      Buffer.from(signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}

export async function fetchCircleNotificationPublicKey(
  keyId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
) {
  const cached = notificationPublicKeys.get(keyId);
  if (cached) return cached;

  const response = await fetchImpl(
    `https://api.circle.com/v2/notifications/publicKey/${encodeURIComponent(keyId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Circle public-key request failed with status ${response.status}`);
  }

  const json = (await response.json()) as {
    data?: { algorithm?: string; publicKey?: string };
  };
  if (json.data?.algorithm !== "ECDSA_SHA_256" || !json.data.publicKey) {
    throw new Error("Circle returned an unsupported notification signing key");
  }

  notificationPublicKeys.set(keyId, json.data.publicKey);
  return json.data.publicKey;
}
