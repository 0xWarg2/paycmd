import type { PayCmdChain } from "./chains";

type BalanceDraft = {
  command: string;
  fields: Record<string, string | undefined>;
};

function isBalanceDraft(draft: BalanceDraft) {
  return (
    draft.command === "balance" ||
    ((draft.command === "wallet" || draft.command === "gateway") && draft.fields.action === "balance")
  );
}

export function balanceChainFromDraft(draft: BalanceDraft): PayCmdChain | undefined {
  if (!isBalanceDraft(draft)) return undefined;
  return (draft.fields.chain || undefined) as PayCmdChain | undefined;
}

export function balanceRequestBody(draft: BalanceDraft): { chain?: PayCmdChain } {
  const chain = balanceChainFromDraft(draft);
  return chain ? { chain } : {};
}

export function executionBalanceChainFilter(draft: BalanceDraft): PayCmdChain | undefined {
  return balanceChainFromDraft(draft);
}
