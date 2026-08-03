import { redirect } from "next/navigation";

export default function LegacyNotificationsPage() {
  redirect("/activity?tab=notifications");
}
