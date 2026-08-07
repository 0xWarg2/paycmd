import { notFound } from "next/navigation";

import { ContactsList, type ContactGroupListItem, type ContactListItem } from "@/components/contacts-list";

const fixtureContacts: ContactListItem[] = [
  {
    id: "contact-minh",
    display_name: "Minh",
    role: "Contributor",
    preferred_chain: "arcTestnet",
    wallet_address: "0x1111111111111111111111111111111111111111",
    status: "active",
  },
  {
    id: "contact-lan",
    display_name: "Lan",
    role: null,
    preferred_chain: "baseSepolia",
    wallet_address: "0x2222222222222222222222222222222222222222",
    status: "active",
  },
];

const coreTeam: ContactGroupListItem = {
  id: "group-core-team",
  name: "Core Team",
  normalized_name: "core team",
  members: [fixtureContacts[0]],
};

export default async function ContactsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ single?: string; group?: string }>;
}) {
  if (process.env.NODE_ENV === "production" || process.env.PAYNA_UI_FIXTURE !== "1") {
    notFound();
  }
  const { single, group } = await searchParams;

  return (
    <main className="command-center-canvas min-h-dvh p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-semibold">Contacts fixture</h1>
        <ContactsList
          initialContacts={single === "1" ? fixtureContacts.slice(0, 1) : fixtureContacts}
          initialGroups={group === "core-team" ? [coreTeam] : []}
          previewMode
        />
      </div>
    </main>
  );
}
