import { NextResponse } from "next/server";

import { parsePayCmd } from "@/lib/paycmd/commands";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { input?: string };
  const parsed = parsePayCmd(body.input ?? "");

  if (parsed.missingFields.length) {
    return NextResponse.json(
      {
        error: "missing_fields",
        parsed,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    draft: {
      id: `draft_${Date.now()}`,
      status: "draft_ready",
      parsed,
      preview: {
        title: parsed.summary,
        token: parsed.fields.token,
        amount: parsed.fields.amount,
        recipient: parsed.fields.recipient,
        budgetName: parsed.fields.budgetName,
        frequency: parsed.fields.frequency,
        network: "Arc Testnet",
        rail: "Circle Gateway",
      },
    },
  });
}
