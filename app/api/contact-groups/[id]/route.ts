import { NextRequest, NextResponse } from "next/server";

import {
  ContactGroupError,
  createSupabaseContactGroupRepository,
  deleteContactGroup,
  listContactGroups,
  updateContactGroup,
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

async function authenticatedRepository() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, repository: createSupabaseContactGroupRepository(supabase) };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, repository } = await authenticatedRepository();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const group = (await listContactGroups(user.id, repository)).find((candidate) => candidate.id === id);
    if (!group) return NextResponse.json({ error: "GROUP_NOT_FOUND", code: "GROUP_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ group });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, repository } = await authenticatedRepository();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const group = await updateContactGroup({ userId: user.id, groupId: id, name: String(body.name ?? "") }, repository);
    return NextResponse.json({ group });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, repository } = await authenticatedRepository();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteContactGroup({ userId: user.id, groupId: id }, repository);
    return NextResponse.json({ deleted: true, groupId: id });
  } catch (error) {
    return errorResponse(error);
  }
}
