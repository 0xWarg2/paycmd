import { NextResponse } from "next/server";

import {
  deleteOwnedContactWithSupabase,
  handleContactDeletion,
} from "@/lib/paycmd/contact-deletion";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const result = await handleContactDeletion(id, {
    getAuthenticatedUserId: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    deleteOwnedContact: async (requestedContactId, userId) => {
      return deleteOwnedContactWithSupabase(
        supabase.from("contacts"),
        requestedContactId,
        userId,
      );
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
