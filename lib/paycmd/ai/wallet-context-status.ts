import type { WalletContextStatus } from "./knowledge-types.ts";

export function normalizeWalletContextStatus(value: unknown): WalletContextStatus | undefined {
  return value === "verified" || value === "partial" || value === "unavailable" ? value : undefined;
}

export function walletContextMetadata(value: unknown): { walletContextStatus: WalletContextStatus | null } {
  return { walletContextStatus: normalizeWalletContextStatus(value) ?? null };
}

export function walletContextMetadataFromResearch(response: unknown) {
  if (!response || typeof response !== "object") return walletContextMetadata(undefined);
  return walletContextMetadata((response as Record<string, unknown>).walletContextStatus);
}
