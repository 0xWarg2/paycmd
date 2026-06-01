import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    notifications: [
      {
        id: "notif_demo_1",
        type: "command_success",
        title: "Payment command completed",
        body: "Demo settlement đã hoàn tất trên Arc Testnet.",
        status: "unread",
        commandExecutionId: "cmd_demo_1",
        createdAt: new Date().toISOString(),
      },
    ],
  });
}
