import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return NextResponse.json({
    execution: {
      id,
      status: "success",
      title: "Command đã settlement trên demo rail",
      gateway: {
        network: "Arc Testnet",
        rail: "Circle Gateway",
        txHash: `0x${id.replace(/\D/g, "").padEnd(64, "0").slice(0, 64)}`,
      },
      completedAt: new Date().toISOString(),
    },
  });
}
