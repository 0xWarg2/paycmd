import { NextResponse } from "next/server";

import { aiModelOptions, defaultAiModelProfile } from "@/lib/paycmd/ai/models";

export async function GET() {
  return NextResponse.json({
    defaultModelProfile: defaultAiModelProfile,
    models: aiModelOptions.map(({ id, label, description }) => ({ id, label, description })),
  });
}
