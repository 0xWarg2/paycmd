import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeChain } from "@/lib/paycmd/chains";

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const EVM_ADDRESS_IN_TEXT_PATTERN = /@?(0x[a-fA-F0-9]{40})/;

export class PayCmdRecipientError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PayCmdRecipientError";
    this.code = code;
    this.status = status;
  }
}

export type ResolvedRecipient = {
  label: string;
  address: string;
  destinationChain: string;
  contactId: string | null;
  contactUserId: string | null;
  resolution: "direct" | "internal" | "external";
  storedAddress: string | null;
};

export function isEvmAddress(value: string) {
  return EVM_ADDRESS_PATTERN.test(normalizeEvmAddress(value));
}

export function normalizeEvmAddress(value: string) {
  const trimmed = value.trim();
  return trimmed.match(EVM_ADDRESS_IN_TEXT_PATTERN)?.[1] ?? trimmed;
}

type InternalWalletLookup = {
  contact_user_id: string | null;
  wallet_address: string | null;
  address: string | null;
};

function walletAddressFromLookup(wallet: InternalWalletLookup | null | undefined) {
  return wallet?.address ?? wallet?.wallet_address ?? "";
}

export async function resolveInternalWalletOwner(
  supabase: SupabaseClient,
  walletAddress: string,
) {
  const normalizedWalletAddress = normalizeEvmAddress(walletAddress).toLowerCase();
  const { data, error } = await supabase.rpc("lookup_internal_wallet_by_address", {
    p_wallet_address: normalizedWalletAddress,
  });

  if (error) {
    const rpcMissing =
      error.code === "PGRST202" ||
      error.message.includes("Could not find the function") ||
      error.message.includes("schema cache");

    if (rpcMissing) {
      console.warn(
        "lookup_internal_wallet_by_address RPC is missing; falling back to RLS-scoped wallet lookup.",
        error.message,
      );

      const { data: wallets, error: walletLookupError } = await supabase
        .from("wallets")
        .select("user_id, wallet_address, address, type, created_at")
        .or(`wallet_address.ilike.${normalizedWalletAddress},address.ilike.${normalizedWalletAddress}`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (walletLookupError) {
        throw new PayCmdRecipientError(
          "CONTACT_LOOKUP_UNAVAILABLE",
          "Không kiểm tra được địa chỉ ví này trong PayCMD lúc này. Thử lại sau hoặc lưu như ví ngoài.",
          503,
        );
      }

      return (wallets?.[0] as { user_id?: string } | undefined)?.user_id ?? null;
    }

    throw new PayCmdRecipientError(
      "CONTACT_LOOKUP_UNAVAILABLE",
      "Không kiểm tra được địa chỉ ví này trong PayCMD lúc này. Thử lại sau hoặc lưu như ví ngoài.",
      503,
    );
  }

  return (data?.[0] as InternalWalletLookup | undefined)?.contact_user_id ?? null;
}

export async function resolveRecipient(
  supabase: SupabaseClient,
  userId: string,
  recipient: string,
  requestedChain?: string,
): Promise<ResolvedRecipient> {
  const trimmed = recipient.trim();
  const normalizedRecipient = normalizeEvmAddress(trimmed);
  const normalizedRequestedChain = normalizeChain(requestedChain);

  if (isEvmAddress(normalizedRecipient)) {
    return {
      label: normalizedRecipient,
      address: normalizedRecipient,
      destinationChain: normalizedRequestedChain || "arcTestnet",
      contactId: null,
      contactUserId: null,
      resolution: "direct",
      storedAddress: null,
    };
  }

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, display_name, wallet_address, preferred_chain, contact_user_id")
    .eq("user_id", userId)
    .ilike("display_name", trimmed)
    .limit(1);

  if (error) {
    throw new Error(`Could not resolve recipient: ${error.message}`);
  }

  const contact = contacts?.[0];

  if (!contact?.wallet_address) {
    throw new Error(
      `Contact not found: ${trimmed}. Add contact first with \`/contacts add ${trimmed} 0x... on arc\`.`,
    );
  }

  const destinationChain = normalizedRequestedChain || contact.preferred_chain || "arcTestnet";

  if (contact.contact_user_id) {
    const { data: internalWallets, error: internalWalletError } = await supabase.rpc(
      "resolve_internal_contact_wallet",
      { p_contact_id: contact.id },
    );

    if (internalWalletError) {
      throw new Error(`Could not resolve internal contact wallet: ${internalWalletError.message}`);
    }

    const internalWallet = internalWallets?.[0] as InternalWalletLookup | undefined;
    const address = walletAddressFromLookup(internalWallet);

    if (!isEvmAddress(address)) {
      throw new Error(`Internal contact ${contact.display_name} does not have an active Circle wallet.`);
    }

    return {
      label: contact.display_name,
      address,
      destinationChain,
      contactId: contact.id,
      contactUserId: contact.contact_user_id,
      resolution: "internal",
      storedAddress: contact.wallet_address,
    };
  }

  return {
    label: contact.display_name,
    address: contact.wallet_address,
    destinationChain,
    contactId: contact.id,
    contactUserId: null,
    resolution: "external",
    storedAddress: contact.wallet_address,
  };
}
