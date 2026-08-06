import { NextRequest, NextResponse } from "next/server";

import { askResearch } from "@/lib/paycmd/ai/research";
import { AiAccessError, runDeepSeekWithQuota } from "@/lib/paycmd/ai/access";
import { walletContextRelevant } from "@/lib/paycmd/ai/wallet-context";
import {
  createServerWalletContextDependencies,
  loadAuthenticatedWalletContext,
} from "@/lib/paycmd/ai/wallet-context-server";
import { createClient } from "@/lib/supabase/server";

type CryptoResearchRequest = {
  input?: string;
  recentMessages?: { role: string; text: string }[];
  surfMode?: "instant" | "research";
  // `extended` and `maximum` are the pre-merge tiers. Still accepted because a client loaded before
  // this deployed keeps sending them; `mapLegacyEffort` in the research layer folds both into
  // `deep`. Written as a literal rather than the imported type so those legacy values stay valid
  // here without widening `ResearchEffort` itself.
  effort?: "standard" | "deep" | "extended" | "maximum";
  locale?: "vi" | "en";
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

    const { result, quota } = await runDeepSeekWithQuota(supabase, async () => {
      const walletContext = walletContextRelevant(input)
        ? await loadAuthenticatedWalletContext(
            user.id,
            createServerWalletContextDependencies({ getSupabase: async () => supabase }),
          )
        : null;

      return askResearch({
        input,
        recentMessages: body.recentMessages ?? [],
        surfMode: body.surfMode,
        effort: body.effort,
        locale: body.locale,
        walletContext,
      });
    });

    return NextResponse.json({
      ...result,
      // Legacy wire value, deliberately unchanged. The client reads this back out of persisted rows
      // through a hard allowlist to pick its rich research renderer, so every message already in the
      // database says "asksurf" — renaming it would make that history render as raw markdown.
      provider: "asksurf",
      quota,
    });
  } catch (error: any) {
    if (error instanceof AiAccessError) {
      return NextResponse.json(
        { error: error.code, message: error.message, quota: error.quota },
        { status: error.status },
      );
    }
    console.error("Research route failed:", error);

    if (error?.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Research timed out while gathering crypto data" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: error.message || "Research failed" },
      { status: error.status ?? 500 },
    );
  }
}
