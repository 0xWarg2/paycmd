import { Contact } from "lucide-react";

import { PayCmdSectionPage } from "@/components/paycmd-section-page";
import { Badge } from "@/components/ui/badge";
import { contacts } from "@/lib/paycmd/demo-data";

export default function ContactsPage() {
  return (
    <PayCmdSectionPage
      eyebrow="Directory"
      title="Contacts"
      description="Danh bạ người nhận và contributor. Khi user gõ /pay to Minh, PayCMD sẽ lookup contact này để lấy wallet address thật."
    >
      <div className="divide-y rounded-lg border bg-card shadow-sm">
        {contacts.map((contact) => (
          <article key={contact.name} className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Contact className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">{contact.name}</div>
                <div className="text-sm text-muted-foreground">{contact.role}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{contact.wallet}</div>
              </div>
            </div>
            <Badge variant={contact.status === "Ready" ? "default" : "secondary"}>
              {contact.status}
            </Badge>
          </article>
        ))}
      </div>
    </PayCmdSectionPage>
  );
}
