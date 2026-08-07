import { NextRequest, NextResponse } from "next/server";

import {
  ContactGroupError,
  createContactGroup,
  createSupabaseContactGroupRepository,
  listContactGroups,
} from "@/lib/paycmd/contact-group-service";
import { createClient } from "@/lib/supabase/server";

function errorResponse(error: unknown) {
  if (!(error instanceof ContactGroupError)) {
    return NextResponse.json({ error: "Could not manage contact groups" }, { status: 500 });
  }

  const status = error.code === "GROUP_NAME_EXISTS" ? 409 :
    error.code === "GROUP_NOT_FOUND" || error.code === "CONTACT_NOT_FOUND" ? 404 :
      error.code === "GROUP_OPERATION_FAILED" ? 500 : 400;
  return NextResponse.json({ error: error.code, code: error.code }, { status });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const groups = await listContactGroups(user.id, createSupabaseContactGroupRepository(supabase));
    return NextResponse.json({ groups });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  try {
    const group = await createContactGroup(
      { userId: user.id, name: String(body.name ?? "") },
      createSupabaseContactGroupRepository(supabase),
    );
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
