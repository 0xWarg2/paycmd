import { createHash } from "node:crypto";

import { isSupportedChain } from "./chains.ts";
import { gatewayApprovedFeeWithinPolicy } from "./gateway-fee-headroom.ts";

export type GatewayAllocationGuardAllocation = {
  sourceChain: string;
  valueAtomic: string;
  quotedMaxFeeAtomic: string;
  approvedMaxFeeAtomic: string;
};

export type GatewayAllocationGuard = {
  amountAtomic: string;
  destinationChain: string;
  recipientAddress: string;
  mintGasMode: "auto_forwarding" | "manual";
  allocations: GatewayAllocationGuardAllocation[];
};

export function buildGatewayAllocationGuard(input: {
  amountAtomic: bigint;
  destinationChain: string;
  recipientAddress: string;
  mintGasMode: "auto_forwarding" | "manual";
  allocations: Array<{
    sourceChain: string;
    valueAtomic: bigint;
    quotedMaxFeeAtomic: bigint;
    approvedMaxFeeAtomic: bigint;
  }>;
}) {
  const guard = parseGatewayAllocationGuard({
    amountAtomic: input.amountAtomic.toString(),
    destinationChain: input.destinationChain,
    recipientAddress: input.recipientAddress,
    mintGasMode: input.mintGasMode,
    allocations: input.allocations.map((allocation) => ({
      sourceChain: allocation.sourceChain,
      valueAtomic: allocation.valueAtomic.toString(),
      quotedMaxFeeAtomic: allocation.quotedMaxFeeAtomic.toString(),
      approvedMaxFeeAtomic: allocation.approvedMaxFeeAtomic.toString(),
    })),
  });
  if (guard.allocations.some((allocation) => !gatewayApprovedFeeWithinPolicy(
    BigInt(allocation.quotedMaxFeeAtomic),
    BigInt(allocation.approvedMaxFeeAtomic),
  ))) {
    throw new Error("Gateway allocation guard fee ceiling is outside policy.");
  }
  return guard;
}

export type GatewayGuardRejectionReason =
  | "fee_ceiling_exceeded"
  | "balance_changed"
  | "authorization_changed"
  | "allocation_invalid";

type CurrentSourceState = {
  sourceChain: string;
  balanceAtomic: bigint;
  authorized: boolean;
  freshRequiredMaxFeeAtomic: bigint;
};

export type ValidatedGatewayGuardAllocation = {
  sourceChain: string;
  valueAtomic: bigint;
  quotedMaxFeeAtomic: bigint;
  approvedMaxFeeAtomic: bigint;
  freshRequiredMaxFeeAtomic: bigint;
};

export type GatewayGuardValidationResult =
  | { ok: true; allocations: ValidatedGatewayGuardAllocation[] }
  | { ok: false; reason: GatewayGuardRejectionReason };

function recordFrom(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function positiveAtomicString(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`${label} must be a decimal string.`);
  }
  const atomic = BigInt(value);
  if (atomic <= 0n) throw new Error(`${label} must be positive.`);
  return atomic;
}

function normalizedRecipient(value: unknown) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error("Gateway allocation guard recipient address is invalid.");
  }
  return value.toLowerCase();
}

