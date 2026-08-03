import { NextResponse } from "next/server";

import { AiAccessError, getDeepSeekQuota } from "@/lib/paycmd/ai/access";
import { createClient } from "@/lib/supabase/server";

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [quota, profileResult] = await Promise.all([
      getDeepSeekQuota(supabase),
      supabase
        .from("user_profiles")
        .select("ai_quota_notice_seen_at")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      return NextResponse.json({ error: "AI_ACCESS_CHECK_FAILED" }, { status: 503 });
    }

    return NextResponse.json({
      quota,
      noticeSeenAt: profileResult.data?.ai_quota_notice_seen_at ?? null,
    });
  } catch (error) {
    if (error instanceof AiAccessError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("AI quota onboarding status failed:", error);
    return NextResponse.json({ error: "AI_ACCESS_CHECK_FAILED" }, { status: 503 });
  }
}

export async function POST() {
  try {
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const noticeSeenAt = new Date().toISOString();
    const { error } = await supabase.from("user_profiles").upsert(
      {
        user_id: user.id,
        ai_quota_notice_seen_at: noticeSeenAt,
        updated_at: noticeSeenAt,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("AI quota onboarding dismissal failed:", error);
      return NextResponse.json({ error: "AI_QUOTA_NOTICE_UPDATE_FAILED" }, { status: 503 });
    }

    return NextResponse.json({ noticeSeenAt });
  } catch (error) {
    console.error("AI quota onboarding dismissal failed:", error);
    return NextResponse.json({ error: "AI_QUOTA_NOTICE_UPDATE_FAILED" }, { status: 503 });
  }
}
