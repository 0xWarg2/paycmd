export type PayCmdAiModelProfile = "gpt-5.5" | "gpt-5.4" | "gpt-5.4-mini" | "codex-auto-review";

export type PayCmdAiModelOption = {
  id: PayCmdAiModelProfile;
  label: string;
  description: string;
  model: string;
  reasoningEffort: "low";
};

export const aiModelOptions: PayCmdAiModelOption[] = [
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    description: "Newest proxy model, low effort",
    model: "gpt-5.5",
    reasoningEffort: "low",
  },
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    description: "Stable fallback, low effort",
    model: "gpt-5.4",
    reasoningEffort: "low",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    description: "Faster fallback, low effort",
    model: "gpt-5.4-mini",
    reasoningEffort: "low",
  },
  {
    id: "codex-auto-review",
    label: "Codex Auto Review",
    description: "Proxy fallback model, low effort",
    model: "codex-auto-review",
    reasoningEffort: "low",
  },
];

export const defaultAiModelProfile: PayCmdAiModelProfile =
  (process.env.PAYCMD_DEFAULT_AI_MODEL_PROFILE as PayCmdAiModelProfile | undefined) ?? "gpt-5.5";

export function getAiModelOption(id?: string | null) {
  return aiModelOptions.find((option) => option.id === id) ?? aiModelOptions.find((option) => option.id === defaultAiModelProfile) ?? aiModelOptions[0];
}
