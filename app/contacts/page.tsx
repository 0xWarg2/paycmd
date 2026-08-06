import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ContactsList } from "@/components/contacts-list";
import { PayCmdSectionPage } from "@/components/paycmd-section-page";
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
    .select("id, display_name, role, preferred_chain, wallet_address, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <PayCmdSectionPage
      eyebrow="Directory"
      title="Contacts"
      description={tr(locale, "pages.contacts.description")}
    >
      <ContactsList initialContacts={contacts ?? []} />
    </PayCmdSectionPage>
  );
}
