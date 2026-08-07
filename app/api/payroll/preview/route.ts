import { NextRequest, NextResponse } from "next/server";

import { normalizeContactGroupName } from "@/lib/paycmd/contact-groups";
import { normalizeChain } from "@/lib/paycmd/chains";
import { normalizePayrollPreview, usdcToAtomic } from "@/lib/paycmd/payroll-snapshot";
import { createClient } from "@/lib/supabase/server";

function isEvmAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const groupName = String(body.groupName ?? "").trim();
  const amount = String(body.amount ?? "").trim();
  const sourceChain = normalizeChain(body.sourceChain);
  try {
    if (!groupName || !sourceChain || usdcToAtomic(amount) <= 0n) {
      return NextResponse.json({ error: "Invalid payroll preview input" }, { status: 400 });
    }

    const { data: group, error: groupError } = await supabase
      .from("contact_groups")
      .select("id, name, normalized_name, contact_group_members(contact_id, created_at, contacts(id, display_name, wallet_address, preferred_chain, status))")
      .eq("user_id", user.id)
      .eq("normalized_name", normalizeContactGroupName(groupName))
      .maybeSingle();
    if (groupError) throw groupError;
    if (!group) return NextResponse.json({ error: "PAYROLL_GROUP_NOT_FOUND", code: "PAYROLL_GROUP_NOT_FOUND" }, { status: 404 });

    const [{ data: recipientRows, error: recipientError }, { data: fingerprint, error: fingerprintError }] = await Promise.all([
      supabase.rpc("payroll_group_recipients", { p_group_id: group.id }),
      supabase.rpc("payroll_recipient_fingerprint", { p_group_id: group.id }),
    ]);
    if (recipientError) throw recipientError;
    if (fingerprintError) throw fingerprintError;

    const recipients = (recipientRows ?? []).map((row: any) => ({
      contactId: row.contact_id,
      label: row.recipient_label,
      address: row.recipient_address,
      destinationChain: row.destination_chain,
    }));
    const included = new Set(recipients.map((recipient: { contactId: string }) => recipient.contactId));
    const excluded = (group.contact_group_members ?? []).flatMap((member: any) => {
      const contact = member.contacts;
      if (!contact) return [{ reason: "contact_missing" }];
      if (included.has(contact.id)) return [];
      return [{
        contactId: contact.id,
        label: contact.display_name,
        reason: contact.status !== "active" ? "inactive" : !isEvmAddress(contact.wallet_address) ? "invalid_address" : "over_cap",
      }];
    });
    const preview = normalizePayrollPreview({
      group_id: group.id,
      group_name: group.name,
      recipients,
      excluded,
      per_recipient_amount: amount,
      source_chain: sourceChain,
      recipient_fingerprint: String(fingerprint ?? ""),
    });
    return NextResponse.json({ preview });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PAYROLL_PREVIEW_FAILED";
    if (code === "PAYROLL_GROUP_EMPTY") return NextResponse.json({ error: code, code }, { status: 400 });
    if (code === "INVALID_USDC_AMOUNT") return NextResponse.json({ error: code, code }, { status: 400 });
    return NextResponse.json({ error: "Could not preview payroll" }, { status: 500 });
  }
}
