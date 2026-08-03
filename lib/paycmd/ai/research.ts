import { askDeepSeek } from "@/lib/paycmd/ai/deepseek";

export type ResearchCitation = { title?: string; url?: string };
export type ResearchMode = "instant" | "research";

// Two tiers, because there are exactly two models. An earlier three-tier split (standard/extended/
// maximum) mapped two of its tiers onto the same model, so the middle tier promised depth it had no
// way to deliver. `mapLegacyEffort` below still accepts the old values.
export type ResearchEffort = "standard" | "deep";

export type ResearchResult = {
  assistantText: string;
  citations: ResearchCitation[];
  model: string;
  // Persisted as-is in `chat_messages.metadata` and read back by key name, so this stays `surfMode`
  // even though nothing else carries that name anymore. Renaming it would leave every existing row
  // without a mode, and the client would silently render no badge.
  surfMode: ResearchMode;
  effort: ResearchEffort;
  durationMs: number;
  // Absent on the instant profile, which runs with thinking off.
  reasoning?: string;
};

type ResearchOptions = {
  input: string;
  recentMessages?: { role: string; text: string }[];
  surfMode?: ResearchMode;
  effort?: ResearchEffort | "extended" | "maximum";
  locale?: "vi" | "en";
};

const RESEARCH_TIMEOUT_MS = 240_000;

function configuredResearchTimeoutMs() {
  const parsed = Number(process.env.DEEPSEEK_RESEARCH_TIMEOUT_MS ?? RESEARCH_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed >= 10_000 ? parsed : RESEARCH_TIMEOUT_MS;
}

/**
 * Accepts the pre-merge effort values. Needed at this boundary because a client that was already
 * loaded when the change deployed keeps POSTing `extended`/`maximum`, and both meant "more than
 * standard" — so they land on `deep` rather than falling back to the cheapest tier.
 */
export function mapLegacyEffort(effort: string | undefined): ResearchEffort {
  return effort === "deep" || effort === "extended" || effort === "maximum" ? "deep" : "standard";
}

export function researchRequestProfile(mode: ResearchMode, effort: ResearchEffort) {
  if (mode === "instant") {
    return {
      model: process.env.DEEPSEEK_INSTANT_MODEL ?? "deepseek-v4-flash",
      timeoutMs: 60_000,
      // Instant exists to be fast. Chain-of-thought is the opposite of that, and it would also eat
      // into the token budget the answer needs.
      thinking: false,
      maxTokens: 2_200,
    };
  }

  if (effort === "deep") {
    return {
      // Kept as its own variable so the deep tier can be pointed at flash without a deploy. Pro
      // costs about 3x flash, and DeepSeek doubles all prices during Beijing peak hours.
      model: process.env.DEEPSEEK_DEEP_MODEL ?? "deepseek-v4-pro",
      timeoutMs: configuredResearchTimeoutMs(),
      thinking: true,
      maxTokens: 12_000,
    };
  }

  return {
    model: process.env.DEEPSEEK_STANDARD_MODEL ?? "deepseek-v4-flash",
    timeoutMs: configuredResearchTimeoutMs(),
    thinking: true,
    // Budgets are well above what the answer alone needs: with thinking on, reasoning tokens are
    // drawn from this same allowance, so a budget sized for the answer can be spent entirely on
    // thinking and return nothing.
    maxTokens: 7_000,
  };
}

function compactRecentMessages(messages: { role: string; text: string }[]) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-6)
    .map((message) => ({ role: message.role === "assistant" ? "assistant" as const : "user" as const, content: message.text.replace(/\s+/g, " ").trim().slice(0, 500) }))
    .filter((message) => message.content);
}

const TRUSTED_SOURCES = {
  circleGateway: { title: "Circle Gateway documentation", url: "https://developers.circle.com/gateway" },
  circleCctp: { title: "Circle CCTP documentation", url: "https://developers.circle.com/cctp" },
  circleUsdc: { title: "Circle USDC documentation", url: "https://developers.circle.com/stablecoins" },
  ethereum: { title: "Ethereum.org", url: "https://ethereum.org/en/" },
  uniswap: { title: "Uniswap documentation", url: "https://docs.uniswap.org/" },
  coingecko: { title: "CoinGecko API documentation", url: "https://docs.coingecko.com/" },
  defillama: { title: "DefiLlama protocol data", url: "https://defillama.com/" },
} satisfies Record<string, Required<ResearchCitation>>;

