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
      <div className="command-center-canvas h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
          <header className="command-panel mb-6 rounded-2xl p-5 md:p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </header>
          {children}
        </div>
      </div>
    </PayCmdShell>
  );
}
