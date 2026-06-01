import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return NextResponse.json({
    execution: {
      id: `cmd_schedule_${Date.now()}`,
      scheduleId: id,
      status: "queued",
      title: "Schedule demo runner queued",
      createdAt: new Date().toISOString(),
    },
  });
}