export function parseGatewayAllocationGuard(value: unknown): GatewayAllocationGuard {
  const guard = recordFrom(value, "Gateway allocation guard");
  const amountAtomic = positiveAtomicString(guard.amountAtomic, "Guard amountAtomic");

  if (typeof guard.destinationChain !== "string" || !isSupportedChain(guard.destinationChain)) {
    throw new Error("Guard destinationChain must be a supported Gateway chain.");
  }
  const recipientAddress = normalizedRecipient(guard.recipientAddress);
  if (guard.mintGasMode !== "auto_forwarding" && guard.mintGasMode !== "manual") {
    throw new Error("Guard mint gas mode is invalid.");
  }
  if (!Array.isArray(guard.allocations) || guard.allocations.length === 0) {
    throw new Error("Gateway allocation guard must contain allocations.");
  }
  if (guard.allocations.length > 16) {
    throw new Error("Gateway allocation guard cannot contain more than 16 allocations.");
  }

  const seen = new Set<string>();
  let allocatedAtomic = 0n;
  const allocations = guard.allocations.map((rawAllocation, index) => {
    const allocation = recordFrom(rawAllocation, `Guard allocation ${index + 1}`);
    if (typeof allocation.sourceChain !== "string" || !isSupportedChain(allocation.sourceChain)) {
      throw new Error(`Guard allocation ${index + 1} must use a supported Gateway chain.`);
    }
    if (seen.has(allocation.sourceChain)) {
      throw new Error(`Guard allocation source ${allocation.sourceChain} is duplicated.`);
    }
    seen.add(allocation.sourceChain);

    const valueAtomic = positiveAtomicString(
      allocation.valueAtomic,
      `Guard allocation ${index + 1} valueAtomic`,
    );
    positiveAtomicString(
      allocation.quotedMaxFeeAtomic,
      `Guard allocation ${index + 1} quotedMaxFeeAtomic`,
    );
    positiveAtomicString(
      allocation.approvedMaxFeeAtomic,
      `Guard allocation ${index + 1} approvedMaxFeeAtomic`,
    );
    allocatedAtomic += valueAtomic;

    return {
      sourceChain: allocation.sourceChain,
      valueAtomic: allocation.valueAtomic as string,
      quotedMaxFeeAtomic: allocation.quotedMaxFeeAtomic as string,
      approvedMaxFeeAtomic: allocation.approvedMaxFeeAtomic as string,
    };
  });

  if (allocatedAtomic !== amountAtomic) {
    throw new Error("Gateway allocation values must sum to guard amountAtomic.");
  }

  return {
    amountAtomic: guard.amountAtomic as string,
    destinationChain: guard.destinationChain,
    recipientAddress,
    mintGasMode: guard.mintGasMode,
    allocations,
  };
}

export function gatewayAllocationGuardFingerprint(value: unknown) {
  const guard = parseGatewayAllocationGuard(value);
  return createHash("sha256").update(JSON.stringify(guard)).digest("hex");
}

export function validateGatewayAllocationGuardCurrentState(input: {
  guard: unknown;
  amountAtomic: bigint;
  destinationChain: string;
  recipientAddress: string;
  mintGasMode: "auto_forwarding" | "manual";
  freshTotalFeeAtomic: bigint;
  sources: CurrentSourceState[];
}): GatewayGuardValidationResult {
  let guard: GatewayAllocationGuard;
  let recipientAddress: string;
  try {
    guard = parseGatewayAllocationGuard(input.guard);
    recipientAddress = normalizedRecipient(input.recipientAddress);
  } catch {
    return { ok: false, reason: "allocation_invalid" };
  }

  if (
    BigInt(guard.amountAtomic) !== input.amountAtomic ||
    guard.destinationChain !== input.destinationChain ||
    guard.recipientAddress !== recipientAddress ||
    guard.mintGasMode !== input.mintGasMode ||
    input.freshTotalFeeAtomic <= 0n
  ) {
    return { ok: false, reason: "allocation_invalid" };
  }

  const sourceByChain = new Map(input.sources.map((source) => [source.sourceChain, source]));
  const allocations: ValidatedGatewayGuardAllocation[] = [];
  let approvedTotalFeeAtomic = 0n;

  for (const allocation of guard.allocations) {
    const quotedMaxFeeAtomic = BigInt(allocation.quotedMaxFeeAtomic);
    const approvedMaxFeeAtomic = BigInt(allocation.approvedMaxFeeAtomic);
    if (!gatewayApprovedFeeWithinPolicy(quotedMaxFeeAtomic, approvedMaxFeeAtomic)) {
      return { ok: false, reason: "allocation_invalid" };
    }

    const source = sourceByChain.get(allocation.sourceChain);
    if (!source || source.freshRequiredMaxFeeAtomic <= 0n) {
      return { ok: false, reason: "allocation_invalid" };
    }
    if (!source.authorized) {
      return { ok: false, reason: "authorization_changed" };
    }

    const valueAtomic = BigInt(allocation.valueAtomic);
    if (valueAtomic + approvedMaxFeeAtomic > source.balanceAtomic) {
      return { ok: false, reason: "balance_changed" };
    }
    if (source.freshRequiredMaxFeeAtomic > approvedMaxFeeAtomic) {
      return { ok: false, reason: "fee_ceiling_exceeded" };
    }

    approvedTotalFeeAtomic += approvedMaxFeeAtomic;
    allocations.push({
      sourceChain: allocation.sourceChain,
      valueAtomic,
      quotedMaxFeeAtomic,
      approvedMaxFeeAtomic,
      freshRequiredMaxFeeAtomic: source.freshRequiredMaxFeeAtomic,
    });
  }

  if (input.freshTotalFeeAtomic > approvedTotalFeeAtomic) {
    return { ok: false, reason: "fee_ceiling_exceeded" };
  }

  return { ok: true, allocations };
}
