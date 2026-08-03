import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ActivityView, type ActivityNotification } from "@/components/paycmd/activity-view";
import { PayCmdShell } from "@/components/paycmd-shell";
import { createClient } from "@/lib/supabase/server";
import { activityTabFrom } from "@/lib/paycmd/ui-models";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await cookies();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/activity");

  const [{ tab }, notificationsResult] = await Promise.all([
    searchParams,
    supabase
      .from("notifications")
      .select("id, type, title, body, status, command_execution_id, created_at")
      .eq("user_id", user.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <PayCmdShell>
      <ActivityView
        initialTab={activityTabFrom(tab)}
        notifications={(notificationsResult.data ?? []) as ActivityNotification[]}
        notificationError={notificationsResult.error?.message}
      />
    </PayCmdShell>
  );
}
