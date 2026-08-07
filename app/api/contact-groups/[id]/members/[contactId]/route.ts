import { NextRequest, NextResponse } from "next/server";

import {
  ContactGroupError,
  createSupabaseContactGroupRepository,
  removeContactGroupMember,
} from "@/lib/paycmd/contact-group-service";
import { createClient } from "@/lib/supabase/server";

function errorResponse(error: unknown) {
  if (!(error instanceof ContactGroupError)) {
    return NextResponse.json({ error: "Could not manage contact groups" }, { status: 500 });
  }
  const status = error.code === "GROUP_NOT_FOUND" || error.code === "CONTACT_NOT_FOUND" ? 404 :
    error.code === "GROUP_OPERATION_FAILED" ? 500 : 400;
  return NextResponse.json({ error: error.code, code: error.code }, { status });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, contactId } = await params;
  try {
    await removeContactGroupMember(
      { userId: user.id, groupId: id, contactId },
      createSupabaseContactGroupRepository(supabase),
    );
    return NextResponse.json({ removed: true, groupId: id, contactId });
  } catch (error) {
    return errorResponse(error);
  }
}
