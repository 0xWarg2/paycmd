export const GATEWAY_FEE_HEADROOM_BPS = 1_500n;
export const GATEWAY_FEE_HEADROOM_MIN_ATOMIC = 5_000n;
export const GATEWAY_FEE_HEADROOM_MAX_ATOMIC = 50_000n;
export const GATEWAY_FEE_CEILING_STEP_ATOMIC = 1_000n;

function divCeil(value: bigint, divisor: bigint) {
  return (value + divisor - 1n) / divisor;
}

export function gatewayApprovedMaxFee(requiredMaxFeeAtomic: bigint) {
  if (requiredMaxFeeAtomic <= 0n) {
    throw new Error("Gateway required maxFee must be positive.");
  }

  const proportional = divCeil(
    requiredMaxFeeAtomic * GATEWAY_FEE_HEADROOM_BPS,
    10_000n,
  );
  const rawHeadroom = proportional < GATEWAY_FEE_HEADROOM_MIN_ATOMIC
    ? GATEWAY_FEE_HEADROOM_MIN_ATOMIC
    : proportional > GATEWAY_FEE_HEADROOM_MAX_ATOMIC
      ? GATEWAY_FEE_HEADROOM_MAX_ATOMIC
      : proportional;

  return divCeil(
    requiredMaxFeeAtomic + rawHeadroom,
    GATEWAY_FEE_CEILING_STEP_ATOMIC,
  ) * GATEWAY_FEE_CEILING_STEP_ATOMIC;
}

export function gatewayFeeHeadroom(requiredMaxFeeAtomic: bigint) {
  return gatewayApprovedMaxFee(requiredMaxFeeAtomic) - requiredMaxFeeAtomic;
}

export function gatewayApprovedFeeWithinPolicy(
  quotedRequiredMaxFeeAtomic: bigint,
  approvedMaxFeeAtomic: bigint,
) {
  if (quotedRequiredMaxFeeAtomic <= 0n || approvedMaxFeeAtomic <= 0n) return false;
  return gatewayApprovedMaxFee(quotedRequiredMaxFeeAtomic) === approvedMaxFeeAtomic;
}
