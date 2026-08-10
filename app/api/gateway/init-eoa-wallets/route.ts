import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "GATEWAY_EOA_WALLETS_REMOVED",
      message: "Gateway EOA wallet creation has been removed; the Circle SCA is the only signer.",
    },
    { status: 410 },
  );
}
