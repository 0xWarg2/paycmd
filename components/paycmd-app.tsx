"use client";

import {
  Bell,
  Bot,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  Command,
  Contact,
  Gauge,
  Landmark,
  Loader2,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  commandRegistry,
  createDemoExecution,
  parsePayCmd,
  ParsedCommand,
} from "@/lib/paycmd/commands";

type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  status: "unread" | "read";
  commandExecutionId: string;
};

type ExecutionItem = ReturnType<typeof createDemoExecution> & {
  status: "queued" | "running" | "waiting_gateway" | "success" | "failed";
  txHash?: string;
};

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "PayCMD đã sẵn sàng. Gõ / để chọn command hoặc thử /pay 50 USDC to Minh.",
  },
];

const contacts = [
  { name: "Minh", role: "Contributor", wallet: "0x92...4A1c" },
  { name: "Linh", role: "Designer", wallet: "0x38...9D22" },
  { name: "Ops Vault", role: "Treasury", wallet: "0x71...Bf90" },
];

const budgets = [
  { name: "Marketing", limit: 500, used: 175 },
  { name: "Contributors", limit: 1200, used: 420 },
  { name: "Ops", limit: 800, used: 210 },
];

const schedules = [
  { name: "Minh", amount: "25 USDC", cadence: "Monthly", nextRun: "Demo" },
  { name: "Linh", amount: "40 USDC", cadence: "Weekly", nextRun: "Paused" },
];

function missingFieldQuestion(field: string) {
  const labels: Record<string, string> = {
    amount: "Bạn muốn dùng số tiền bao nhiêu?",
    token: "Bạn muốn dùng token nào?",
    recipient: "Bạn muốn gửi cho ai?",
    budgetName: "Bạn muốn đặt tên ngân sách là gì?",
    frequency: "Bạn muốn lịch chạy daily, weekly hay monthly?",
    command: "Bạn muốn dùng /pay, /createbudget hay /schedule?",
  };

  return labels[field] ?? `Bạn cần bổ sung ${field}.`;
}

function statusLabel(status: ExecutionItem["status"]) {
  const labels = {
    queued: "Queued",
    running: "Running",
    waiting_gateway: "Gateway",
    success: "Success",
    failed: "Failed",
  };

  return labels[status];
}

