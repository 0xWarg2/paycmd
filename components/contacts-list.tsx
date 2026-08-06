"use client";

import { Contact, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

export type ContactListItem = {
  id: string;
  display_name: string;
  role: string | null;
  preferred_chain: string | null;
  wallet_address: string;
  status: string;
};

export function ContactsList({ initialContacts }: { initialContacts: ContactListItem[] }) {
  const { t } = useI18n();
  const [contacts, setContacts] = useState(initialContacts);
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function deleteSelectedContact() {
    if (!selectedContact || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/contacts/${encodeURIComponent(selectedContact.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        await response.json().catch(() => null);
        throw new Error("Contact deletion failed");
      }
      const deletedName = selectedContact.display_name;
      const deletedId = selectedContact.id;
      setContacts((current) => current.filter((contact) => contact.id !== deletedId));
      setSelectedContact(null);
      toast.success(t("contacts.deleteSuccess", { name: deletedName }));
    } catch {
      toast.error(t("contacts.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="command-panel divide-y divide-border/60 overflow-hidden rounded-2xl">
        {contacts.map((contact) => (
          <article key={contact.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Contact className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">{contact.display_name}</div>
                <div className="text-sm text-muted-foreground">{contact.role ?? contact.preferred_chain}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{contact.wallet_address}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={contact.status === "active" ? "default" : "secondary"}>{contact.status}</Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:text-destructive"
                aria-label={t("contacts.deleteLabel", { name: contact.display_name })}
                aria-haspopup="dialog"
                onClick={() => setSelectedContact(contact)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </article>
        ))}
        {contacts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("pages.contacts.empty")}</div>
        ) : null}
      </div>

      <Dialog
        open={selectedContact !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setSelectedContact(null);
        }}
      >
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>{t("contacts.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("contacts.deleteDescription", { name: selectedContact?.display_name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setSelectedContact(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={deleteSelectedContact}>
              {deleting ? t("contacts.deletePending") : t("contacts.deleteAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
