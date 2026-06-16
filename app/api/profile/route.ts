import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const handlePattern = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const validChains = ["arcTestnet", "baseSepolia", "avalancheFuji"] as const;

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

function normalizeUrl(value: unknown) {
  const text = normalizeNullableText(value, 180);
  if (!text) return null;

  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new Error("Website URL phải bắt đầu bằng http:// hoặc https://.");
  }
}

function normalizeAvatarUrl(value: unknown) {
  const text = normalizeNullableText(value, 500);
  if (!text) return null;

  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new Error("Avatar URL không hợp lệ.");
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
    const websiteUrl = normalizeUrl(body.websiteUrl);
    const avatarUrl = normalizeAvatarUrl(body.avatarUrl);
    const defaultChain = validChains.includes(body.defaultChain as any)
      ? body.defaultChain
      : "arcTestnet";

    if (!displayName || displayName.length < 2) {
      return NextResponse.json(
        { error: "Display name phải có ít nhất 2 ký tự." },
        { status: 400 },
      );
    }

    if (!handle || !handlePattern.test(handle)) {
      return NextResponse.json(
        {
          error:
            "Handle phải dài 3-32 ký tự, bắt đầu bằng chữ/số và chỉ gồm chữ thường, số, dấu gạch ngang hoặc gạch dưới.",
        },
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
          { error: "Handle này đã có người dùng. Chọn handle khác." },
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
