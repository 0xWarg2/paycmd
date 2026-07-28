"use client";

import { ReactNode } from "react";

import { PayCmdShell } from "@/components/paycmd-shell";

export function PayCmdSectionPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PayCmdShell>
      <div className="payna-shell-bg h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
          <div className="mb-6 rounded-2xl border border-border/60 bg-card/55 p-5 shadow-sm backdrop-blur-xl">
            <div className="text-sm font-medium text-primary">{eyebrow}</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal md:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </PayCmdShell>
  );
}
