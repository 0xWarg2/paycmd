import { Contact } from "lucide-react";
import { redirect } from "next/navigation";

import { PayCmdSectionPage } from "@/components/paycmd-section-page";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export default async function ContactsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/contacts");

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <PayCmdSectionPage
      eyebrow="Directory"
      title="Contacts"
      description="Danh bạ người nhận và contributor. Khi user gõ /pay to Minh, PayCMD sẽ lookup contact này để lấy wallet address thật."
    >
      <div className="divide-y rounded-lg border bg-card shadow-sm">
        {(contacts ?? []).map((contact) => (
          <article key={contact.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Contact className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">{contact.display_name}</div>
                <div className="text-sm text-muted-foreground">{contact.role ?? contact.preferred_chain}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{contact.wallet_address}</div>
              </div>
            </div>
            <Badge variant={contact.status === "active" ? "default" : "secondary"}>
              {contact.status}
            </Badge>
          </article>
        ))}
        {contacts?.length ? null : (
          <div className="p-4 text-sm text-muted-foreground">
            Chưa có contact. Thử /contacts add Minh 0x... on arc trong chat.
          </div>
        )}
      </div>
    </PayCmdSectionPage>
  );
}