export function PayCmdApp() {
  const [input, setInput] = useState("/pay 50 USDC to Minh");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [activeDraft, setActiveDraft] = useState<ParsedCommand | null>(null);
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeCommand, setActiveCommand] = useState("Chat");

  const showPalette = input.trim() === "/" || input.startsWith("/");
  const latestExecution = executions[0];
  const unreadCount = notifications.filter((item) => item.status === "unread").length;

  const totalBalance = useMemo(() => {
    return budgets.reduce((sum, budget) => sum + budget.limit - budget.used, 0);
  }, []);

  function addMessage(role: ChatMessage["role"], text: string) {
    setMessages((current) => [
      ...current,
      { id: `${role}_${Date.now()}_${current.length}`, role, text },
    ]);
  }

  async function submitCommand(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;

    const parsed = parsePayCmd(value);
    addMessage("user", value);
    setInput("");

    if (parsed.missingFields.length) {
      setActiveDraft(parsed);
      addMessage("assistant", missingFieldQuestion(parsed.missingFields[0]));
      return;
    }

    setActiveDraft(parsed);
    addMessage("assistant", `Đã tạo preview: ${parsed.summary}. Kiểm tra panel bên phải rồi confirm.`);
  }

  function selectCommand(sample: string) {
    setInput(sample);
    setActiveCommand("Chat");
  }

  function confirmDraft() {
    if (!activeDraft || activeDraft.missingFields.length) return;

    const execution = createDemoExecution(activeDraft) as ExecutionItem;
    setExecutions((current) => [execution, ...current]);
    setActiveDraft(null);
    addMessage("assistant", `${execution.title} đã được đưa vào hàng đợi. Bạn có thể tiếp tục thao tác khác.`);

    window.setTimeout(() => {
      setExecutions((current) =>
        current.map((item) =>
          item.id === execution.id ? { ...item, status: "running" } : item,
        ),
      );
    }, 900);

    window.setTimeout(() => {
      setExecutions((current) =>
        current.map((item) =>
          item.id === execution.id ? { ...item, status: "waiting_gateway" } : item,
        ),
      );
    }, 2100);

    window.setTimeout(() => {
      const txHash = `0x${execution.id.replace(/\D/g, "").padEnd(64, "0").slice(0, 64)}`;
      setExecutions((current) =>
        current.map((item) =>
          item.id === execution.id ? { ...item, status: "success", txHash } : item,
        ),
      );
      setNotifications((current) => [
        {
          id: `notif_${execution.id}`,
          title: "Command completed",
          body: `${execution.title} đã settlement trên demo rail.`,
          status: "unread",
          commandExecutionId: execution.id,
        },
        ...current,
      ]);
      addMessage("system", `${execution.title} đã hoàn tất. Notification mới đã được tạo.`);
    }, 4200);
  }

  function markNotificationRead(id: string) {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, status: "read" } : item)),
    );
    setActiveCommand("Notifications");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)_360px]">
        <aside className="border-b border-border bg-card px-4 py-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between lg:block">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Command className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-normal">PayCMD</div>
                <div className="text-xs text-muted-foreground">Stablecoin command center</div>
              </div>
            </div>
            <Badge className="lg:hidden">{unreadCount}</Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-md border bg-background p-3 lg:grid-cols-1">
            <div className="text-xs text-muted-foreground">Gateway balance</div>
            <div className="text-xl font-semibold">${totalBalance.toLocaleString()} USDC</div>
            <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground lg:col-span-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Arc Testnet · Circle Gateway
            </div>
          </div>

          <nav className="mt-5 grid grid-cols-3 gap-2 lg:grid-cols-1">
            {[
              ["Chat", Bot],
              ["Budgets", Gauge],
              ["Contacts", Contact],
              ["Schedules", CalendarClock],
              ["Notifications", Bell],
            ].map(([label, Icon]) => {
              const NavigationIcon = Icon as typeof Bot;
              return (
                <button
                  key={label as string}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition lg:justify-start ${
                    activeCommand === label
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                  onClick={() => setActiveCommand(label as string)}
                >
                  <NavigationIcon className="h-4 w-4" />
                  <span>{label as string}</span>
                  {label === "Notifications" && unreadCount > 0 ? (
                    <Badge className="ml-auto hidden lg:inline-flex">{unreadCount}</Badge>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-h-[720px] flex-col">
          <header className="flex items-center justify-between border-b bg-card px-5 py-4">
            <div>
              <div className="text-sm text-muted-foreground">Command chat</div>
              <h1 className="text-2xl font-semibold tracking-normal">Pay, budget, schedule</h1>
            </div>
            <Badge variant="secondary" className="gap-2">
              <CircleDollarSign className="h-4 w-4" />
              USDC V1
            </Badge>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[82%] rounded-md px-4 py-3 text-sm leading-6 shadow-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : message.role === "system"
                        ? "border bg-accent text-accent-foreground"
                        : "border bg-card"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t bg-card p-4">
            {showPalette ? (
              <div className="mb-3 grid gap-2 rounded-md border bg-background p-2 md:grid-cols-3">
                {commandRegistry.map((command) => (
                  <button
                    key={command.name}
                    className="rounded-md border bg-card p-3 text-left hover:border-primary"
                    onClick={() => selectCommand(command.sample)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">/{command.name}</div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{command.sample}</div>
                  </button>
                ))}
              </div>
            ) : null}

            <form className="flex gap-2" onSubmit={submitCommand}>
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="/pay 50 USDC to Minh"
                className="h-12"
              />
              <Button type="submit" className="h-12 px-4" aria-label="Send command">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </section>

        <aside className="border-t bg-card p-4 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Context panel</div>
              <h2 className="text-xl font-semibold tracking-normal">{activeCommand}</h2>
            </div>
            {latestExecution ? <Badge>{statusLabel(latestExecution.status)}</Badge> : null}
          </div>

          <div className="mt-4 space-y-4">
            {activeDraft ? (
              <div className="rounded-md border bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <WalletCards className="h-4 w-4 text-primary" />
                  Draft preview
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <Row label="Command" value={`/${activeDraft.command}`} />
                  <Row label="Summary" value={activeDraft.summary} />
                  {Object.entries(activeDraft.fields).map(([key, value]) =>
                    value ? <Row key={key} label={key} value={value} /> : null,
                  )}
                </div>
                {activeDraft.missingFields.length ? (
                  <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    Thiếu: {activeDraft.missingFields.join(", ")}
                  </div>
                ) : (
                  <Button className="mt-4 w-full" onClick={confirmDraft}>
                    <Check className="mr-2 h-4 w-4" />
                    Confirm command
                  </Button>
                )}
              </div>
            ) : null}

            <Panel title="Budgets" icon={Landmark}>
              {budgets.map((budget) => (
                <div key={budget.name} className="rounded-md border bg-background p-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{budget.name}</span>
                    <span>${budget.used} / ${budget.limit}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (budget.used / budget.limit) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </Panel>

            <Panel title="Contacts" icon={Contact}>
              {contacts.map((contact) => (
                <div key={contact.name} className="flex items-center justify-between rounded-md border bg-background p-3">
                  <div>
                    <div className="text-sm font-medium">{contact.name}</div>
                    <div className="text-xs text-muted-foreground">{contact.role}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{contact.wallet}</div>
                </div>
              ))}
            </Panel>

            <Panel title="Schedules" icon={CalendarClock}>
              {schedules.map((schedule) => (
                <div key={`${schedule.name}_${schedule.amount}`} className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{schedule.amount} to {schedule.name}</span>
                    <Badge variant="secondary">{schedule.cadence}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Next run: {schedule.nextRun}</div>
                </div>
              ))}
            </Panel>

            <Panel title="Notifications" icon={Bell}>
              {notifications.length ? (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    className="w-full rounded-md border bg-background p-3 text-left text-sm hover:border-primary"
                    onClick={() => markNotificationRead(notification.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{notification.title}</span>
                      {notification.status === "unread" ? <Badge>New</Badge> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{notification.body}</div>
                    <div className="mt-2 text-xs text-primary">{notification.commandExecutionId}</div>
                  </button>
                ))
              ) : (
                <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                  Chưa có notification.
                </div>
              )}
            </Panel>

            {latestExecution ? (
              <div className="rounded-md border bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {latestExecution.status === "success" ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  Command detail
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <Row label="Execution" value={latestExecution.id} />
                  <Row label="Status" value={statusLabel(latestExecution.status)} />
                  <Row label="Rail" value={latestExecution.gateway.rail} />
                  <Row label="Network" value={latestExecution.gateway.network} />
                  {latestExecution.txHash ? <Row label="Tx" value={latestExecution.txHash} /> : null}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words font-medium">{value}</span>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Bot;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