function trustedCitations(input: string): ResearchCitation[] {
  const query = input.toLowerCase();
  if (/\b(gateway|circle gateway|deposit|withdraw)\b/.test(query)) {
    return [TRUSTED_SOURCES.circleGateway, TRUSTED_SOURCES.circleUsdc];
  }
  if (/\b(cctp|bridge|burn|mint)\b/.test(query)) {
    return [TRUSTED_SOURCES.circleCctp, TRUSTED_SOURCES.circleUsdc];
  }
  if (/\b(swap|uniswap|amm|dex)\b/.test(query)) {
    return [TRUSTED_SOURCES.uniswap, TRUSTED_SOURCES.defillama];
  }
  if (/\b(price|market|token|coin|crypto|tvl|volume)\b/.test(query)) {
    return [TRUSTED_SOURCES.coingecko, TRUSTED_SOURCES.defillama];
  }
  return [TRUSTED_SOURCES.ethereum, TRUSTED_SOURCES.coingecko];
}

function removeUnverifiedLinks(text: string) {
  // DeepSeek has no browsing tool in this integration. Do not render a plausible-looking URL that
  // it generated from model memory: it can be stale or a 404. The verified source rail below is
  // built only from the canonical URLs in TRUSTED_SOURCES.
  return text
    .replace(/(?<!!)\[([^\]]+)\]\(https?:\/\/[^)\s]+\)/g, "$1")
    .replace(/\bhttps?:\/\/[^\s)<]+/g, "")
    .replace(/[ \t]+\n/g, "\n");
}

export async function askResearch({ input, recentMessages = [], surfMode, effort, locale }: ResearchOptions) {
  const resolvedSurfMode = surfMode === "instant" ? "instant" : "research";
  const resolvedEffort = mapLegacyEffort(effort);
  const profile = researchRequestProfile(resolvedSurfMode, resolvedEffort);
  const startedAt = Date.now();
  const languageInstruction = locale === "en" ? "Write entirely in English." : "Write entirely in Vietnamese.";
  const depth = resolvedSurfMode === "instant" ? "Keep the answer concise." : resolvedEffort === "deep" ? "Be comprehensive and nuanced." : "Provide a clear, useful research answer.";
  const system = [
    "You are the research engine behind the research mode in Payna, a USDC payment and Circle Gateway app.",
    languageInstruction,
    "Do not create, sign, or execute transactions. Suggest a slash command if the user wants to act in Payna.",
    // Every line below is load-bearing for a renderer in components/paycmd-app.tsx, and the vague
    // "clear title, summary, relevant sections, Sources" this replaced satisfied none of them — which
    // is why the section nav, the citation card, the table controls, and the related-question pills
    // had never once rendered. Keep these in sync with the parsers, not just with what reads nicely.
    "Structure the answer in Markdown exactly like this:",
    "- One `#` line for the title, and nothing else at level 1.",
    "- Each section starts with `##`. Use `###` only for subsections.",
    "- Do not write URLs, Markdown links, or a Sources section. Payna attaches verified canonical references separately.",
    "- When comparing numbers, chains, or options, use a Markdown table with a `|---|---|` alignment row.",
    "- End with a `## Related Questions` heading (keep that heading in English) followed by 3 to 5 `-` bullets.",
    "State clearly when current or live data is unavailable.",
    depth,
  ].join("\n\n");
  const response = await askDeepSeek({
    model: profile.model,
    messages: [{ role: "system", content: system }, ...compactRecentMessages(recentMessages), { role: "user", content: input }],
    maxTokens: profile.maxTokens,
    timeoutMs: profile.timeoutMs,
    thinking: profile.thinking,
  });
  return {
    assistantText: removeUnverifiedLinks(response.text),
    citations: trustedCitations(input),
    model: response.model,
    surfMode: resolvedSurfMode,
    effort: resolvedEffort,
    durationMs: Date.now() - startedAt,
    reasoning: response.reasoning || undefined,
  } satisfies ResearchResult;
}
