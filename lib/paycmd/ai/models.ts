export const commandRouterModelProfile = "deepseek-v4-flash" as const;

export function commandRouterModel() {
  return process.env.DEEPSEEK_COMMAND_MODEL ?? commandRouterModelProfile;
}
