import assert from "node:assert/strict";
import test from "node:test";

import { askResearch, assembleResearchContext } from "./research.ts";
import type { KnowledgeBundle } from "./knowledge-types.ts";

const groundedBundle: KnowledgeBundle = {
  route: { topics: ["circle", "arc"], requiresKnowledge: true, live: false },
  status: "verified",
  sources: ["circle", "arc"],
  documents: [
    {
      source: "circle",
      title: "Circle Gateway",
      url: "https://developers.circle.com/gateway",
      content: "Gateway offers a unified USDC balance.",
    },
    {
      source: "arc",
      title: "Arc docs",
      url: "https://docs.arc.io/overview",
      content: "Arc is an L1 designed for stablecoin finance.",
    },
  ],
  citations: [
    { title: "Circle Gateway", url: "https://developers.circle.com/gateway", source: "circle" },
    { title: "Arc docs", url: "https://docs.arc.io/overview", source: "arc" },
  ],
};

test("injects wallet observations for transfer guidance without making them citations", async () => {
  const result = await assembleResearchContext({
    input: "Làm sao gửi 50 USDC sang Arc nhanh nhất?",
    knowledge: {
      route: { topics: ["circle", "arc"], requiresKnowledge: true, live: false },
      documents: [],
      citations: [
        { title: "Gateway", url: "https://developers.circle.com/gateway", source: "circle" },
        { title: "Arc", url: "https://docs.arc.io/arc-chain", source: "arc" },
      ],
      sources: ["circle", "arc"],
      status: "verified",
    },
    walletContext: {
      gateway: [{ chain: "baseSepolia", readyUsdc: "50" }],
      circleSca: [],
      externalWallets: [{ provider: "metamask", address: "0x2222222222222222222222222222222222222222", chain: "baseSepolia", usdc: "30" }],
      unavailable: [],
      status: "verified",
      observedAt: "2026-08-07T00:00:00.000Z",
    },
  });

  assert.match(result.promptContext, /Gateway ready/);
  assert.match(result.promptContext, /MetaMask/);
  assert.equal(result.citations.some((citation) => String(citation.source) === "wallet"), false);
});

test("grounds the DeepSeek prompt and returns only retrieval citations", async () => {
  let messages: Array<{ role: string; content: string }> = [];
  const result = await askResearch(
    { input: "Circle Gateway trên Arc", locale: "vi", surfMode: "research", effort: "standard" },
    {
      gatherKnowledge: async () => groundedBundle,
      askDeepSeek: async (request) => {
        messages = request.messages;
        return { text: "# Gateway trên Arc\n\n## Tổng quan\nCâu trả lời.\n\n## Related Questions\n- CCTP là gì?", reasoning: "", model: request.model };
      },
    },
  );

  assert.equal(messages.some((message) => message.content.includes("UNTRUSTED RETRIEVED EVIDENCE")), true);
  assert.equal(messages.some((message) => message.content.includes("Gateway offers a unified USDC balance")), true);
  assert.deepEqual(result.citations, groundedBundle.citations);
  assert.equal(result.groundingStatus, "verified");
  assert.deepEqual(result.knowledgeSources, ["circle", "arc"]);
});

