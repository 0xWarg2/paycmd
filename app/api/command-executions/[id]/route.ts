import { NextResponse } from "next/server";

import { requestLocale, tr } from "@/lib/i18n/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const locale = requestLocale(request);
  const { id } = await params;

  return NextResponse.json({
    execution: {
      id,
      status: "success",
      title: tr(locale, "commandExecution.demoTitle"),
      gateway: {
        network: "Arc Testnet",
        rail: "Circle Gateway",
        txHash: `0x${id.replace(/\D/g, "").padEnd(64, "0").slice(0, 64)}`,
      },
      completedAt: new Date().toISOString(),
    },
  });
}
