import assert from "node:assert/strict";
import test from "node:test";

import { classifyKnowledgeRequest } from "./web3-expert.ts";
import { searchTavily } from "./tavily.ts";

function withTavilyKey<T>(value: string | undefined, run: () => Promise<T>) {
  const previous = process.env.TAVILY_API_KEY;
  if (value === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = value;
  return run().finally(() => {
    if (previous === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = previous;
  });
}

test("sends a cost-bounded Tavily request and keeps only useful HTTPS results", async () => {
  await withTavilyKey("test-key", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (url, init) => {
      requestUrl = String(url);
      requestInit = init;
      return new Response(JSON.stringify({
        results: [
          { title: "Ethereum docs", url: "https://ethereum.org/docs", content: "Ethereum documentation result", score: 0.91 },
          { title: "Low score", url: "https://example.com/low", content: "Not relevant enough", score: 0.2 },
          { title: "Unsafe", url: "http://example.com/http", content: "Plain HTTP", score: 0.99 },
          { title: "Empty", url: "https://example.com/empty", content: "", score: 0.99 },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const result = await searchTavily(
      "Giải thích Ethereum rollup",
      classifyKnowledgeRequest("Giải thích Ethereum rollup"),
      { fetchImpl },
    );

    assert.equal(requestUrl, "https://api.tavily.com/search");
    assert.equal(new Headers(requestInit?.headers).get("Authorization"), "Bearer test-key");
    assert.deepEqual(JSON.parse(String(requestInit?.body)), {
      query: "Giải thích Ethereum rollup",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      topic: "general",
    });
    assert.deepEqual(result.documents, [{
      source: "web",
      title: "Ethereum docs",
      url: "https://ethereum.org/docs",
      content: "Ethereum documentation result",
      score: 0.91,
      publishedAt: undefined,
    }]);
    assert.equal(result.available, true);
  });
});

test("uses news search for live questions and preserves publication dates", async () => {
  await withTavilyKey("test-key", async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl: typeof fetch = async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        results: [{
          title: "Protocol release",
          url: "https://protocol.example/news",
          content: "A new protocol release was announced.",
          score: 0.8,
          published_date: "2026-08-03",
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const result = await searchTavily(
      "Tin mới nhất về Ethereum",
      classifyKnowledgeRequest("Tin mới nhất về Ethereum"),
      { fetchImpl },
    );

    assert.equal(body.topic, "news");
    assert.equal(body.time_range, "week");
    assert.equal(result.documents[0]?.publishedAt, "2026-08-03");
  });
});

test("degrades without a key and never calls Tavily for a secret-bearing query", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  };

  const missing = await withTavilyKey(undefined, () =>
    searchTavily("Ethereum L2", classifyKnowledgeRequest("Ethereum L2"), { fetchImpl }),
  );
  const blocked = await withTavilyKey("test-key", () =>
    searchTavily("private key của tôi là abc", classifyKnowledgeRequest("private key của tôi là abc"), { fetchImpl }),
  );

  assert.equal(calls, 0);
  assert.equal(missing.error, "not_configured");
  assert.equal(blocked.error, "blocked");
});

test("maps Tavily authentication and rate-limit failures without throwing", async () => {
  await withTavilyKey("test-key", async () => {
    const unauthorized = await searchTavily("Ethereum", classifyKnowledgeRequest("Ethereum"), {
      fetchImpl: async () => new Response("{}", { status: 401 }),
    });
    const rateLimited = await searchTavily("Ethereum", classifyKnowledgeRequest("Ethereum"), {
      fetchImpl: async () => new Response("{}", { status: 429 }),
    });

    assert.equal(unauthorized.error, "unauthorized");
    assert.equal(rateLimited.error, "rate_limited");
  });
});
