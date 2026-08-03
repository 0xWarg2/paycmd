import { redirect } from "next/navigation";

export default function LegacyHistoryPage() {
  redirect("/activity?tab=transactions");
}
