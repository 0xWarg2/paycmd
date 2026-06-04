import { Bell, ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";

import { PayCmdSectionPage } from "@/components/paycmd-section-page";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/notifications");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <PayCmdSectionPage
      eyebrow="Command results"
      title="Notifications"
      description="Kết quả command được gom ở đây để user không phải chờ trong chat. Sau này mỗi item sẽ mở command execution detail thật."
    >
      <div className="divide-y rounded-lg border bg-card shadow-sm">
        {(notifications ?? []).map((notification) => (
          <article key={notification.id} className="flex items-start justify-between gap-4 p-4">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">{notification.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{notification.body}</div>
                <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                  {notification.type}
                  <ExternalLink className="h-3 w-3" />
                </div>
              </div>
            </div>
            <Badge variant={notification.status === "unread" ? "default" : "secondary"}>
              {notification.status}
            </Badge>
          </article>
        ))}
        {notifications?.length ? null : (
          <div className="p-4 text-sm text-muted-foreground">
            Chưa có notification.
          </div>
        )}
      </div>
    </PayCmdSectionPage>
  );
}
