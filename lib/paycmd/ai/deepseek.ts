// Single HTTP egress for every AI call in the app. Both callers (the command router and the
// research layer) go through here, so this is the one place that knows about the vendor.
//
// DeepSeek is OpenAI-compatible, with two differences that shape the API below:
//
//  1. Chain-of-thought is ON BY DEFAULT on both models and comes back as `reasoning_content`
//     alongside `content`.
//  2. Those reasoning tokens are drawn from the SAME `max_tokens` budget as the answer. A request
//     with a tight budget can spend all of it thinking and return `content: ''` — measured: at
//     `max_tokens: 80` the answer came back empty. So `thinking` is a required consideration for
//     any caller that parses the output, not a nicety.

type DeepSeekMessage = { role: "system" | "user" | "assistant"; content: string };

// Reasoning traces run to several KB. Capping here rather than at the route means no caller can
// accidentally put a full trace into a response body or a database row.
export const REASONING_MAX_CHARS = 4_000;

export type DeepSeekResult = { text: string; reasoning: string; model: string };

type DeepSeekRequest = {
  model: string;
  messages: DeepSeekMessage[];
  maxTokens: number;
  timeoutMs: number;
  // Defaults to true because that is what the API does with the field absent. Pass `false` for
  // structured output: `{type: "disabled"}` is verified to remove `reasoning_content` entirely and
  // hands the whole token budget to the answer.
  thinking?: boolean;
  // `{type: "json_object"}`. Note DeepSeek rejects `{type: "json_schema"}` with a 400
  // ("This response_format type is unavailable now"), so there is no strict-schema option to use.
  // json_object also requires the word "json" to appear somewhere in the prompt.
  jsonObject?: boolean;
};

function deepSeekBaseUrl() {
  return (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
}

export async function askDeepSeek({
  model,
  messages,
  maxTokens,
  timeoutMs,
  thinking = true,
  jsonObject = false,
}: DeepSeekRequest): Promise<DeepSeekResult> {
  const token = process.env.DEEPSEEK_API_KEY;
  if (!token) throw Object.assign(new Error("DEEPSEEK_API_KEY is not configured"), { status: 500 });

  const payload: Record<string, unknown> = { model, messages, max_tokens: maxTokens };
  if (!thinking) payload.thinking = { type: "disabled" };
  if (jsonObject) payload.response_format = { type: "json_object" };

  const response = await fetch(`${deepSeekBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(
      new Error(data?.error?.message ?? data?.message ?? "DeepSeek request failed"),
      { status: response.status },
    );
  }

  const message = data?.choices?.[0]?.message;
  const text = message?.content;

  if (typeof text !== "string" || !text.trim()) {
    // Worth distinguishing from a transport failure: with `thinking` on this usually means the CoT
    // consumed `max_tokens` before the answer started, which is fixed by raising the budget or
    // turning thinking off — not by retrying.
    const reasoningTokens = data?.usage?.completion_tokens_details?.reasoning_tokens;
    const hint =
      thinking && typeof reasoningTokens === "number" && reasoningTokens > 0
        ? ` (spent ${reasoningTokens} reasoning tokens of a ${maxTokens} budget)`
        : "";
    throw Object.assign(new Error(`DeepSeek returned an empty response${hint}`), { status: 502 });
  }

  const rawReasoning = typeof message?.reasoning_content === "string" ? message.reasoning_content : "";

  if (process.env.NODE_ENV !== "production") {
    // The only way to confirm a caller that asked for `thinking: false` actually got it — the
    // response looks identical either way apart from this number.
    console.info("[deepseek]", {
      model,
      thinking,
      reasoningTokens: data?.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
    });
  }

  return {
    text: text.trim(),
    reasoning: rawReasoning.trim().slice(0, REASONING_MAX_CHARS),
    model: typeof data?.model === "string" ? data.model : model,
  };
}
