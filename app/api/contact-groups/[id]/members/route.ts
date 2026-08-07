import { NextRequest, NextResponse } from "next/server";

import {
  addContactGroupMember,
  ContactGroupError,
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const contactIds = Array.isArray(body.contactIds)
    ? [...new Set(body.contactIds.filter((contactId: unknown) => typeof contactId === "string" && contactId))]
    : [];
  const repository = createSupabaseContactGroupRepository(supabase);
  try {
    for (const contactId of contactIds) {
      await addContactGroupMember({ userId: user.id, groupId: id, contactId }, repository);
    }
    const group = (await listContactGroups(user.id, repository)).find((candidate) => candidate.id === id);
    if (!group) throw new ContactGroupError("GROUP_NOT_FOUND");
    return NextResponse.json({ group });
  } catch (error) {
    return errorResponse(error);
  }
}
