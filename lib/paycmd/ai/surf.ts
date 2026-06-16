export type SurfCitation = {
  title?: string;
  url?: string;
};

export type SurfMode = "instant" | "research";
export type SurfEffort = "standard" | "extended" | "maximum";
type SurfReasoningEffort = "low" | "medium" | "high";

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
};

function surfBaseUrl() {
  return (process.env.SURF_API_BASE_URL ?? "https://api.asksurf.ai/gateway/v1").replace(/\/+$/, "");
}

function normalizeSurfMode(value: unknown): SurfMode {
  return value === "instant" || value === "research" ? value : "research";
}

function normalizeSurfEffort(value: unknown): SurfEffort {
  return value === "standard" || value === "extended" || value === "maximum" ? value : "standard";
}

function configuredResearchTimeoutMs() {
  const parsed = Number(process.env.SURF_TIMEOUT_MS ?? 600_000);
  return Number.isFinite(parsed) && parsed >= 10_000 ? parsed : 600_000;
}

export function surfRequestProfile(mode: SurfMode, effort: SurfEffort) {
  if (mode === "instant") {
    return {
      model: "surf-1.5-instant",
      reasoningEffort: "low" as SurfReasoningEffort,
      timeoutMs: 120_000,
    };
  }

  if (effort === "maximum") {
    return {
      model: "surf-1.5-thinking",
      reasoningEffort: "high" as SurfReasoningEffort,
      timeoutMs: configuredResearchTimeoutMs(),
    };
  }

  return {
    model: "surf-1.5",
    reasoningEffort: effort === "extended" ? "high" as SurfReasoningEffort : "medium" as SurfReasoningEffort,
    timeoutMs: configuredResearchTimeoutMs(),
  };
}

function compactRecentMessages(messages: { role: string; text: string }[]) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-6)
    .map((message) => ({
      role: message.role,
      text: message.text.replace(/\s+/g, " ").trim().slice(0, 500),
    }))
    .filter((message) => message.text);
}

function extractOutputText(response: any) {
  if (typeof response.output_text === "string") return response.output_text.trim();

  const parts = (response.output ?? [])
    .flatMap((item: any) => item.content ?? [])
    .map((content: any) => content.text ?? content.output_text ?? "")
    .filter(Boolean);

  if (parts.length) return parts.join("\n").trim();

  const choices = response.choices ?? [];
  const chatText = choices
    .map((choice: any) => choice.message?.content ?? choice.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();

  return chatText;
}

function surfChatCompletionUrls() {
  const configured = surfBaseUrl();
  const urls = [`${configured}/chat/completions`];

  if (/^https:\/\/api\.asksurf\.ai\/v1$/i.test(configured)) {
    urls.push("https://api.asksurf.ai/gateway/v1/chat/completions");
  }

  return [...new Set(urls)];
}

function extractMarkdownCitations(text: string): SurfCitation[] {
  const citations: SurfCitation[] = [];
  const pattern = /!?\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    citations.push({
      title: match[1],
      url: match[2],
    });
  }

  return citations;
}

