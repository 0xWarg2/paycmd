import { NextRequest, NextResponse } from "next/server";

import { requestLocale, tr, type PayCmdLocale } from "@/lib/i18n/server";
import { supportedChains } from "@/lib/paycmd/chains";
import { createClient } from "@/lib/supabase/server";

const handlePattern = /^[a-z0-9][a-z0-9_-]{2,31}$/;
// Was a 3-entry literal, so picking any of the other 9 supported chains was silently
// coerced back to arcTestnet on save — the user saw their choice revert with no error.
const validChains = supportedChains;

type ProfilePatch = {
  displayName?: string;
  handle?: string;
  bio?: string;
  websiteUrl?: string;
  avatarUrl?: string;
  defaultChain?: string;
};

function normalizeNullableText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  return text.slice(0, maxLength);
}

function normalizeUrl(value: unknown, locale: PayCmdLocale) {
  const text = normalizeNullableText(value, 180);
  if (!text) return null;

  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new Error(tr(locale, "profile.websiteUrl"));
  }
}

function normalizeAvatarUrl(value: unknown, locale: PayCmdLocale) {
  const text = normalizeNullableText(value, 500);
  if (!text) return null;

  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new Error(tr(locale, "profile.avatarUrl"));
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile });
}

export async function PATCH(req: NextRequest) {
  const locale = requestLocale(req);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as ProfilePatch;
    const displayName = normalizeNullableText(body.displayName, 60);
    const handle = normalizeNullableText(body.handle, 32)?.toLowerCase() ?? null;
    const bio = normalizeNullableText(body.bio, 180);
    const websiteUrl = normalizeUrl(body.websiteUrl, locale);
    const avatarUrl = normalizeAvatarUrl(body.avatarUrl, locale);
    const defaultChain = validChains.includes(body.defaultChain as any)
      ? body.defaultChain
      : "arcTestnet";

    if (!displayName || displayName.length < 2) {
      return NextResponse.json(
        { error: tr(locale, "profile.displayName") },
        { status: 400 },
      );
    }

    if (!handle || !handlePattern.test(handle)) {
      return NextResponse.json(
        { error: tr(locale, "profile.handle") },
        { status: 400 },
      );
    }

    const payload = {
      user_id: user.id,
      display_name: displayName,
      handle,
      bio,
      website_url: websiteUrl,
      avatar_url: avatarUrl,
      default_chain: defaultChain,
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: tr(locale, "profile.handleTaken") },
          { status: 409 },
        );
      }

      throw error;
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error("Profile update failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update profile" },
      { status: 500 },
    );
  }
}
