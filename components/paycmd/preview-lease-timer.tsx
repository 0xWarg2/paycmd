"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { previewLeaseState } from "@/lib/paycmd/preview-lease";

export function PreviewLeaseTimer({ expiresAt, onExpire }: {
  expiresAt: string;
  onExpire: () => void;
}) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const expiredOnce = useRef(false);
  const lease = previewLeaseState(expiresAt, now);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!lease.expired || expiredOnce.current) return;
    expiredOnce.current = true;
    onExpire();
  }, [lease.expired, onExpire]);

  const seconds = String(lease.remainingSeconds).padStart(2, "0");
  const time = `00:${seconds}`;

  return (
    <div className={lease.remainingSeconds <= 5 ? "text-amber-500" : "text-muted-foreground"}>
      <span className="inline-flex items-center gap-1">
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        <span role="timer" aria-label={t("preview.timeRemaining", { time })}>{time}</span>
      </span>
      <span className="sr-only" aria-live="polite">
        {lease.expired ? t("preview.expired") : t("preview.confirmWithin")}
      </span>
    </div>
  );
}
