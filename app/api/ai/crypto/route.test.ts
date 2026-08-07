import assert from "node:assert/strict";
import test from "node:test";

import { AiAccessError, type AiQuota } from "../../../../lib/paycmd/ai/access.ts";
import type { ResearchResult } from "../../../../lib/paycmd/ai/research.ts";
import type { WalletContext } from "../../../../lib/paycmd/ai/wallet-context.ts";
import { createCryptoResearchHandler, type CryptoResearchRouteDependencies } from "./handler.ts";

const quota: AiQuota = {
  enabled: true,
  unlimited: false,
  limit: 10,
  used: 1,
  remaining: 9,
};

const researchResult: ResearchResult = {
  assistantText: "# Answer\n\n## Guidance\nRead-only guidance.\n\n## Related Questions\n- What is Gateway?",
  citations: [],
  model: "test-model",
  surfMode: "research",
  effort: "standard",
  durationMs: 1,
  groundingStatus: "not_applicable",
  knowledgeSources: [],
};

const walletContext: WalletContext = {
  gateway: [{ chain: "baseSepolia", readyUsdc: "50" }],
  circleSca: [],
  externalWallets: [],
  unavailable: [],
  status: "verified",
  observedAt: "2026-08-07T00:00:00.000Z",
};

function request(input = "What is Gateway?") {
  return new Request("http://localhost/api/ai/crypto", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, locale: "en" }),
  });
}

function dependencies(options: {
  userId?: string | null;
  quotaDenied?: boolean;
  relevant?: boolean;
  events: string[];
}): CryptoResearchRouteDependencies {
  return {
    createClient: async () => ({
      auth: {
        getUser: async () => {
          options.events.push("auth");
          return { data: { user: options.userId === null ? null : { id: options.userId ?? "user-1" } } };
        },
      },
    }),
    runWithQuota: async (_client, call) => {
      options.events.push("quota");
      if (options.quotaDenied) {
        throw new AiAccessError("AI free quota exhausted", 429, "AI_QUOTA_EXHAUSTED", quota);
      }
      return { result: await call(), quota };
    },
    walletContextRelevant: () => {
      options.events.push("relevance");
      return options.relevant ?? false;
    },
    loadWalletContext: async (userId) => {
      options.events.push(`wallet:${userId}`);
      return walletContext;
    },
    research: async (researchOptions) => {
      options.events.push(`research:${researchOptions.walletContext?.status ?? "none"}`);
      return {
        ...researchResult,
        walletContextStatus: researchOptions.walletContext?.status,
      };
    },
  };
}

test("rejects an unauthenticated request before quota, relevance, or wallet reads", async () => {
  const events: string[] = [];
  const handler = createCryptoResearchHandler(dependencies({ userId: null, events }));

  const response = await handler(request("What is my balance?"));

  assert.equal(response.status, 401);
  assert.deepEqual(events, ["auth"]);
});

test("stops a quota-denied request before relevance or wallet reads", async () => {
  const events: string[] = [];
  const handler = createCryptoResearchHandler(dependencies({ quotaDenied: true, relevant: true, events }));

  const response = await handler(request("What is my balance?"));

  assert.equal(response.status, 429);
  assert.deepEqual(events, ["auth", "quota"]);
});

test("runs irrelevant research without loading authenticated wallet context", async () => {
  const events: string[] = [];
  const handler = createCryptoResearchHandler(dependencies({ relevant: false, events }));

  const response = await handler(request("How does Arc consensus work?"));

  assert.equal(response.status, 200);
  assert.deepEqual(events, ["auth", "quota", "relevance", "research:none"]);
  assert.equal((await response.json()).walletContextStatus, undefined);
});

test("loads relevant context with the authenticated user only after quota and relevance", async () => {
  const events: string[] = [];
  const handler = createCryptoResearchHandler(dependencies({ userId: "auth-user", relevant: true, events }));

  const response = await handler(request("Làm sao gửi 50 USDC sang Arc nhanh nhất?"));

  assert.equal(response.status, 200);
  assert.deepEqual(events, ["auth", "quota", "relevance", "wallet:auth-user", "research:verified"]);
  assert.equal((await response.json()).walletContextStatus, "verified");
});
