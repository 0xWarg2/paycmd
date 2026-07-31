import { NextResponse } from "next/server";

import { commandRouterModelLabel, commandRouterModelProfile } from "@/lib/paycmd/ai/models";

export async function GET() {
  return NextResponse.json({
    defaultModelProfile: commandRouterModelProfile,
    models: [{ id: commandRouterModelProfile, label: commandRouterModelLabel, description: "Default command router" }],
  });
}
