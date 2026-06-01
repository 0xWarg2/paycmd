import { NextResponse } from "next/server";

import { createDemoExecution, parsePayCmd } from "@/lib/paycmd/commands";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { input?: string };
  const parsed = parsePayCmd(body.input ?? "");
  const execution = createDemoExecution(parsed);

  return NextResponse.json({
    execution: {
      ...execution,
      draftId: id,
    },
  });
}
