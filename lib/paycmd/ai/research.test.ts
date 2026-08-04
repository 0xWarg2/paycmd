import assert from "node:assert/strict";
import test from "node:test";

import { askResearch } from "./research.ts";
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
