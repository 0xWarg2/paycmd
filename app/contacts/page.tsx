import { Contact } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PayCmdSectionPage } from "@/components/paycmd-section-page";
import { Badge } from "@/components/ui/badge";
import { localeFromCookieStore, tr } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function ContactsPage() {
  const locale = localeFromCookieStore(await cookies());
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
      description={tr(locale, "pages.contacts.description")}
    >
      <div className="command-panel divide-y divide-border/60 overflow-hidden rounded-2xl">
        {(contacts ?? []).map((contact) => (
          <article key={contact.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
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
          <div className="p-8 text-center text-sm text-muted-foreground">
            {tr(locale, "pages.contacts.empty")}
          </div>
        )}
      </div>
    </PayCmdSectionPage>
  );
}
