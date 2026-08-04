import type { GroundedDocument, KnowledgeRoute, SourceRetrieval } from "./knowledge-types.ts";
import { buildSafeSearchQuery } from "./web3-expert.ts";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const MIN_RELEVANCE_SCORE = 0.45;

type TavilyResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  score?: unknown;
  published_date?: unknown;
};

function unavailable(error: SourceRetrieval["error"]): SourceRetrieval {
  return { source: "web", documents: [], available: false, error };
}

function normalizeResult(result: TavilyResult): GroundedDocument | null {
  if (typeof result.url !== "string" || !result.url.startsWith("https://")) return null;
  if (typeof result.content !== "string" || !result.content.trim()) return null;
  const score = typeof result.score === "number" ? result.score : 0;
  if (score < MIN_RELEVANCE_SCORE) return null;

  return {
    source: "web",
    title: typeof result.title === "string" && result.title.trim() ? result.title.trim() : new URL(result.url).hostname,
    url: result.url,
    content: result.content.replace(/\s+/g, " ").trim().slice(0, 2_000),
    score,
    publishedAt: typeof result.published_date === "string" ? result.published_date : undefined,
  };
}

export async function searchTavily(
  input: string,
  route: KnowledgeRoute,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<SourceRetrieval> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return unavailable("not_configured");

  const safe = buildSafeSearchQuery(input);
  if (safe.blocked) return unavailable("blocked");

  const body: Record<string, unknown> = {
    query: safe.query,
    search_depth: "basic",
    max_results: 5,
    include_answer: false,
    include_raw_content: false,
    topic: route.live ? "news" : "general",
  };
  if (route.live) body.time_range = "week";

  try {
    const response = await (options.fetchImpl ?? fetch)(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });

    if (response.status === 401 || response.status === 403) return unavailable("unauthorized");
    if (response.status === 429) return unavailable("rate_limited");
    if (!response.ok) return unavailable("upstream");

    const data = await response.json().catch(() => ({})) as { results?: TavilyResult[] };
    const documents = (Array.isArray(data.results) ? data.results : [])
      .map(normalizeResult)
      .filter((document): document is GroundedDocument => document !== null)
      .slice(0, 4);

    return { source: "web", documents, available: documents.length > 0 };
  } catch (error) {
    return unavailable(error instanceof Error && error.name === "TimeoutError" ? "timeout" : "upstream");
  }
}
