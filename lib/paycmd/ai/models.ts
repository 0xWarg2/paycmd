export const commandRouterModelProfile = "inclusionai/ling-3.0-flash:free" as const;

export const commandRouterModelLabel = "OpenRouter Free";

export function commandRouterModel() {
  return process.env.OPENROUTER_COMMAND_MODEL ?? commandRouterModelProfile;
}
