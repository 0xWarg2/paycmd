export const AI_QUOTA_X_PROFILE_URL = "https://x.com/0xWarg__";

export function shouldShowQuotaContactCta(message: { quotaContactCta?: boolean }) {
  return message.quotaContactCta === true;
}
