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
      <div className="h-full overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
          <div className="mb-6">
            <div className="text-sm text-muted-foreground">{eyebrow}</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal md:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </PayCmdShell>
  );
}
