export function gatewayUnifiedRequestFields(body: Record<string, unknown>) {
  const fields: {
    allocationGuard?: Record<string, unknown>;
    allocationFingerprint?: string;
    preflightOnly?: true;
  } = {};

  if (body.allocationGuard && typeof body.allocationGuard === "object" && !Array.isArray(body.allocationGuard)) {
    fields.allocationGuard = body.allocationGuard as Record<string, unknown>;
  }
  if (typeof body.allocationFingerprint === "string" && body.allocationFingerprint.trim()) {
    fields.allocationFingerprint = body.allocationFingerprint;
  }
  if (body.preflightOnly === true) fields.preflightOnly = true;

  return fields;
}

export function gatewayPaymentEstimateFields(
  body: Record<string, unknown>,
  recipientAddress: string,
) {
  return {
    amount: body.amount,
    sourceMode: body.sourceMode,
    sourceChain: body.sourceChain,
    destinationChain: body.destinationChain,
    recipientAddress,
    mintGasMode: body.mintGasMode,
    selectedSourceChains: body.selectedSourceChains,
  };
}
