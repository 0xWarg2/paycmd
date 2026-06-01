import { Gauge } from "lucide-react";

import { PayCmdSectionPage } from "@/components/paycmd-section-page";
import { Badge } from "@/components/ui/badge";
import { budgets } from "@/lib/paycmd/demo-data";

export default function BudgetsPage() {
  return (
    <PayCmdSectionPage
      eyebrow="Operations"
      title="Budgets"
      description="Theo dõi hạn mức và mức sử dụng theo từng nhóm chi tiêu. Chat chỉ tạo lệnh, còn trang này dùng để audit và quản lý ngân sách."
    >
      <div className="grid gap-3 md:grid-cols-3">
        {budgets.map((budget) => {
          const percent = Math.min(100, (budget.used / budget.limit) * 100);

          return (
            <article key={budget.name} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <Gauge className="h-4 w-4 text-primary" />
                    {budget.name}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    ${budget.used} used of ${budget.limit}
                  </div>
                </div>
                <Badge variant="secondary">{budget.token}</Badge>
              </div>
              <div className="mt-4 h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
              <div className="mt-3 text-sm font-medium">${budget.limit - budget.used} available</div>
            </article>
          );
        })}
      </div>
    </PayCmdSectionPage>
  );
}
