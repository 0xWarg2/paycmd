import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeChain } from "@/lib/paycmd/chains";

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export type ResolvedRecipient = {
  label: string;
  address: string;
  destinationChain: string;
  contactId: string | null;
};

export function isEvmAddress(value: string) {
  return EVM_ADDRESS_PATTERN.test(value.trim());
}

export async function resolveRecipient(
  supabase: SupabaseClient,
  userId: string,
  recipient: string,
  requestedChain?: string,
): Promise<ResolvedRecipient> {
  const trimmed = recipient.trim();
  const normalizedRequestedChain = normalizeChain(requestedChain);

  if (isEvmAddress(trimmed)) {
    return {
      label: trimmed,
      address: trimmed,
      destinationChain: normalizedRequestedChain || "arcTestnet",
      contactId: null,
    };
  }

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, display_name, wallet_address, preferred_chain")
    .eq("user_id", userId)
    .ilike("display_name", trimmed)
    .limit(1);

  if (error) {
    throw new Error(`Could not resolve recipient: ${error.message}`);
  }

  const contact = contacts?.[0];

  if (!contact?.wallet_address) {
    throw new Error(`Contact not found: ${trimmed}. Add it first with /contacts add ${trimmed} 0x...`);
  }

  return {
    label: contact.display_name,
    address: contact.wallet_address,
    destinationChain: normalizedRequestedChain || contact.preferred_chain || "arcTestnet",
    contactId: contact.id,
  };
}
