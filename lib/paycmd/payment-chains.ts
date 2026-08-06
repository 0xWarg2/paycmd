import { normalizeChain, type PayCmdChain } from "./chains.ts";

export class PaymentChainValidationError extends Error {
  readonly field: "sourceChain" | "destinationChain";

  constructor(field: "sourceChain" | "destinationChain") {
    super(`${field} is required and must be a supported Gateway chain`);
    this.name = "PaymentChainValidationError";
    this.field = field;
  }
}

export function requirePaymentChains(input: {
  sourceMode?: unknown;
  sourceChain?: unknown;
  destinationChain?: unknown;
}):
  | { sourceChain: PayCmdChain; destinationChain: PayCmdChain }
  | { sourceMode: "unified"; sourceChain: null; destinationChain: PayCmdChain } {
  const unified = input.sourceMode === "unified";
  const sourceChain = unified
    ? null
    : normalizeChain(typeof input.sourceChain === "string" ? input.sourceChain : "");
  if (!unified && !sourceChain) throw new PaymentChainValidationError("sourceChain");

  const destinationChain = normalizeChain(
    typeof input.destinationChain === "string" ? input.destinationChain : "",
  );
  if (!destinationChain) throw new PaymentChainValidationError("destinationChain");

  return unified
    ? { sourceMode: "unified", sourceChain: null, destinationChain }
    : { sourceChain: sourceChain as PayCmdChain, destinationChain };
}
