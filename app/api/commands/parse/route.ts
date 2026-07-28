import { NextResponse } from "next/server";

import { requestLocale } from "@/lib/i18n/server";
import { commandRegistry, parsePayCmd } from "@/lib/paycmd/commands";

export async function GET() {
  return NextResponse.json({ commands: commandRegistry });
}

export async function POST(request: Request) {
  const locale = requestLocale(request);
  const body = (await request.json().catch(() => ({}))) as { input?: string };
  const parsed = parsePayCmd(body.input ?? "", locale);

  return NextResponse.json({ parsed });
}
