import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "GATEWAY_EOA_DELEGATION_REMOVED",
      message: "Payna now signs Gateway intents directly with the user's SCA.",
    },
    { status: 410 },
  );
}
