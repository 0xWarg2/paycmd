// These endpoints may only operate on the existing testnet rails.
const legacyRailPath = /^\/api\/(?:gateway(?:\/|$)|cctp(?:\/|$)|swap(?:\/|$)|payments(?:\/|$)|payment-(?:drafts|requests)(?:\/|$)|payroll(?:\/|$)|schedules(?:\/|$)|deposit(?:\/|$)|user\/(?:fund|bootstrap)(?:\/|$)|wallet(?:\/|$)|wallet-set(?:\/|$)|commands(?:\/|$)|ai\/command(?:\/|$))/;

export function containsMainnet(value: unknown): boolean {
  if (typeof value === "number") return value === 5042;
  if (typeof value === "string") return /(?:\bmainnet\b|arcmainnet|arc[_-]mainnet|^5042$|^0x13b2$)/i.test(value);
  if (Array.isArray(value)) return value.some(containsMainnet);
  if (value && typeof value === "object") return Object.values(value).some(containsMainnet);
  return false;
}

export function legacyRailBlocked(path: string, context: unknown) {
  return legacyRailPath.test(path) && containsMainnet(context);
}
