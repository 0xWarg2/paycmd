import { AiAccessError, runDeepSeekWithQuota, type AiQuota } from "../../../../lib/paycmd/ai/access.ts";
import {
  askResearch,
  type ResearchOptions,
  type ResearchResult,
} from "../../../../lib/paycmd/ai/research.ts";
import {
  walletContextRelevant as defaultWalletContextRelevant,
  type WalletContext,
} from "../../../../lib/paycmd/ai/wallet-context.ts";
import {
  createServerWalletContextDependencies,
  loadAuthenticatedWalletContext,
} from "../../../../lib/paycmd/ai/wallet-context-server.ts";

type ResearchResponse = {
  result: ResearchResult;
  quota: AiQuota;
};

export type CryptoResearchRouteDependencies = {
  createClient: () => Promise<CryptoResearchClient>;
  runWithQuota: (
    client: CryptoResearchClient,
    call: () => Promise<ResearchResult>,
  ) => Promise<ResearchResponse>;
  walletContextRelevant: (input: string) => boolean;
  loadWalletContext: (userId: string, client: CryptoResearchClient) => Promise<WalletContext>;
  research: (options: ResearchOptions) => Promise<ResearchResult>;
};

type CryptoResearchRequest = {
  input?: string;
  recentMessages?: { role: string; text: string }[];
  surfMode?: "instant" | "research";
  effort?: "standard" | "deep" | "extended" | "maximum";
  locale?: "vi" | "en";
};

type QuotaClient = Parameters<typeof runDeepSeekWithQuota>[0];
type WalletDependencyOptions = NonNullable<Parameters<typeof createServerWalletContextDependencies>[0]>;
type WalletClientFactory = NonNullable<WalletDependencyOptions["getSupabase"]>;
type WalletClient = Awaited<ReturnType<WalletClientFactory>>;
type AuthenticatedUser = { id: string };
type CryptoResearchClient = {
  auth: {
    getUser: () => Promise<{ data: { user: AuthenticatedUser | null } }>;
  };
  rpc?: QuotaClient["rpc"];
  from?: WalletClient["from"];
};

const defaultDependencies: CryptoResearchRouteDependencies = {
  createClient: async () => {
    const { createClient } = await import("../../../../lib/supabase/server.ts");
    return createClient();
  },
  runWithQuota: (client, call) => {
    if (!client.rpc) throw new Error("Research quota client is unavailable");
    return runDeepSeekWithQuota({ rpc: client.rpc.bind(client) }, call);
  },
  walletContextRelevant: defaultWalletContextRelevant,
  loadWalletContext: (userId, client) => {
    if (!client.from) throw new Error("Research wallet client is unavailable");
    const from = client.from.bind(client);
    return loadAuthenticatedWalletContext(
      userId,
      createServerWalletContextDependencies({
        getSupabase: async () => ({ from }),
      }),
    );
  },
  research: askResearch,
};

function errorRecord(error: unknown) {
  return error && typeof error === "object" ? error as { name?: string; message?: string; status?: number } : {};
}

export function createCryptoResearchHandler(
  dependencies: CryptoResearchRouteDependencies = defaultDependencies,
) {
  return async function handleCryptoResearch(req: Request) {
    try {
      const supabase = await dependencies.createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = (await req.json().catch(() => ({}))) as CryptoResearchRequest;
      const input = body.input?.trim() ?? "";

      if (!input) {
        return Response.json({ error: "input is required" }, { status: 400 });
      }

      const { result, quota } = await dependencies.runWithQuota(supabase, async () => {
        const walletContext = dependencies.walletContextRelevant(input)
          ? await dependencies.loadWalletContext(user.id, supabase)
          : null;

        return dependencies.research({
          input,
          recentMessages: body.recentMessages ?? [],
          surfMode: body.surfMode,
          effort: body.effort,
          locale: body.locale,
          walletContext,
        });
      });

      return Response.json({
        ...result,
        // Legacy wire value, deliberately unchanged. Existing persisted messages use this value to
        // select the rich AskPayna renderer.
        provider: "asksurf",
        quota,
      });
    } catch (error: unknown) {
      if (error instanceof AiAccessError) {
        return Response.json(
          { error: error.code, message: error.message, quota: error.quota },
          { status: error.status },
        );
      }

      console.error("Research route failed:", error);
      const details = errorRecord(error);
      if (details.name === "TimeoutError") {
        return Response.json(
          { error: "Research timed out while gathering crypto data" },
          { status: 504 },
        );
      }

      return Response.json(
        { error: details.message || "Research failed" },
        { status: details.status ?? 500 },
      );
    }
  };
}
