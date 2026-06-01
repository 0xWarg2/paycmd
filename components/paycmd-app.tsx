"use client";

import {
  Check,
  ChevronRight,
  Clock3,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
} from "lucide-react";
import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { PayCmdShell } from "@/components/paycmd-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  kind?: "text" | "preview" | "status";
  draft?: ParsedCommand;
  execution?: ExecutionItem;
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

const MESSAGE_PAGE_SIZE = 10;

const seedHistory: ChatMessage[] = Array.from({ length: 36 }, (_, index) => ({
  id: `seed_${index}`,
  role: index % 3 === 0 ? "user" : "assistant",
  text:
    index % 3 === 0
      ? `/pay ${10 + index} USDC to Minh`
      : `Command history #${index + 1} đã sẵn sàng để audit.`,
}));

const initialMessages: ChatMessage[] = [
  ...seedHistory,
  {
    id: "welcome",
    role: "assistant",
    text: "PayCMD đã sẵn sàng. Gõ / để chọn command hoặc thử /pay 50 USDC to Minh.",
  },
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
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [visibleCount, setVisibleCount] = useState(MESSAGE_PAGE_SIZE);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [, setExecutions] = useState<ExecutionItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previousScrollHeightRef = useRef<number | null>(null);

  const showPalette = input.trim() === "/" || input.startsWith("/");
  const visibleMessages = useMemo(
    () => messages.slice(Math.max(0, messages.length - visibleCount)),
    [messages, visibleCount],
  );
  const unreadCount = notifications.filter((item) => item.status === "unread").length;

  function addMessage(message: Omit<ChatMessage, "id"> & { id?: string }) {
    setMessages((current) => [
      ...current,
      { ...message, id: message.id ?? `${message.role}_${Date.now()}_${current.length}` },
    ]);
  }

  function addSystemStatus(text: string, execution: ExecutionItem) {
    addMessage({ role: "system", text, kind: "status", execution });
  }

  function loadOlderMessages() {
    const viewport = viewportRef.current;
    if (!viewport || visibleCount >= messages.length) return;

    previousScrollHeightRef.current = viewport.scrollHeight;
    setVisibleCount((current) => Math.min(messages.length, current + MESSAGE_PAGE_SIZE));
  }

  function handleViewportScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (viewport.scrollTop < 48) {
      loadOlderMessages();
    }
  }

  function scrollToLatest() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }

  async function submitCommand(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;

    const parsed = parsePayCmd(value);
    addMessage({ role: "user", text: value });
    setInput("");

    if (parsed.missingFields.length) {
      addMessage({ role: "assistant", text: missingFieldQuestion(parsed.missingFields[0]) });
      return;
    }

    const previewId = `preview_${Date.now()}`;
    setActiveDraftId(previewId);
    addMessage({
      id: previewId,
      role: "assistant",
      text: parsed.summary,
      kind: "preview",
      draft: parsed,
    });
  }

  function selectCommand(sample: string) {
    setInput(sample);
  }

  function confirmDraft(draft: ParsedCommand) {
    if (draft.missingFields.length) return;

    const execution = createDemoExecution(draft) as ExecutionItem;
    setActiveDraftId(null);
    setExecutions((current) => [execution, ...current]);
    addSystemStatus(`${execution.title} đã được đưa vào hàng đợi.`, execution);

    window.setTimeout(() => {
      const running = { ...execution, status: "running" as const };
      setExecutions((current) =>
        current.map((item) => (item.id === execution.id ? running : item)),
      );
      addSystemStatus(`${execution.title} đang được xử lý.`, running);
    }, 900);

    window.setTimeout(() => {
      const waiting = { ...execution, status: "waiting_gateway" as const };
      setExecutions((current) =>
        current.map((item) => (item.id === execution.id ? waiting : item)),
      );
      addSystemStatus(`${execution.title} đang chờ Circle Gateway.`, waiting);
    }, 2100);

    window.setTimeout(() => {
      const txHash = `0x${execution.id.replace(/\D/g, "").padEnd(64, "0").slice(0, 64)}`;
      const success = { ...execution, status: "success" as const, txHash };
      setExecutions((current) =>
        current.map((item) => (item.id === execution.id ? success : item)),
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
      addSystemStatus(`${execution.title} đã hoàn tất.`, success);
    }, 4200);
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const previousHeight = previousScrollHeightRef.current;
    if (!viewport || previousHeight === null) return;

    viewport.scrollTop = viewport.scrollHeight - previousHeight;
    previousScrollHeightRef.current = null;
  }, [visibleCount]);

  useEffect(() => {
    if (previousScrollHeightRef.current !== null) return;
    window.requestAnimationFrame(scrollToLatest);
  }, [messages.length]);

  return (
    <PayCmdShell>
      <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top_left,oklch(0.96_0.035_168),transparent_32%),linear-gradient(180deg,oklch(0.99_0.006_84),oklch(0.965_0.012_240))] dark:bg-[radial-gradient(circle_at_top_left,oklch(0.28_0.07_166),transparent_30%),linear-gradient(180deg,oklch(0.16_0.018_250),oklch(0.11_0.012_250))]">
        <header className="flex shrink-0 items-center justify-between border-b bg-card/92 px-4 py-3 backdrop-blur md:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Command chat
            </div>
            <h1 className="text-xl font-semibold tracking-normal md:text-2xl">Pay, budget, schedule</h1>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 ? <Badge>{unreadCount} new</Badge> : null}
            <Badge variant="secondary">USDC V1</Badge>
          </div>
        </header>

        <div
          ref={viewportRef}
          onScroll={handleViewportScroll}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
            {visibleMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                activeDraftId={activeDraftId}
                onConfirm={confirmDraft}
              />
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t bg-card/94 px-3 py-3 backdrop-blur md:px-6">
          <div className="mx-auto w-full max-w-3xl">
            {showPalette ? (
              <div className="mb-2 grid gap-2 rounded-xl border bg-background p-2 shadow-sm md:grid-cols-3">
                {commandRegistry.map((command) => (
                  <button
                    key={command.name}
                    className="rounded-lg border bg-card p-3 text-left transition hover:border-primary hover:bg-accent"
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

            <form
              className="flex items-center gap-2 rounded-2xl border bg-background p-2 shadow-sm"
              onSubmit={submitCommand}
            >
              <Button type="button" variant="ghost" size="icon" aria-label="Attach context">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Message PayCMD or type /"
                className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button type="submit" size="icon" aria-label="Send command">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </PayCmdShell>
  );
}

function MessageBubble({
  message,
  activeDraftId,
  onConfirm,
}: {
  message: ChatMessage;
  activeDraftId: string | null;
  onConfirm: (draft: ParsedCommand) => void;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm md:max-w-[74%] ${
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : isSystem
              ? "rounded-bl-md border bg-accent text-accent-foreground"
              : "rounded-bl-md border bg-card"
        }`}
      >
        {message.kind === "preview" && message.draft ? (
          <CommandPreviewCard
            draft={message.draft}
            disabled={activeDraftId !== message.id}
            onConfirm={() => onConfirm(message.draft as ParsedCommand)}
          />
        ) : message.kind === "status" && message.execution ? (
          <ExecutionStatus execution={message.execution} text={message.text} />
        ) : (
          <span>{message.text}</span>
        )}
      </div>
    </div>
  );
}

function CommandPreviewCard({
  draft,
  disabled,
  onConfirm,
}: {
  draft: ParsedCommand;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="min-w-[260px] space-y-3">
      <div>
        <div className="text-xs font-medium uppercase text-muted-foreground">Preview</div>
        <div className="font-semibold">{draft.summary}</div>
      </div>
      <div className="grid gap-2 text-xs">
        <Row label="Command" value={`/${draft.command}`} />
        {Object.entries(draft.fields).map(([key, value]) =>
          value ? <Row key={key} label={key} value={value} /> : null,
        )}
      </div>
      <div className="rounded-lg border bg-background p-2 text-xs text-muted-foreground">
        Rail: Circle Gateway · Network: Arc Testnet · Mode: demo
      </div>
      <Button className="w-full" disabled={disabled} onClick={onConfirm}>
        <Check className="mr-2 h-4 w-4" />
        {disabled ? "Confirmed" : "Confirm command"}
      </Button>
    </div>
  );
}

function ExecutionStatus({ execution, text }: { execution: ExecutionItem; text: string }) {
  const done = execution.status === "success";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-medium">
        {done ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        {statusLabel(execution.status)}
      </div>
      <div>{text}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        {execution.gateway.rail} · {execution.gateway.network}
      </div>
      {execution.txHash ? (
        <div className="break-all rounded-lg bg-background p-2 text-xs text-muted-foreground">
          {execution.txHash}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words font-medium">{value}</span>
    </div>
  );
}
