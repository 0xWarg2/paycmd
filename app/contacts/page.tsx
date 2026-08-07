import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ContactsList, type ContactGroupListItem } from "@/components/contacts-list";
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

  const [{ data: contacts }, { data: groups }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, display_name, role, preferred_chain, wallet_address, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("contact_groups")
      .select("id, user_id, name, normalized_name, contact_group_members(contacts(id, display_name, role, preferred_chain, wallet_address, status))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const initialGroups: ContactGroupListItem[] = (groups ?? []).map((group: any) => ({
    ...group,
    members: (group.contact_group_members ?? []).map((member: any) => member.contacts).filter(Boolean),
  }));

  return (
    <PayCmdSectionPage
      eyebrow="Directory"
      title="Contacts"
      description={tr(locale, "pages.contacts.description")}
    >
      <ContactsList initialContacts={contacts ?? []} initialGroups={initialGroups} />
    </PayCmdSectionPage>
  );
}
