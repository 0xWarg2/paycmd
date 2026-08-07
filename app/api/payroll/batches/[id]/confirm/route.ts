import { NextRequest, NextResponse } from "next/server";

import { executePayrollBatch, type PayrollExecutionItem } from "@/lib/paycmd/payroll-executor";
import { createClient } from "@/lib/supabase/server";

async function callGatewayTransfer(req: NextRequest, payload: Record<string, unknown>) {
  const response = await fetch(new URL("/api/gateway/transfer", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message ?? data?.error ?? `Gateway transfer failed: ${response.status}`);
  return data;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const execution = await executePayrollBatch({
    // This conditional update is the one-shot claim. A second click or request cannot run the
    // same snapshot because only a draft can transition to running.
    claimBatch: async () => {
      const { data: batch, error } = await supabase
        .from("payroll_batches")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", "draft")
        .select("id, source_chain")
        .maybeSingle();
      if (error) throw error;
      if (!batch) return { claimed: false };

      const { data: items, error: itemError } = await supabase
        .from("payroll_items")
        .select("id, amount, recipient_address, destination_chain")
        .eq("batch_id", id)
        .order("created_at", { ascending: true });
      if (itemError) throw itemError;
      return { claimed: true, batch, items: (items ?? []) as PayrollExecutionItem[] };
    },
    markItemRunning: async (itemId) => {
      const { error } = await supabase
        .from("payroll_items")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("batch_id", id);
      if (error) throw error;
    },
    transfer: (item, sourceChain) => callGatewayTransfer(req, {
      sourceChain,
      destinationChain: item.destination_chain,
      amount: String(item.amount),
      recipientAddress: item.recipient_address,
      autoDeposit: true,
      mintGasMode: "auto_forwarding",
    }),
    markItemSuccess: async (itemId, txHash) => {
      const { error } = await supabase
        .from("payroll_items")
        .update({ status: "success", tx_hash: txHash, updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("batch_id", id);
      if (error) throw error;
    },
    markItemFailed: async (itemId, message) => {
      const { error } = await supabase
        .from("payroll_items")
        .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("batch_id", id);
      if (error) throw error;
    },
    completeBatch: async (status) => {
      const { error } = await supabase
        .from("payroll_batches")
        .update({ status, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", "running");
      if (error) throw error;
    },
  });

  if (execution.alreadyStarted) {
    return NextResponse.json({ error: "PAYROLL_ALREADY_STARTED", code: "PAYROLL_ALREADY_STARTED" }, { status: 409 });
  }

  const failedCount = execution.results.filter((result) => result.status === "failed").length;
  const { error: notificationError } = await supabase.from("notifications").insert({
    user_id: user.id,
    type: "payroll_completed",
    title: "Payroll completed",
    body: `${execution.results.length - failedCount}/${execution.results.length} payroll payments succeeded.`,
    status: "unread",
    metadata: { batchId: id, results: execution.results },
  });
  if (notificationError) console.error("Could not write payroll notification", notificationError);

  return NextResponse.json({
    success: execution.status !== "failed",
    batchId: id,
    status: execution.status,
    results: execution.results,
  });
}