test("appends point-in-time wallet evidence after official evidence and discloses availability", async () => {
  let messages: Array<{ role: string; content: string }> = [];
  const result = await askResearch(
    {
      input: "Làm sao gửi 50 USDC sang Arc nhanh nhất?",
      locale: "vi",
      walletContext: {
        gateway: [{ chain: "baseSepolia", readyUsdc: "50", pendingUsdc: "5" }],
        circleSca: [],
        externalWallets: [{
          provider: "metamask",
          address: "0x2222222222222222222222222222222222222222",
          chain: "baseSepolia",
          usdc: "30",
          nativeBalance: "0.1",
        }],
        unavailable: [],
        status: "verified",
        observedAt: "2026-08-07T00:00:00.000Z",
      },
    },
    {
      gatherKnowledge: async () => groundedBundle,
      askDeepSeek: async (request) => {
        messages = request.messages;
        return {
          text: "# Gửi USDC sang Arc\n\n## Lộ trình\nĐây là hướng dẫn, không phải giao dịch.\n\n## Related Questions\n- Gateway là gì?",
          reasoning: "",
          model: request.model,
        };
      },
    },
  );

  const prompt = messages.map((message) => message.content).join("\n");
  assert.equal(prompt.indexOf("Gateway offers a unified USDC balance") < prompt.indexOf("UNTRUSTED AUTHENTICATED WALLET OBSERVATIONS"), true);
  assert.match(prompt, /point-in-time/i);
  assert.match(prompt, /not web citations/i);
  assert.match(prompt, /never add or otherwise combine them/i);
  assert.match(prompt, /shorten public addresses/i);
  assert.equal(result.walletContextStatus, "verified");
  assert.deepEqual(result.citations, groundedBundle.citations);
  assert.equal("draft" in result, false);
});

test("shortens full wallet addresses in model context, answers, and persisted reasoning", async () => {
  const fullAddress = "0x2222222222222222222222222222222222222222";
  const shortenedAddress = "0x2222…2222";
  const officialAddress = "0x3333333333333333333333333333333333333333";
  let prompt = "";
  const result = await askResearch(
    {
      input: "What is my USDC balance?",
      locale: "en",
      walletContext: {
        gateway: [],
        circleSca: [{ chain: "baseSepolia", address: fullAddress, usdc: "25" }],
        externalWallets: [{ provider: "metamask", address: fullAddress, chain: "baseSepolia", usdc: "30" }],
        unavailable: [],
        status: "verified",
        observedAt: "2026-08-07T00:00:00.000Z",
      },
    },
    {
      gatherKnowledge: async () => groundedBundle,
      askDeepSeek: async (request) => {
        prompt = request.messages.map((message) => message.content).join("\n");
        return {
          text: `# Balance\n\n## Wallet\nWallet ${fullAddress}; official contract ${officialAddress}.\n\n## Related Questions\n- What is Gateway?`,
          reasoning: `The observed wallet is ${fullAddress}; the unrelated official contract is ${officialAddress}.`,
          model: request.model,
        };
      },
    },
  );

  assert.doesNotMatch(prompt, new RegExp(fullAddress));
  assert.match(prompt, new RegExp(shortenedAddress));
  assert.doesNotMatch(result.assistantText, new RegExp(fullAddress));
  assert.match(result.assistantText, new RegExp(shortenedAddress));
  assert.doesNotMatch(result.reasoning ?? "", new RegExp(fullAddress));
  assert.match(result.reasoning ?? "", new RegExp(shortenedAddress));
  assert.match(result.assistantText, new RegExp(officialAddress));
  assert.match(result.reasoning ?? "", new RegExp(officialAddress));
});

test("does not fall back to static or model-authored links when retrieval is unavailable", async () => {
  let systemPrompt = "";
  const unavailable: KnowledgeBundle = {
    route: { topics: ["web3", "live"], requiresKnowledge: true, live: true },
    status: "unavailable",
    sources: [],
    documents: [],
    citations: [],
  };

  const result = await askResearch(
    { input: "Tin Ethereum mới nhất", locale: "vi" },
    {
      gatherKnowledge: async () => unavailable,
      askDeepSeek: async (request) => {
        systemPrompt = request.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");
        return {
          text: "# Ethereum\n\n## Trạng thái\nChưa xác minh. ![chart](https://made-up.example/chart.png)\n\n## Related Questions\n- Ethereum là gì?",
          reasoning: "",
          model: request.model,
        };
      },
    },
  );

  assert.equal(systemPrompt.includes("Grounding status: unavailable"), true);
  assert.equal(systemPrompt.includes(new Date().toISOString().slice(0, 10)), true);
  assert.deepEqual(result.citations, []);
  assert.equal(result.assistantText.includes("made-up.example"), false);
  assert.equal(result.groundingStatus, "unavailable");
});
