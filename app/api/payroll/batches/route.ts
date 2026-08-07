import { NextRequest, NextResponse } from "next/server";

import { normalizeChain } from "@/lib/paycmd/chains";
import { usdcToAtomic } from "@/lib/paycmd/payroll-snapshot";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("payroll_batches")
    .select("*, payroll_items(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load payroll batches" }, { status: 500 });
  return NextResponse.json({ batches: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const groupId = String(body.groupId ?? "");
  const amount = String(body.amount ?? "");
  const sourceChain = normalizeChain(body.sourceChain);
  const recipientFingerprint = String(body.recipientFingerprint ?? "");
  try {
    if (!groupId || !sourceChain || !recipientFingerprint || usdcToAtomic(amount) <= 0n) {
      return NextResponse.json({ error: "Invalid payroll batch input" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid payroll batch input" }, { status: 400 });
  }

  const { data: batchId, error } = await supabase.rpc("create_payroll_batch_snapshot", {
    p_group_id: groupId,
    p_amount: amount,
    p_source_chain: sourceChain,
    p_expected_fingerprint: recipientFingerprint,
  });
  if (error) {
    const code = String(error.message ?? "");
    if (code.includes("PAYROLL_PREVIEW_STALE")) return NextResponse.json({ error: "PAYROLL_PREVIEW_STALE", code: "PAYROLL_PREVIEW_STALE" }, { status: 409 });
    if (code.includes("PAYROLL_GROUP_NOT_FOUND")) return NextResponse.json({ error: "PAYROLL_GROUP_NOT_FOUND", code: "PAYROLL_GROUP_NOT_FOUND" }, { status: 404 });
    if (code.includes("PAYROLL_GROUP_EMPTY")) return NextResponse.json({ error: "PAYROLL_GROUP_EMPTY", code: "PAYROLL_GROUP_EMPTY" }, { status: 400 });
    return NextResponse.json({ error: "Could not create payroll batch" }, { status: 500 });
  }

  const { data: batch, error: batchError } = await supabase
    .from("payroll_batches")
    .select("*, payroll_items(*)")
    .eq("id", batchId)
    .eq("user_id", user.id)
    .single();
  if (batchError) return NextResponse.json({ error: "Could not load payroll batch" }, { status: 500 });
  return NextResponse.json({ batch, items: batch.payroll_items ?? [] }, { status: 201 });
}
