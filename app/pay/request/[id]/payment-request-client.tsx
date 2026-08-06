"use client";

import { ArrowLeft, Check, Loader2, QrCode } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { PayCmdShell } from "@/components/paycmd-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PaymentRequest = {
  id: string;
  amount: string | number;
  token: string;
  destination_chain: string;
  recipient_address: string;
  payer_label: string | null;
  memo: string | null;
  status: string;
};

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error ?? data?.message ?? `Request failed: ${response.status}`);
  }

  return data;
}

export function PaymentRequestClient({ requestId }: { requestId: string }) {
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [sourceChain, setSourceChain] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    async function loadRequest() {
      try {
        const data = await requestJson(`/api/payment-requests/${requestId}`);
        setRequest(data.request);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not load request";
        setStatus(message);
      }
    }

    void loadRequest();
  }, [requestId]);

  async function payRequest() {
    setIsPaying(true);
    setStatus("Payment is running through Circle Gateway...");
    try {
      const data = await requestJson(`/api/payment-requests/${requestId}/pay`, {
        method: "POST",
        body: JSON.stringify({ sourceChain: sourceChain || undefined }),
      });
      setStatus(`Paid. Tx: ${data.transfer?.destinationTxHash ?? data.transfer?.mintTxHash ?? data.transfer?.txHash ?? "pending"}`);
      const refreshed = await requestJson(`/api/payment-requests/${requestId}`);
      setRequest(refreshed.request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed";
      setStatus(message);
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <PayCmdShell>
      <main className="flex min-h-full items-center justify-center bg-background p-4">
        <section className="w-full max-w-xl rounded-xl border bg-card p-5 shadow-sm">
          <Link href="/app" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Payna
          </Link>

          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent">
              <QrCode className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Payment request</div>
              <h1 className="text-2xl font-semibold tracking-normal">Confirm USDC payment</h1>
            </div>
          </div>

          {request ? (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-lg border bg-background p-4 text-sm">
                <Row label="Amount" value={`${request.amount} ${request.token}`} />
                <Row label="Chain" value={request.destination_chain} />
                <Row label="To" value={request.recipient_address} />
                <Row label="Memo" value={request.memo ?? "No memo"} />
                <Row label="Status" value={request.status} />
              </div>

              <Input
                value={sourceChain}
                onChange={(event) => setSourceChain(event.target.value)}
                placeholder={`Source chain, default ${request.destination_chain}`}
              />

              <Button className="w-full" disabled={isPaying || request.status !== "pending"} onClick={payRequest}>
                {isPaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {request.status === "pending" ? "Confirm and pay" : `Request ${request.status}`}
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
              Loading request...
            </div>
          )}

          {status ? (
            <div className="mt-4 break-words rounded-lg border bg-accent p-3 text-sm">
              {status}
            </div>
          ) : null}
        </section>
      </main>
    </PayCmdShell>
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
