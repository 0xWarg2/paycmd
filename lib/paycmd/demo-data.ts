import { CalendarClock, Contact, Gauge, MessageCircle, Bell, UserCircle } from "lucide-react";

export const contacts = [
  { name: "Minh", role: "Contributor", wallet: "0x92...4A1c", status: "Ready" },
  { name: "Linh", role: "Designer", wallet: "0x38...9D22", status: "Ready" },
  { name: "Ops Vault", role: "Treasury", wallet: "0x71...Bf90", status: "Review" },
];

export const budgets = [
  { name: "Marketing", limit: 500, used: 175, token: "USDC" },
  { name: "Contributors", limit: 1200, used: 420, token: "USDC" },
  { name: "Ops", limit: 800, used: 210, token: "USDC" },
];

export const schedules = [
  { name: "Minh", amount: "25 USDC", cadence: "Monthly", nextRun: "Demo runner" },
  { name: "Linh", amount: "40 USDC", cadence: "Weekly", nextRun: "Paused" },
  { name: "Ops Vault", amount: "100 USDC", cadence: "Quarterly", nextRun: "Draft" },
];

export const demoNotifications = [
  {
    id: "notif_seed_1",
    title: "Payment command completed",
    body: "50 USDC to Minh settled on demo rail.",
    status: "read",
    commandExecutionId: "cmd_seed_1",
  },
  {
    id: "notif_seed_2",
    title: "Budget created",
    body: "Marketing budget is ready for payment approvals.",
    status: "read",
    commandExecutionId: "cmd_seed_2",
  },
];

export const navigationItems = [
  { label: "Chat", href: "/app", icon: MessageCircle },
  { label: "Budgets", href: "/budgets", icon: Gauge },
  { label: "Contacts", href: "/contacts", icon: Contact },
  { label: "Schedules", href: "/schedules", icon: CalendarClock },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: UserCircle },
];

export function availableBudget() {
  return budgets.reduce((sum, budget) => sum + budget.limit - budget.used, 0);
}
