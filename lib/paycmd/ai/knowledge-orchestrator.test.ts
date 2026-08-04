import assert from "node:assert/strict";
import test from "node:test";

import {
  formatKnowledgeContext,
  gatherKnowledge,
  type KnowledgeDependencies,
} from "./knowledge-orchestrator.ts";
import type { KnowledgeSource, SourceRetrieval } from "./knowledge-types.ts";

function result(source: KnowledgeSource, title: string, url: string, content = `${title} content`): SourceRetrieval {
  return { source, available: true, documents: [{ source, title, url, content }] };
}

test("runs Circle and Arc retrieval in parallel for a mixed question", async () => {
  const started: string[] = [];
  let releaseCircle!: () => void;
  let releaseArc!: () => void;
  const circleGate = new Promise<void>((resolve) => { releaseCircle = resolve; });
  const arcGate = new Promise<void>((resolve) => { releaseArc = resolve; });

  const deps: KnowledgeDependencies = {
    circle: async () => {
      started.push("circle");
      await circleGate;
      return result("circle", "Gateway", "https://developers.circle.com/gateway");
    },
    arc: async () => {
      started.push("arc");
      await arcGate;
      return result("arc", "Arc", "https://docs.arc.io/overview");
    },
  };

  const pending = gatherKnowledge({ input: "Circle Gateway trên Arc thế nào?", locale: "vi" }, deps);
  await Promise.resolve();
  assert.deepEqual(started.sort(), ["arc", "circle"]);
  releaseCircle();
  releaseArc();

  const bundle = await pending;
  assert.equal(bundle.status, "verified");
  assert.deepEqual(bundle.sources, ["circle", "arc"]);
  assert.deepEqual(bundle.citations, [
    { title: "Gateway", url: "https://developers.circle.com/gateway", source: "circle", publishedAt: undefined },
    { title: "Arc", url: "https://docs.arc.io/overview", source: "arc", publishedAt: undefined },
  ]);
});

test("skips retrieval for unrelated conversation and blocks secrets before external calls", async () => {
  let webCalls = 0;
  const deps: KnowledgeDependencies = {
    web: async () => {
      webCalls += 1;
      return result("web", "Ethereum", "https://ethereum.org");
    },
  };

  const unrelated = await gatherKnowledge({ input: "Viết email xin nghỉ phép", locale: "vi" }, deps);
  const blocked = await gatherKnowledge({ input: "Ethereum private key và seed phrase của tôi", locale: "vi" }, deps);

  assert.equal(webCalls, 0);
  assert.equal(unrelated.status, "not_applicable");
  assert.equal(blocked.status, "unavailable");
});

test("reports partial and unavailable grounding without failing the whole request", async () => {
  const partial = await gatherKnowledge(
    { input: "Circle Gateway trên Arc", locale: "vi" },
    {
      circle: async () => result("circle", "Gateway", "https://developers.circle.com/gateway"),
      arc: async () => ({ source: "arc", available: false, documents: [], error: "timeout" }),
    },
  );
  const unavailable = await gatherKnowledge(
    { input: "Ethereum L2", locale: "vi" },
    { web: async () => ({ source: "web", available: false, documents: [], error: "rate_limited" }) },
  );

  assert.equal(partial.status, "partial");
  assert.deepEqual(partial.sources, ["circle"]);
  assert.equal(unavailable.status, "unavailable");
  assert.deepEqual(unavailable.citations, []);
});

test("deduplicates citations and caps evidence at eight URLs and 12000 characters", async () => {
  const web: KnowledgeDependencies["web"] = async () => ({
    source: "web",
    available: true,
    documents: Array.from({ length: 10 }, (_, index) => ({
      source: "web" as const,
      title: `Source ${index}`,
      url: index === 9 ? "https://example.com/0" : `https://example.com/${index}`,
      content: "evidence ".repeat(260),
      score: 0.9 - index / 100,
    })),
  });

  const bundle = await gatherKnowledge({ input: "Ethereum L2", locale: "en" }, { web });
  const context = formatKnowledgeContext(bundle);

  assert.equal(bundle.citations.length, 8);
  assert.equal(new Set(bundle.citations.map((citation) => citation.url)).size, 8);
  assert.equal(context.length <= 12_000, true);
  assert.equal(context.includes("UNTRUSTED RETRIEVED EVIDENCE"), true);
});
