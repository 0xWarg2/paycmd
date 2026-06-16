import { NextRequest, NextResponse } from "next/server";

import { normalizeChain } from "@/lib/paycmd/chains";
import {
  isEvmAddress,
  normalizeEvmAddress,
} from "@/lib/paycmd/recipients";
import { createClient } from "@/lib/supabase/server";

type InternalContactProfile = {
  contact_user_id: string | null;
  display_name: string | null;
  handle: string | null;
  default_chain: string | null;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function lookupInternalContactProfile(supabase: any, walletAddress: string) {
  const { data, error } = await supabase.rpc("lookup_internal_contact_profile_by_address", {
    p_wallet_address: walletAddress.trim(),
  });

  if (error) {
    throw new Error(`Could not resolve internal wallet: ${error.message}`);
  }

  return data?.[0] as InternalContactProfile | undefined;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contacts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const requestedDisplayName = String(body.displayName ?? body.name ?? "").trim();
  const walletAddress = normalizeEvmAddress(String(body.walletAddress ?? body.address ?? ""));
  const requireInternal = Boolean(body.requireInternal);

  if (!walletAddress) {
    return NextResponse.json(
      { error: "walletAddress is required" },
      { status: 400 },
    );
  }

  if (!isEvmAddress(walletAddress)) {
    return NextResponse.json({ error: "Invalid EVM wallet address" }, { status: 400 });
  }

  let internalProfile: InternalContactProfile | undefined;
  try {
    internalProfile = await lookupInternalContactProfile(supabase, walletAddress);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not resolve internal wallet" },
      { status: 500 },
    );
  }

  const contactUserId = internalProfile?.contact_user_id ?? null;

  if (requireInternal && !contactUserId) {
    return NextResponse.json(
      {
        error: "INTERNAL_WALLET_NOT_FOUND",
        code: "INTERNAL_WALLET_NOT_FOUND",
        message:
          "Không tìm thấy tài khoản PayCMD nào dùng địa chỉ ví này. Kiểm tra lại địa chỉ hoặc lưu contact như ví ngoài.",
        walletAddress,
      },
      { status: 404 },
    );
  }

  const resolution = contactUserId ? "internal" : "external";
  const internalDisplayName =
    internalProfile?.display_name?.trim() ||
    internalProfile?.handle?.trim() ||
    (contactUserId ? `PayCMD ${shortAddress(walletAddress)}` : "");
  const displayName = requestedDisplayName || internalDisplayName;
  const preferredChain =
    normalizeChain(body.preferredChain ?? body.chain) ||
    normalizeChain(internalProfile?.default_chain) ||
    "arcTestnet";

  if (!displayName) {
    return NextResponse.json(
      {
        error:
          "displayName is required for external wallet contacts. Try `/contacts add Minh 0x... on arc`.",
      },
      { status: 400 },
    );
  }

  const { data: existingContacts, error: existingError } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", user.id)
    .ilike("display_name", displayName)
    .limit(1);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const contactFields: Record<string, unknown> = {
    display_name: displayName,
    wallet_address: walletAddress,
    contact_user_id: contactUserId,
    preferred_chain: preferredChain,
    status: "active",
  };

  if ("role" in body) {
    contactFields.role = body.role ?? null;
  }

  if ("label" in body) {
    contactFields.label = body.label ?? null;
  }

  if ("metadata" in body) {
    contactFields.metadata = body.metadata ?? {};
  }

  const existingContactId = existingContacts?.[0]?.id;

  const query = existingContactId
    ? supabase
        .from("contacts")
        .update(contactFields)
        .eq("id", existingContactId)
        .eq("user_id", user.id)
    : supabase.from("contacts").insert({
        user_id: user.id,
        metadata: {},
        ...contactFields,
      });

  const { data, error } = await query
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      contact: data,
      resolution,
      autofilledDisplayName: !requestedDisplayName && Boolean(internalDisplayName),
      warning: contactUserId
        ? null
        : {
            code: "INTERNAL_WALLET_NOT_FOUND",
            message:
              "Không tìm thấy tài khoản PayCMD khớp địa chỉ này, nên contact được lưu như ví ngoài.",
          },
    },
    { status: existingContactId ? 200 : 201 },
  );
}
