import { askOpenRouter } from "@/lib/paycmd/ai/openrouter";

/*
 * Legacy AskSurf path (inactive):
 *   POST ${SURF_API_BASE_URL}/chat/completions
 *   Authorization: Bearer ${SURF_API_KEY}
 *   models: surf-1.5-instant, surf-1.5, surf-1.5-thinking
 *
 * The former AskSurf implementation also sent `ability` (search, evm_onchain,
 * solana_onchain, market_analysis, calculate) and `citation` (source, chart).
 * Keep the AskSurf UI/provider naming for continuity; see
 * docs/legacy-asksurf-api.md to restore the transport after renewing the API.
 */

export type SurfCitation = { title?: string; url?: string };
export type SurfMode = "instant" | "research";
export type SurfEffort = "standard" | "extended" | "maximum";

export type SurfResearchResult = {
  assistantText: string;
  citations: SurfCitation[];
  model: string;
  surfMode: SurfMode;
  effort: SurfEffort;
  durationMs: number;
};

type SurfResearchOptions = {
  input: string;
  recentMessages?: { role: string; text: string }[];
  surfMode?: SurfMode;
  effort?: SurfEffort;
  locale?: "vi" | "en";
};

function configuredResearchTimeoutMs() {
  const parsed = Number(process.env.OPENROUTER_RESEARCH_TIMEOUT_MS ?? 600_000);
  return Number.isFinite(parsed) && parsed >= 10_000 ? parsed : 600_000;
}

export function surfRequestProfile(mode: SurfMode, effort: SurfEffort) {
  if (mode === "instant") {
    return { model: process.env.OPENROUTER_INSTANT_MODEL ?? "inclusionai/ling-3.0-flash:free", timeoutMs: 120_000, reasoningEffort: "low" as const };
  }
  if (effort === "maximum") {
    return {
      model: process.env.OPENROUTER_MAXIMUM_MODEL ?? "poolside/laguna-s-2.1:free",
      timeoutMs: configuredResearchTimeoutMs(),
      reasoningEffort: "high" as const,
    };
  }
  return {
    model:
      effort === "extended"
        ? process.env.OPENROUTER_EXTENDED_MODEL ?? "poolside/laguna-s-2.1:free"
        : process.env.OPENROUTER_STANDARD_MODEL ?? "inclusionai/ling-3.0-flash:free",
    timeoutMs: configuredResearchTimeoutMs(),
    reasoningEffort: effort === "extended" ? "medium" as const : "low" as const,
  };
}

function compactRecentMessages(messages: { role: string; text: string }[]) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-6)
    .map((message) => ({ role: message.role === "assistant" ? "assistant" as const : "user" as const, content: message.text.replace(/\s+/g, " ").trim().slice(0, 500) }))
    .filter((message) => message.content);
}

function extractCitations(text: string): SurfCitation[] {
  const citations: SurfCitation[] = [];
  const seen = new Set<string>();
  const pattern = /!?\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (!seen.has(match[2])) {
      seen.add(match[2]);
      citations.push({ title: match[1], url: match[2] });
    }
  }
  return citations.slice(0, 8);
}

export async function askSurfResearch({ input, recentMessages = [], surfMode, effort, locale }: SurfResearchOptions) {
  const resolvedSurfMode = surfMode === "instant" ? "instant" : "research";
  const resolvedEffort = effort === "extended" || effort === "maximum" ? effort : "standard";
  const profile = surfRequestProfile(resolvedSurfMode, resolvedEffort);
  const startedAt = Date.now();
  const languageInstruction = locale === "en" ? "Write entirely in English." : "Write entirely in Vietnamese.";
  const depth = resolvedSurfMode === "instant" ? "Keep the answer concise." : resolvedEffort === "maximum" ? "Be comprehensive and nuanced." : resolvedEffort === "extended" ? "Provide a detailed answer." : "Provide a clear, useful research answer.";
  const system = [
    "You are the research engine behind the AskSurf experience in Payna, a USDC payment and Circle Gateway app.",
    languageInstruction,
    "Do not create, sign, or execute transactions. Suggest a slash command if the user wants to act in Payna.",
    "Use Markdown with a clear title, summary, relevant sections, and a short Sources section. Only cite URLs you are certain about; state clearly when current or live data is unavailable.",
    depth,
  ].join("\n\n");
  const response = await askOpenRouter({
    model: profile.model,
    messages: [{ role: "system", content: system }, ...compactRecentMessages(recentMessages), { role: "user", content: input }],
    maxTokens: resolvedSurfMode === "instant" ? 2200 : resolvedEffort === "maximum" ? 12_000 : resolvedEffort === "extended" ? 9_000 : 7_000,
    timeoutMs: profile.timeoutMs,
    reasoningEffort: profile.reasoningEffort,
  });
  return {
    assistantText: response.text,
    citations: extractCitations(response.text),
    model: response.model,
    surfMode: resolvedSurfMode,
    effort: resolvedEffort,
    durationMs: Date.now() - startedAt,
  } satisfies SurfResearchResult;
}
