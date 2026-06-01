import { NextResponse } from "next/server";

import { commandRegistry, parsePayCmd } from "@/lib/paycmd/commands";

export async function GET() {
  return NextResponse.json({ commands: commandRegistry });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { input?: string };
  const parsed = parsePayCmd(body.input ?? "");

  return NextResponse.json({ parsed });
}
