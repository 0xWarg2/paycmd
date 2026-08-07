"use client";

import { Contact, Pencil, Trash2, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export type ContactListItem = {
  id: string;
  display_name: string;
  role: string | null;
  preferred_chain: string | null;
  wallet_address: string;
  status: string;
};

export type ContactGroupListItem = {
  id: string;
  user_id?: string;
  name: string;
  normalized_name?: string;
  members: ContactListItem[];
};

type GroupDialog = "create" | "rename" | "members" | "delete" | null;

export function ContactsList({
  initialContacts,
  initialGroups = [],
  previewMode = false,
}: {
  initialContacts: ContactListItem[];
  initialGroups?: ContactGroupListItem[];
  previewMode?: boolean;
}) {
  const { t } = useI18n();
  const [contacts, setContacts] = useState(initialContacts);
  const [groups, setGroups] = useState(initialGroups);
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupDialog, setGroupDialog] = useState<GroupDialog>(null);
  const [editingGroup, setEditingGroup] = useState<ContactGroupListItem | null>(null);
  const [groupName, setGroupName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const deleteButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const createGroupRef = useRef<HTMLButtonElement | null>(null);
  const emptyStateRef = useRef<HTMLDivElement | null>(null);
  const focusAfterCloseRef = useRef<
    { kind: "trigger" } | { kind: "contact"; id: string } | { kind: "empty" } | { kind: "groups" }
  >({ kind: "trigger" });

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const visibleContacts = useMemo(
    () => selectedGroup ? contacts.filter((contact) => selectedGroup.members.some((member) => member.id === contact.id)) : contacts,
    [contacts, selectedGroup],
  );

  function closeGroupDialog() {
    setGroupDialog(null);
    setEditingGroup(null);
    setGroupName("");
    setMemberIds([]);
  }

  function openCreateGroup() {
    triggerRef.current = createGroupRef.current;
    focusAfterCloseRef.current = { kind: "groups" };
    setGroupName("");
    setGroupDialog("create");
  }

  function openRenameGroup(group: ContactGroupListItem) {
    triggerRef.current = null;
    focusAfterCloseRef.current = { kind: "groups" };
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDialog("rename");
  }

  function openMembers(group: ContactGroupListItem, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    focusAfterCloseRef.current = { kind: "trigger" };
    setEditingGroup(group);
    setMemberIds(group.members.map((member) => member.id));
    setGroupDialog("members");
  }

  function openDeleteGroup(group: ContactGroupListItem, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    focusAfterCloseRef.current = { kind: "groups" };
    setEditingGroup(group);
    setGroupDialog("delete");
  }

  async function groupRequest(path: string, options: RequestInit, previewResult: () => ContactGroupListItem | null) {
    if (previewMode) return previewResult();
    const response = await fetch(path, options);
    if (!response.ok) throw new Error("group request failed");
    const payload = await response.json();
    return (payload.group ?? null) as ContactGroupListItem | null;
  }

  async function saveGroup() {
    if (savingGroup) return;
    const name = groupName.trim();
    if (!name) return;
    setSavingGroup(true);
    try {
      if (groupDialog === "create") {
        const created = await groupRequest(
          "/api/contact-groups",
          { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) },
          () => ({ id: `preview-group-${Date.now()}`, name, normalized_name: name.toLocaleLowerCase("und"), members: [] }),
        );
        if (!created) throw new Error("group missing");
        setGroups((current) => [...current, created]);
        setSelectedGroupId(created.id);
      } else if (groupDialog === "rename" && editingGroup) {
        const updated = await groupRequest(
          `/api/contact-groups/${encodeURIComponent(editingGroup.id)}`,
          { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) },
          () => ({ ...editingGroup, name, normalized_name: name.toLocaleLowerCase("und") }),
        );
        if (!updated) throw new Error("group missing");
        setGroups((current) => current.map((group) => group.id === updated.id ? { ...group, ...updated } : group));
      }
      closeGroupDialog();
    } catch {
      toast.error(t("contacts.groupSaveError"));
    } finally {
      setSavingGroup(false);
    }
  }

  async function saveMembers() {
    if (!editingGroup || savingGroup) return;
    setSavingGroup(true);
    try {
      const selected = contacts.filter((contact) => memberIds.includes(contact.id));
      if (previewMode) {
        setGroups((current) => current.map((group) => group.id === editingGroup.id ? { ...group, members: selected } : group));
      } else {
        const currentIds = new Set(editingGroup.members.map((member) => member.id));
        const nextIds = new Set(memberIds);
        const added = memberIds.filter((contactId) => !currentIds.has(contactId));
        const removed = editingGroup.members.map((member) => member.id).filter((contactId) => !nextIds.has(contactId));
        if (added.length > 0) {
          const response = await fetch(`/api/contact-groups/${encodeURIComponent(editingGroup.id)}/members`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ contactIds: added }),
          });
          if (!response.ok) throw new Error("members add failed");
        }
        for (const contactId of removed) {
          const response = await fetch(
            `/api/contact-groups/${encodeURIComponent(editingGroup.id)}/members/${encodeURIComponent(contactId)}`,
            { method: "DELETE" },
          );
          if (!response.ok) throw new Error("members remove failed");
        }
        setGroups((current) => current.map((group) => group.id === editingGroup.id ? { ...group, members: selected } : group));
      }
      closeGroupDialog();
    } catch {
      toast.error(t("contacts.groupSaveError"));
    } finally {
      setSavingGroup(false);
    }
  }

  async function deleteGroup() {
    if (!editingGroup || savingGroup) return;
    setSavingGroup(true);
    try {
      if (!previewMode) {
        const response = await fetch(`/api/contact-groups/${encodeURIComponent(editingGroup.id)}`, { method: "DELETE" });
        if (!response.ok) throw new Error("group deletion failed");
      }
      setGroups((current) => current.filter((group) => group.id !== editingGroup.id));
      if (selectedGroupId === editingGroup.id) setSelectedGroupId(null);
      closeGroupDialog();
    } catch {
      toast.error(t("contacts.groupSaveError"));
    } finally {
      setSavingGroup(false);
    }
  }

  async function deleteSelectedContact() {
    if (!selectedContact || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(selectedContact.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Contact deletion failed");
      const deletedName = selectedContact.display_name;
      const deletedId = selectedContact.id;
      const deletedIndex = visibleContacts.findIndex((contact) => contact.id === deletedId);
      const adjacentContact = visibleContacts[deletedIndex + 1] ?? visibleContacts[deletedIndex - 1];
      focusAfterCloseRef.current = adjacentContact ? { kind: "contact", id: adjacentContact.id } : { kind: "empty" };
      setContacts((current) => current.filter((contact) => contact.id !== deletedId));
      setGroups((current) => current.map((group) => ({ ...group, members: group.members.filter((member) => member.id !== deletedId) })));
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
      <section className="mb-6 rounded-2xl border border-border/60 bg-card/60 p-4" aria-label={t("contacts.groups")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">{t("contacts.groups")}</h2>
          <Button ref={createGroupRef} type="button" size="sm" onClick={openCreateGroup}>{t("contacts.createGroup")}</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selectedGroupId === null ? "default" : "outline"} size="sm" onClick={() => setSelectedGroupId(null)}>
            {t("contacts.allContacts")} · {contacts.length}
          </Button>
          {groups.map((group) => (
            <div key={group.id} className="flex items-center rounded-md border border-border/60 bg-background/60">
              <Button
                type="button"
                variant={selectedGroupId === group.id ? "default" : "ghost"}
                size="sm"
                aria-label={`${group.name} · ${t("contacts.members", { count: group.members.length })}`}
                onClick={() => setSelectedGroupId(group.id)}
              >
                {group.name} · {t("contacts.members", { count: group.members.length })}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("contacts.manageMembers", { name: group.name })} onClick={(event) => openMembers(group, event.currentTarget)}>
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("contacts.renameGroup", { name: group.name })} onClick={() => openRenameGroup(group)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={t("contacts.deleteGroup", { name: group.name })} onClick={(event) => openDeleteGroup(group, event.currentTarget)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <div className="command-panel divide-y divide-border/60 overflow-hidden rounded-2xl">
        {visibleContacts.map((contact) => (
          <article key={contact.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Contact className="h-4 w-4" aria-hidden="true" /></div>
              <div className="min-w-0">
                <div className="font-medium">{contact.display_name}</div>
                <div className="text-sm text-muted-foreground">{contact.role ?? contact.preferred_chain}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{contact.wallet_address}</div>
                <div className="mt-2 flex flex-wrap gap-1">{groups.filter((group) => group.members.some((member) => member.id === contact.id)).map((group) => <Badge key={group.id} variant="secondary">{group.name}</Badge>)}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={contact.status === "active" ? "default" : "secondary"}>{contact.status}</Badge>
              <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:text-destructive" aria-label={t("contacts.deleteLabel", { name: contact.display_name })} aria-haspopup="dialog" ref={(element) => { if (element) deleteButtonRefs.current.set(contact.id, element); else deleteButtonRefs.current.delete(contact.id); }} onClick={(event) => { triggerRef.current = event.currentTarget; focusAfterCloseRef.current = { kind: "trigger" }; setSelectedContact(contact); }}><Trash2 aria-hidden="true" /></Button>
            </div>
          </article>
        ))}
        {visibleContacts.length === 0 ? <div ref={emptyStateRef} tabIndex={-1} className="p-8 text-center text-sm text-muted-foreground">{selectedGroup ? t("contacts.groupEmpty") : t("pages.contacts.empty")}</div> : null}
      </div>

      <Dialog open={selectedContact !== null} onOpenChange={(open) => { if (!open && !deleting) setSelectedContact(null); }}>
        <DialogContent showCloseButton={false} onCloseAutoFocus={(event) => { event.preventDefault(); window.requestAnimationFrame(() => { const target = focusAfterCloseRef.current; if (target.kind === "contact") deleteButtonRefs.current.get(target.id)?.focus(); else if (target.kind === "empty") emptyStateRef.current?.focus(); else if (target.kind === "groups") createGroupRef.current?.focus(); else triggerRef.current?.focus(); }); }}>
          <DialogHeader><DialogTitle>{t("contacts.deleteTitle")}</DialogTitle><DialogDescription>{t("contacts.deleteDescription", { name: selectedContact?.display_name })}</DialogDescription></DialogHeader>
          <DialogFooter><Button type="button" variant="outline" disabled={deleting} onClick={() => setSelectedContact(null)}>{t("common.cancel")}</Button><Button type="button" variant="destructive" disabled={deleting} onClick={deleteSelectedContact}>{deleting ? t("contacts.deletePending") : t("contacts.deleteAction")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={groupDialog !== null} onOpenChange={(open) => { if (!open && !savingGroup) closeGroupDialog(); }}>
        <DialogContent showCloseButton={false}>
          {groupDialog === "create" || groupDialog === "rename" ? <><DialogHeader><DialogTitle>{groupDialog === "create" ? t("contacts.createGroup") : t("contacts.renameGroup", { name: editingGroup?.name ?? "" })}</DialogTitle></DialogHeader><label className="grid gap-2 text-sm font-medium" htmlFor="contact-group-name">{t("contacts.groupName")}<Input id="contact-group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} autoFocus /></label><DialogFooter><Button type="button" variant="outline" disabled={savingGroup} onClick={closeGroupDialog}>{t("common.cancel")}</Button><Button type="button" disabled={savingGroup || !groupName.trim()} onClick={saveGroup}>{t("contacts.saveGroup")}</Button></DialogFooter></> : null}
          {groupDialog === "members" && editingGroup ? <><DialogHeader><DialogTitle>{t("contacts.manageMembers", { name: editingGroup.name })}</DialogTitle><DialogDescription>{t("contacts.members", { count: memberIds.length })}</DialogDescription></DialogHeader><div className="max-h-72 space-y-2 overflow-y-auto">{contacts.map((contact) => <label key={contact.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-border/60 p-3"><input type="checkbox" aria-label={contact.display_name} checked={memberIds.includes(contact.id)} onChange={(event) => setMemberIds((current) => event.target.checked ? [...current, contact.id] : current.filter((id) => id !== contact.id))} /><span>{contact.display_name}</span></label>)}</div><DialogFooter><Button type="button" variant="outline" disabled={savingGroup} onClick={closeGroupDialog}>{t("common.cancel")}</Button><Button type="button" disabled={savingGroup} onClick={saveMembers}>{t("contacts.saveMembers")}</Button></DialogFooter></> : null}
          {groupDialog === "delete" && editingGroup ? <><DialogHeader><DialogTitle>{t("contacts.deleteGroupTitle")}</DialogTitle><DialogDescription>{t("contacts.deleteGroupDescription", { name: editingGroup.name })}</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" disabled={savingGroup} onClick={closeGroupDialog}>{t("common.cancel")}</Button><Button type="button" variant="destructive" disabled={savingGroup} onClick={deleteGroup}>{t("contacts.deleteGroupAction")}</Button></DialogFooter></> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
