import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

async function callGatewayTransfer(req: NextRequest, payload: Record<string, unknown>) {
  const response = await fetch(new URL("/api/gateway/transfer", req.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message ?? data?.error ?? `Gateway transfer failed: ${response.status}`);
  }

  return data;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: batch, error: batchError } = await supabase
    .from("payroll_batches")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  if (!batch) {
    return NextResponse.json({ error: "Payroll batch not found" }, { status: 404 });
  }

  const { data: items, error: itemError } = await supabase
    .from("payroll_items")
    .select("*")
    .eq("batch_id", id)
    .order("created_at", { ascending: true });

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  await supabase
    .from("payroll_batches")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", id);

  const results = [];

  for (const item of items ?? []) {
    await supabase
      .from("payroll_items")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", item.id);

    try {
      const transfer = await callGatewayTransfer(req, {
        sourceChain: batch.source_chain || item.destination_chain,
        destinationChain: item.destination_chain,
        amount: String(item.amount),
        recipientAddress: item.recipient_address,
        autoDeposit: true,
        mintGasMode: "auto_forwarding",
      });
      const txHash = transfer.mintTxHash ?? transfer.txHash ?? transfer.transferId ?? null;

      await supabase
        .from("payroll_items")
        .update({
          status: "success",
          tx_hash: txHash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      results.push({ itemId: item.id, status: "success", txHash, transfer });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payroll item failed";
      await supabase
        .from("payroll_items")
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      results.push({ itemId: item.id, status: "failed", error: message });
    }
  }

  const failedCount = results.filter((result) => result.status === "failed").length;
  const finalStatus = failedCount === 0 ? "success" : failedCount === results.length ? "failed" : "partial_failed";

  await supabase
    .from("payroll_batches")
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "payroll_completed",
    title: "Payroll completed",
    body: `${results.length - failedCount}/${results.length} payroll payments succeeded.`,
    status: "unread",
    metadata: { batchId: id, results },
  });

  return NextResponse.json({
    success: finalStatus !== "failed",
    batchId: id,
    status: finalStatus,
    results,
  });
}
