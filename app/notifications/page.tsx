import { Bell, ExternalLink } from "lucide-react";

import { PayCmdSectionPage } from "@/components/paycmd-section-page";
import { Badge } from "@/components/ui/badge";
import { demoNotifications } from "@/lib/paycmd/demo-data";

export default function NotificationsPage() {
  return (
    <PayCmdSectionPage
      eyebrow="Command results"
      title="Notifications"
      description="Kết quả command được gom ở đây để user không phải chờ trong chat. Sau này mỗi item sẽ mở command execution detail thật."
    >
      <div className="divide-y rounded-lg border bg-card shadow-sm">
        {demoNotifications.map((notification) => (
          <article key={notification.id} className="flex items-start justify-between gap-4 p-4">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">{notification.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{notification.body}</div>
                <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                  {notification.commandExecutionId}
                  <ExternalLink className="h-3 w-3" />
                </div>
              </div>
            </div>
            <Badge variant={notification.status === "unread" ? "default" : "secondary"}>
              {notification.status}
            </Badge>
          </article>
        ))}
      </div>
    </PayCmdSectionPage>
  );
}
