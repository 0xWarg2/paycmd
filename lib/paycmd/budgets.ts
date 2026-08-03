import type { SupabaseClient } from "@supabase/supabase-js";

export type BudgetRow = {
  id: string;
  name: string;
  token: string;
  limit_amount: number | string;
  used_amount: number | string;
  status: string;
};

export type BudgetTransactionRow = {
  amount: number | string | null;
  tx_type: string | null;
  status: string | null;
  chain: string | null;
  created_at: string | null;
};

export function rollingWindowStartIso(days: number, nowMs: number = Date.now()) {
  return new Date(nowMs - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function loadBudgetDashboardData(
  supabase: SupabaseClient,
  userId: string,
) {
  const since = rollingWindowStartIso(30);
  const [budgetsResult, transactionsResult] = await Promise.all([
    supabase
      .from("budgets")
      .select("id, name, token, limit_amount, used_amount, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("transaction_history")
      .select("amount, tx_type, status, chain, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return {
    budgets: (budgetsResult.data ?? []) as BudgetRow[],
    transactions: (transactionsResult.data ?? []) as BudgetTransactionRow[],
  };
}
