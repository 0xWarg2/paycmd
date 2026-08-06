import { NextResponse } from "next/server";

import { handleContactDeletion } from "@/lib/paycmd/contact-deletion";
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
      const { data, error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", requestedContactId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      if (error) return { kind: "error" as const, message: error.message };
      if (!data) return { kind: "not_found" as const };
      return { kind: "deleted" as const, id: data.id };
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