function extractCitations(response: any, assistantText: string): SurfCitation[] {
  const choices = Array.isArray(response.choices) ? response.choices : [];
  const candidates = [
    ...(Array.isArray(response.citations) ? response.citations : []),
    ...(Array.isArray(response.sources) ? response.sources : []),
    ...(Array.isArray(response.references) ? response.references : []),
    ...choices.flatMap((choice: any) => [
      ...(Array.isArray(choice.message?.citations) ? choice.message.citations : []),
      ...(Array.isArray(choice.message?.sources) ? choice.message.sources : []),
      ...(Array.isArray(choice.message?.references) ? choice.message.references : []),
    ]),
    ...extractMarkdownCitations(assistantText),
  ];

  const seen = new Set<string>();

  return candidates
    .map((item: any) => ({
      title:
        typeof item.title === "string"
          ? item.title
          : typeof item.name === "string"
            ? item.name
            : undefined,
      url:
        typeof item.url === "string"
          ? item.url
          : typeof item.href === "string"
            ? item.href
            : typeof item.link === "string"
              ? item.link
              : undefined,
    }))
    .filter((item: SurfCitation) => {
      const key = item.url || item.title;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

export async function askSurfResearch({
  input,
  recentMessages = [],
  surfMode,
  effort,
}: SurfResearchOptions) {
  if (!process.env.SURF_API_KEY) {
    throw Object.assign(new Error("SURF_API_KEY is not configured"), { status: 500 });
  }

  const resolvedSurfMode = normalizeSurfMode(surfMode);
  const resolvedEffort = normalizeSurfEffort(effort);
  const requestProfile = surfRequestProfile(resolvedSurfMode, resolvedEffort);
  const startedAt = Date.now();
  const compactMessages = compactRecentMessages(recentMessages);
  const outputContract =
    resolvedSurfMode === "instant"
      ? [
          "Output contract for Instant mode:",
          "Prefer the user's language.",
          "Use Markdown with one # title and sections that fit the question.",
          "Include at least ## Tóm tắt nhanh (or ## Quick Summary if answering in English), ## Sources, and ## Related Questions.",
          "Link important entities inline to authoritative sources when available, for example [Circle Gateway](https://developers.circle.com/...).",
          "Keep it concise but still include enough detail to answer the user's actual question; avoid one-paragraph answers.",
        ].join("\n")
      : [
          "Output contract for Research mode:",
          "Prefer the user's language.",
          "Do not return a short generic answer. Produce a research page, not a chat blurb.",
          "Choose section headings that match the user's question and your findings; do not force a generic template when a more specific outline is better.",
          "Use this minimum Markdown shape, adding or renaming middle sections as needed:",
          "# <clear research title>",
          "## Tóm tắt nhanh",
          "5-8 bullets with the thesis, why it matters, the strongest evidence, and the main caveat. Do not use the acronym TL;DR.",
          "3-7 question-specific research sections with clear headings that reflect the actual topic, for example technology, ecosystem, risks, comparison, adoption, or next catalysts only when those sections are relevant.",
          "Use paragraphs, bullets, and Markdown tables. Include at least one table for comparisons, metrics, timelines, tradeoffs, or source synthesis when the question supports structured data. If live numeric data is unavailable, say so clearly.",
          "Include inline source links on important entity names and claims, not only in the Sources section.",
          "## Sources",
          "Markdown links to authoritative sources when available. Prefer official docs, docs pages, reputable data providers, project blogs, explorers, or established research/media sources.",
          "## Related Questions",
          "3-5 short follow-up questions as Markdown bullets.",
          "Link important entities inline to authoritative sources when available, for example [Circle Gateway](https://developers.circle.com/...). These inline links power client-side entity previews.",
          resolvedEffort === "maximum"
            ? "Target depth: 1800-2800 words when enough source data exists. Be comprehensive, include nuanced tradeoffs, and avoid filler."
            : resolvedEffort === "extended"
              ? "Target depth: 1300-2100 words when enough source data exists."
              : "Target depth: 1000-1700 words when enough source data exists.",
        ].join("\n");
  const systemPrompt = [
    "You are AskSurf Research inside PayCMD, a USDC payment and Circle Gateway app.",
    "Answer crypto, stablecoin, chain, protocol, market, and on-chain research questions.",
    "Do not create, sign, or execute transactions. If the user wants to act in PayCMD, suggest a slash command instead.",
    outputContract,
    "When chart citations or chart links are available, include them as Markdown image/link blocks so the client can render them.",
    "Keep answers practical, and add a short note when content is market/investment related.",
    "PayCMD context: supported test chains are Arc Testnet, Base Sepolia, and Avalanche Fuji; PayCMD transactions are handled by PayCMD backend, not by you.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages = [
    { role: "system", content: systemPrompt },
    ...compactMessages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.text,
    })),
    { role: "user", content: input },
  ];

  const requestBody = JSON.stringify({
    model: requestProfile.model,
    messages,
    stream: false,
    reasoning_effort: requestProfile.reasoningEffort,
    max_tokens:
      resolvedSurfMode === "instant" ? 2200 : resolvedEffort === "maximum" ? 12000 : resolvedEffort === "extended" ? 9000 : 7000,
    ability: ["search", "evm_onchain", "solana_onchain", "market_analysis", "calculate"],
    citation: ["source", "chart"],
  });

  let response: Response | null = null;
  let data: any = {};

  for (const url of surfChatCompletionUrls()) {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SURF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
      signal: AbortSignal.timeout(requestProfile.timeoutMs),
    });

    data = await response.json().catch(() => ({}));

    if (response.ok || response.status !== 404) {
      break;
    }
  }

  if (!response?.ok) {
    const message = data?.error?.message ?? data?.message ?? "AskSurf request failed";
    throw Object.assign(new Error(message), { status: response?.status ?? 502 });
  }

  const assistantText = extractOutputText(data);

  if (!assistantText) {
    throw Object.assign(new Error("AskSurf returned an empty response"), { status: 502 });
  }

  return {
    assistantText,
    citations: extractCitations(data, assistantText),
    model: typeof data?.model === "string" ? data.model : requestProfile.model,
    surfMode: resolvedSurfMode,
    effort: resolvedEffort,
    durationMs: Date.now() - startedAt,
  } satisfies SurfResearchResult;
}
