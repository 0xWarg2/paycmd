import { CalendarClock, Play } from "lucide-react";

import { PayCmdSectionPage } from "@/components/paycmd-section-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { schedules } from "@/lib/paycmd/demo-data";

export default function SchedulesPage() {
  return (
    <PayCmdSectionPage
      eyebrow="Recurring payments"
      title="Schedules"
      description="Quản lý các lệnh thanh toán định kỳ. V1 dùng manual demo runner thay vì cron thật để giữ luồng demo đơn giản."
    >
      <div className="grid gap-3">
        {schedules.map((schedule) => (
          <article
            key={`${schedule.name}_${schedule.amount}`}
            className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div>
                <div className="font-medium">{schedule.amount} to {schedule.name}</div>
                <div className="text-sm text-muted-foreground">Next run: {schedule.nextRun}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{schedule.cadence}</Badge>
              <Button size="sm" variant="outline">
                <Play className="mr-2 h-4 w-4" />
                Run demo
              </Button>
            </div>
          </article>
        ))}
      </div>
    </PayCmdSectionPage>
  );
}
