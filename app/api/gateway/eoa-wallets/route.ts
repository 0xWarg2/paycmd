import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "GATEWAY_EOA_WALLETS_REMOVED", wallets: [] },
    { status: 410 },
  );
}
