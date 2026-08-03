import { Check, Circle, Clock3, Loader2, ShieldAlert, Waypoints } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  executionStepsForStatus,
  type ExecutionDisplayStatus,
  type ExecutionStepKey,
  type TransactionPreviewModel,
} from "@/lib/paycmd/ui-models";

const defaultStepLabels: Record<ExecutionStepKey, string> = {
  prepared: "Prepared",
  wallet_approval: "Wallet approval",
  submitted: "Submitted",
  finalizing: "Finalizing",
  complete: "Complete",
};

export function TransactionPreviewFields({ model }: { model: TransactionPreviewModel }) {
  return (
    <div className="space-y-2">
      <dl className="grid gap-2 sm:grid-cols-2">
        {model.fields.map((field) => (
          <div key={field.key} className="rounded-xl border border-border/70 bg-background/58 px-3 py-2.5">
            <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {field.label}
            </dt>
            <dd className="mt-1 truncate text-sm font-semibold text-foreground" title={field.value}>
              {field.value}
            </dd>
          </div>
        ))}
        <div className="rounded-xl border border-border/70 bg-background/58 px-3 py-2.5">
          <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Fee</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">{model.fee}</dd>
        </div>
        <div className="rounded-xl border border-waiting/30 bg-waiting/5 px-3 py-2.5">
          <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Risk check</dt>
          <dd className="mt-1 text-sm font-semibold text-waiting-foreground">{model.risk}</dd>
        </div>
      </dl>
      <details className="rounded-xl border border-border/65 bg-muted/15 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium text-muted-foreground">Advanced details</summary>
        {model.advancedDetails.length ? (
          <dl className="mt-2 grid gap-2">
            {model.advancedDetails.map((field) => (
              <div key={field.key} className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">{field.label}</dt>
                <dd className="break-all font-medium">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-muted-foreground">No advanced settings for this command.</p>
        )}
      </details>
    </div>
  );
}

export function TransactionConfirmActions({
  confirmLabel,
  disabled,
  onConfirm,
  onCancel,
  cancelLabel = "Cancel",
}: {
  confirmLabel: string;
  disabled?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
      <Button type="button" size="lg" disabled={disabled} onClick={onConfirm} className="h-11 rounded-xl">
        <Check className="h-4 w-4" aria-hidden="true" />
        {confirmLabel}
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        onClick={onCancel}
        className="h-11 rounded-xl sm:order-first"
      >
        {cancelLabel}
      </Button>
    </div>
  );
}

export function ExecutionTimeline({
  status,
  labels = defaultStepLabels,
  waitingMessage,
  fundsMoved = false,
  submitted = false,
}: {
  status: ExecutionDisplayStatus;
  labels?: Record<ExecutionStepKey, string>;
  waitingMessage?: ReactNode;
  fundsMoved?: boolean;
  submitted?: boolean;
}) {
  const steps = executionStepsForStatus(status, { fundsMoved, submitted });

  return (
    <div className="space-y-3" aria-live="polite" aria-label={`Transaction status: ${status}`}>
      <ol className="grid grid-cols-5 gap-1" aria-label="Transaction progress">
        {steps.map((step, index) => {
          const isComplete = step.state === "complete";
          const isActive = step.state === "active";
          const isFailed = step.state === "failed";
          const Icon = isComplete ? Check : isActive ? Loader2 : isFailed ? ShieldAlert : Circle;

          return (
            <li key={step.key} className="relative min-w-0 text-center">
              {index ? (
                <span
                  className={cn(
                    "absolute right-1/2 top-3 h-px w-full",
                    isComplete || isActive ? "bg-primary/70" : "bg-border",
                  )}
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 mx-auto flex h-6 w-6 items-center justify-center rounded-full border bg-background",
                  isComplete && "border-primary bg-primary text-primary-foreground",
                  isActive && "border-info text-info",
                  isFailed && "border-danger bg-danger/10 text-danger",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "mt-1.5 block truncate text-[10px] text-muted-foreground sm:text-[11px]",
                  (isActive || isComplete) && "text-foreground",
                  isFailed && "text-danger",
                )}
              >
                {labels[step.key]}
              </span>
            </li>
          );
        })}
      </ol>
      {status === "waiting_gateway" ? (
        <div className="flex items-start gap-2 rounded-xl border border-waiting/35 bg-waiting/10 px-3 py-2 text-xs leading-5 text-waiting-foreground">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{waitingMessage ?? "Finality can take several minutes. You can leave this screen and follow progress in Activity."}</span>
        </div>
      ) : null}
    </div>
  );
}

export function TransactionSafetyHeader({
  title,
  description,
  rail,
}: {
  title: string;
  description?: string;
  rail?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <Waypoints className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Transaction preview
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-tight">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {rail ? <Badge variant="outline" className="shrink-0 rounded-full">{rail}</Badge> : null}
    </div>
  );
}
