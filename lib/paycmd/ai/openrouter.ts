type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: string };

type OpenRouterRequest = {
  model: string;
  messages: OpenRouterMessage[];
  maxTokens: number;
  timeoutMs: number;
  reasoningEffort?: "low" | "medium" | "high";
};

export async function askOpenRouter({ model, messages, maxTokens, timeoutMs, reasoningEffort }: OpenRouterRequest) {
  const token = process.env.OPENROUTER_API_KEY;
  if (!token) throw Object.assign(new Error("OPENROUTER_API_KEY is not configured"), { status: 500 });

  const payload: Record<string, unknown> = { model, messages, max_tokens: maxTokens };
  if (reasoningEffort) payload.reasoning = { effort: reasoningEffort };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "Payna",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data?.error?.message ?? data?.message ?? "OpenRouter request failed"), { status: response.status });
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw Object.assign(new Error("OpenRouter returned an empty response"), { status: 502 });
  return { text: text.trim(), model: typeof data?.model === "string" ? data.model : model };
}
