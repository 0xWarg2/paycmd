import { NextRequest, NextResponse } from "next/server";

import { askSurfResearch } from "@/lib/paycmd/ai/surf";
import { createClient } from "@/lib/supabase/server";

type CryptoResearchRequest = {
  input?: string;
  recentMessages?: { role: string; text: string }[];
  surfMode?: "instant" | "research";
  effort?: "standard" | "extended" | "maximum";
};

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as CryptoResearchRequest;
    const input = body.input?.trim() ?? "";

    if (!input) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const result = await askSurfResearch({
      input,
      recentMessages: body.recentMessages ?? [],
      surfMode: body.surfMode,
      effort: body.effort,
    });

    return NextResponse.json({
      ...result,
      provider: "asksurf",
    });
  } catch (error: any) {
    console.error("AskSurf crypto route failed:", error);

    if (error?.name === "TimeoutError") {
      return NextResponse.json(
        { error: "AskSurf timed out while researching crypto data" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: error.message || "AskSurf research failed" },
      { status: error.status ?? 500 },
    );
  }
}
