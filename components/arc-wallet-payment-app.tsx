"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits, stringToHex, toHex, type Address, type Hex } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { arcWalletNetworks, parseArcWalletPayment, type ArcWalletPayment } from "@/lib/paycmd/arc-payment";
import type { ArcPaymentNetwork } from "@/lib/paycmd/chains";

// An injected EIP-1193 provider is only used for wallet prompts. All settlement reads use
// the server's independent, chain-verified RPC, never the wallet's current chain.
type WalletProvider = {
  isMetaMask?: boolean; providers?: WalletProvider[];
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};
function injectedWallet() {
  const provider = (window as unknown as { ethereum?: WalletProvider }).ethereum;
  const metamask = provider?.providers?.find((wallet) => wallet.isMetaMask) ?? provider;
  if (!metamask?.isMetaMask) throw new Error("Cài đặt hoặc bật MetaMask để kết nối ví.");
  return metamask;
}
function rejection(error: unknown) {
  return (error as { code?: number })?.code === 4001;
}
const recoveryKey = (payment: ArcWalletPayment) => `payna:arc-wallet:${payment.user_id}:${payment.network}:${payment.id}`;
const statusText = {
  prepared: "Preview • chưa gửi", signing: "Chờ ký / cần kiểm tra ví", submitted: "Đã gửi • đang chờ receipt",
  success: "Thành công • đã xác minh trên chain", failed: "Thất bại • reverted trên chain", rejected: "Đã từ chối ký • chưa gửi",
} as const;

async function paymentApi(path: string, network: ArcPaymentNetwork, body?: unknown) {
  const response = await fetch(`/api/arc-payments${path}`, {
    method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "x-payna-network": network },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Không thể kiểm tra thanh toán.");
  return result;
}

export function ArcWalletPaymentApp({ mainnetEnabled }: { mainnetEnabled: boolean }) {
  const [network, setNetwork] = useState<ArcPaymentNetwork>("mainnet");
  const [address, setAddress] = useState<Address | null>(null);
  const [command, setCommand] = useState("");
  const [preview, setPreview] = useState<{ payment: ArcWalletPayment; ownershipMessage: string } | null>(null);
  const [history, setHistory] = useState<ArcWalletPayment[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [recoveryHash, setRecoveryHash] = useState("");
  const networkRef = useRef(network);
  const busyRef = useRef(false);
  const providerRef = useRef<WalletProvider | null>(null);
  const requestKeyRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const historyRef = useRef<ArcWalletPayment[]>([]);
  const meta = arcWalletNetworks[network];
  const enabled = network === "testnet" || mainnetEnabled;

  const refreshHistory = useCallback(async (selected: ArcPaymentNetwork) => {
    const result = await paymentApi(`?network=${selected}`, selected);
    if (networkRef.current === selected) {
      const payments = result.payments as ArcWalletPayment[];
      historyRef.current = payments;
      setHistory(payments);
    }
  }, []);

  useEffect(() => {
    networkRef.current = network;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        // A saved broadcast is recovered before polling. No wallet request is made here.
        for (const payment of historyRef.current.filter((p) => p.network === network && (p.status === "submitted" || p.status === "signing"))) {
          if (busyRef.current || cancelled) break;
          const savedHash = window.localStorage.getItem(recoveryKey(payment));
          if (payment.status === "signing" && savedHash) await paymentApi(`/${payment.id}`, network, { action: "submit", txHash: savedHash });
          if (payment.status === "submitted" || savedHash) await paymentApi(`/${payment.id}`, network, { action: "sync" });
        }
        if (!cancelled) await refreshHistory(network);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Không thể tải lịch sử. Giao dịch có hash vẫn đang được theo dõi.");
      } finally {
        if (!cancelled) timer = setTimeout(poll, 10_000);
      }
    };
    void poll();
    const focus = () => { if (!busyRef.current) void refreshHistory(network).catch(() => {}); };
    window.addEventListener("focus", focus);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [network, refreshHistory]);

  useEffect(() => {
    let provider: WalletProvider;
    try { provider = injectedWallet(); providerRef.current = provider; } catch { return; }
    const changed = (...args: unknown[]) => {
      attemptRef.current += 1;
      setPreview(null); requestKeyRef.current = null;
      if (Array.isArray(args[0])) setAddress((args[0][0] as Address | undefined) ?? null);
    };
    provider.on?.("accountsChanged", changed);
    provider.on?.("chainChanged", changed);
    return () => { provider.removeListener?.("accountsChanged", changed); provider.removeListener?.("chainChanged", changed); };
  }, []);

  async function ensureWallet(selected: ArcPaymentNetwork, expected?: Address) {
    const provider = providerRef.current ?? injectedWallet();
    providerRef.current = provider;
    const accounts = await provider.request({ method: "eth_accounts" }) as Address[];
    if (!accounts[0] || (expected && accounts[0].toLowerCase() !== expected.toLowerCase())) throw new Error("Tài khoản ví đã thay đổi. Tạo preview mới.");
    const chainId = await provider.request({ method: "eth_chainId" }) as string;
    if (Number(chainId) !== arcWalletNetworks[selected].chainId) throw new Error(`Chuyển MetaMask sang ${arcWalletNetworks[selected].name} trước khi tiếp tục.`);
    return provider;
  }

  async function connect() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const provider = injectedWallet(); providerRef.current = provider;
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as Address[];
      if (!accounts[0]) throw new Error("MetaMask chưa cung cấp địa chỉ ví.");
      setAddress(accounts[0]);
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: toHex(meta.chainId) }] });
      } catch (cause) {
        if ((cause as { code?: number }).code !== 4902) throw cause;
        await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: toHex(meta.chainId), chainName: meta.name, nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: [meta.rpcUrl], blockExplorerUrls: [meta.explorer] }] });
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: toHex(meta.chainId) }] });
      }
      await ensureWallet(network, accounts[0]);
      setStage("Ví đã kết nối. Nhập /pay để tạo preview.");
    } catch (cause) { setError(rejection(cause) ? "Bạn đã từ chối kết nối/chuyển mạng." : cause instanceof Error ? cause.message : "Kết nối ví thất bại."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function prepare() {
    if (busyRef.current || !address || !enabled) return;
    busyRef.current = true; setBusy(true); setError(""); setPreview(null);
    const attempt = attemptRef.current;
    try {
      parseArcWalletPayment(command, network);
      await ensureWallet(network, address);
      requestKeyRef.current ??= crypto.randomUUID();
      const result = await paymentApi("", network, { network, command, sender: address, requestKey: requestKeyRef.current });
      if (attempt !== attemptRef.current || networkRef.current !== network) throw new Error("Ví hoặc mạng đã thay đổi. Tạo preview mới.");
      if (result.payment.status !== "prepared") throw new Error("Lệnh này đã được xác nhận. Kiểm tra lịch sử trước khi gửi thêm.");
      if (Date.parse(result.payment.expires_at) <= Date.now()) {
        requestKeyRef.current = null;
        throw new Error("Preview cũ đã hết hạn. Bấm Xem preview để lấy phí mới.");
      }
      setPreview(result); setStage("Kiểm tra mạng, người nhận, số tiền và mức phí tối đa trước khi xác nhận.");
      await refreshHistory(network);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Preview thất bại."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function confirm() {
    if (busyRef.current || !preview || !enabled) return;
    busyRef.current = true; setBusy(true); setError("");
    const payment = preview.payment;
    let claimed = false;
    let sendRequested = false;
    let broadcastHash: Hex | null = null;
    try {
      if (Date.parse(payment.expires_at) <= Date.now()) {
        setPreview(null); requestKeyRef.current = null;
        throw new Error("Preview đã hết hạn. Tạo preview mới.");
      }
      const provider = await ensureWallet(payment.network, payment.sender);
      setStage("Chờ ký xác nhận preview trong MetaMask…");
      const signature = await provider.request({ method: "personal_sign", params: [stringToHex(preview.ownershipMessage), payment.sender] });
      await ensureWallet(payment.network, payment.sender);
      await paymentApi(`/${payment.id}`, payment.network, { action: "confirm", signature });
      claimed = true;
      await ensureWallet(payment.network, payment.sender);
      setStage("Chờ ký giao dịch USDC trong MetaMask…");
      sendRequested = true;
      broadcastHash = await provider.request({ method: "eth_sendTransaction", params: [{
        from: payment.sender, to: arcWalletNetworks[payment.network].usdcAddress, data: payment.call_data,
        value: "0x0", chainId: toHex(payment.chain_id), gas: toHex(BigInt(payment.gas_limit)),
        maxFeePerGas: toHex(BigInt(payment.max_fee_per_gas)), maxPriorityFeePerGas: toHex(BigInt(payment.max_priority_fee_per_gas)),
      }] }) as Hex;
      // Persist synchronously before any API/read. Reload only resumes monitoring this hash.
      try { window.localStorage.setItem(recoveryKey(payment), broadcastHash); } catch { /* Still record through API below; never resend. */ }
      setStage(`Đã gửi ${broadcastHash}. Đang chờ receipt; không gửi lại.`);
      setPreview(null); requestKeyRef.current = null;
      await paymentApi(`/${payment.id}`, payment.network, { action: "submit", txHash: broadcastHash });
      const settled = await paymentApi(`/${payment.id}`, payment.network, { action: "sync" });
      setStage(`${statusText[settled.payment.status as ArcWalletPayment["status"]]} · ${broadcastHash}`);
      await refreshHistory(payment.network);
    } catch (cause) {
      if (claimed && !broadcastHash && (!sendRequested || rejection(cause))) {
        await paymentApi(`/${payment.id}`, payment.network, { action: "reject" }).catch(() => {});
        setStage("Chưa gửi giao dịch. Bạn có thể tạo preview mới.");
        requestKeyRef.current = null; setPreview(null);
      } else if (claimed) {
        setPreview(null);
        setStage(broadcastHash ? `Đã gửi ${broadcastHash}. Kiểm tra lịch sử hoặc khôi phục hash; không gửi lại.` : "Chưa xác định giao dịch đã được gửi chưa. Kiểm tra Activity của MetaMask và khôi phục hash trước khi gửi thêm.");
      }
      setError(rejection(cause) ? "Bạn đã từ chối ký trong MetaMask." : cause instanceof Error ? cause.message : "Không thể xác định trạng thái giao dịch.");
      await refreshHistory(payment.network).catch(() => {});
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function recover(payment: ArcWalletPayment) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      if (!/^0x[\da-fA-F]{64}$/.test(recoveryHash)) throw new Error("Nhập transaction hash hợp lệ từ MetaMask.");
      window.localStorage.setItem(recoveryKey(payment), recoveryHash);
      await paymentApi(`/${payment.id}`, payment.network, { action: "submit", txHash: recoveryHash });
      await paymentApi(`/${payment.id}`, payment.network, { action: "sync" });
      await refreshHistory(payment.network); setRecoveryHash("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể khôi phục giao dịch."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  const inflight = history.some((p) => p.sender.toLowerCase() === address?.toLowerCase() && (p.status === "signing" || p.status === "submitted"));
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-xl font-semibold">HeyPayna</Link>
          <nav aria-label="Payment navigation" className="flex gap-4 text-sm"><Link href="/docs">Docs</Link><Link href="/app">Gateway testnet</Link><Link href="/auth/login?next=/pay">Đăng nhập</Link></nav>
        </header>
        <section className="rounded-3xl border bg-card p-5 shadow-sm md:p-8">
          <div className="mb-4 inline-flex rounded-full border px-3 py-1 text-sm font-medium">{meta.name} · Chain {meta.chainId}</div>
          <h1 className="text-3xl font-semibold">Thanh toán USDC bằng lệnh</h1>
          <p className="mt-3 text-muted-foreground">Nhập /pay, xem preview, rồi xác nhận và ký bằng MetaMask. Lịch sử có thể đối chiếu trên explorer.</p>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <label className="flex min-w-44 flex-col gap-2 text-sm font-medium">Mạng thanh toán
              <select aria-label="Mạng thanh toán" value={network} disabled={busy} className="h-10 rounded-md border bg-background px-3" onChange={(event) => {
                const selected = event.target.value as ArcPaymentNetwork;
                networkRef.current = selected; attemptRef.current += 1; historyRef.current = [];
                setNetwork(selected); setPreview(null); setHistory([]); setError(""); setStage(""); requestKeyRef.current = null;
              }}><option value="mainnet">Arc Mainnet · USDC thật</option><option value="testnet">Arc Testnet · USDC thử nghiệm</option></select>
            </label>
            <Button onClick={() => void connect()} disabled={busy}>{address ? "Kết nối / chuyển mạng" : "Kết nối MetaMask"}</Button>
          </div>
          {address && <p className="mt-3 break-all font-mono text-sm" aria-label="Ví gửi">{address}</p>}
          <p className="mt-4 text-sm text-muted-foreground">{network === "mainnet" ? "Mainnet sử dụng USDC thật cho cả tiền chuyển và gas." : "Testnet sử dụng USDC thử nghiệm, không có giá trị tiền thật."} Bridge, Gateway, swap và lịch thanh toán thuộc phiên Gateway testnet.</p>
          {!enabled && <p role="status" className="mt-4 rounded-xl border p-3">Thanh toán mainnet đang tắt. Cần bật cấu hình deployment sau khi hoàn tất kiểm tra.</p>}
          <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); void prepare(); }}>
            <label htmlFor="arc-command" className="text-sm font-medium">Lệnh /pay</label>
            <Input id="arc-command" value={command} disabled={busy || inflight} placeholder={`/pay 0.000001 USDC to 0x… on arc-${network}`} onChange={(event) => { setCommand(event.target.value); setPreview(null); requestKeyRef.current = null; }} />
            <p className="text-sm text-muted-foreground">Chỉ chuyển USDC cùng mạng đến địa chỉ ví. Số tiền nhỏ nhất: 0.000001 USDC, cộng gas.</p>
            <Button type="submit" disabled={busy || !address || !command || !enabled || inflight}>Xem preview</Button>
          </form>
          {inflight && <p className="mt-3 text-sm">Ví này có giao dịch đang xử lý. Kiểm tra receipt hoặc khôi phục hash trong lịch sử trước khi thanh toán tiếp.</p>}
          {preview && <section aria-label="Payment preview" className="mt-6 space-y-4 rounded-2xl border bg-background p-5">
            <h2 className="text-xl font-semibold">Xác nhận thanh toán</h2>
            <dl className="grid gap-3 text-sm"><div><dt className="text-muted-foreground">Mạng</dt><dd>{arcWalletNetworks[preview.payment.network].name} · {preview.payment.chain_id}</dd></div>
              <div><dt className="text-muted-foreground">Số tiền</dt><dd className="text-xl font-semibold">{preview.payment.amount} USDC</dd></div>
              <div><dt className="text-muted-foreground">Người nhận</dt><dd className="break-all font-mono">{preview.payment.recipient}</dd></div>
              <div><dt className="text-muted-foreground">Phí gas tối đa ước tính</dt><dd>{formatUnits(BigInt(preview.payment.gas_limit) * BigInt(preview.payment.max_fee_per_gas), 18)} USDC</dd></div>
              <div><dt className="text-muted-foreground">Hiệu lực preview</dt><dd>{new Date(preview.payment.expires_at).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (giờ Việt Nam)</dd></div>
            </dl>
            {preview.payment.sender.toLowerCase() === preview.payment.recipient.toLowerCase() && <p className="text-sm">Đây là giao dịch tự chuyển để kiểm chứng; số dư giảm bởi gas. Giao dịch này không được tính vào số liệu thanh toán cho người khác.</p>}
            <p className="text-sm text-muted-foreground">MetaMask sẽ yêu cầu ký xác nhận preview và ký giao dịch. Kiểm tra phí cuối cùng trong ví trước khi ký.</p>
            <div className="flex flex-wrap gap-3"><Button className="h-auto min-h-10 max-w-full whitespace-normal text-left" disabled={busy} onClick={() => void confirm()}>Xác nhận {preview.payment.amount} USDC trên {arcWalletNetworks[preview.payment.network].name}</Button><Button variant="outline" disabled={busy} onClick={() => { setPreview(null); requestKeyRef.current = null; }}>Hủy preview</Button></div>
          </section>}
          {stage && <p role="status" className="mt-5 break-all rounded-xl border p-3 text-sm">{stage}</p>}
          {error && <p role="alert" aria-label="Payment error" className="mt-4 rounded-xl border border-destructive/50 p-3 text-sm">{error}</p>}
        </section>
        <section aria-label="Payment history" className="rounded-3xl border bg-card p-5 md:p-8">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Lịch sử {meta.name}</h2><Button variant="outline" disabled={busy} onClick={() => void refreshHistory(network).catch((cause) => setError(cause.message))}>Làm mới</Button></div>
          <p className="mt-2 text-sm text-muted-foreground">Thành công chỉ được ghi sau receipt và sự kiện USDC đã xác minh. Reload tiếp tục kiểm tra giao dịch có hash.</p>
          {history.length === 0 && <p className="mt-6 text-sm text-muted-foreground">Chưa có thanh toán trên mạng này.</p>}
          <ul className="mt-5 space-y-3">{history.map((payment) => <li key={payment.id} className="space-y-2 rounded-xl border p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><strong>{payment.amount} USDC · {arcWalletNetworks[payment.network].name}</strong><span>{statusText[payment.status]}</span></div>
            <p className="break-all font-mono">Đến {payment.recipient}</p>
            {payment.tx_hash && <Link href={`${arcWalletNetworks[payment.network].explorer}/tx/${payment.tx_hash}`} target="_blank" rel="noopener noreferrer" className="block break-all text-primary underline">{payment.tx_hash}</Link>}
            {payment.error_message && <p>{payment.error_message}</p>}
            {payment.status === "signing" && <div className="space-y-2"><p>Kiểm tra Activity của MetaMask. Nếu đã gửi, dán hash để tiếp tục kiểm tra; không gửi lại.</p><Link className="text-primary underline" href={`${arcWalletNetworks[payment.network].explorer}/address/${payment.sender}`} target="_blank" rel="noopener noreferrer">Mở ví trên explorer</Link><label className="block">Transaction hash để khôi phục<Input aria-label={`Khôi phục hash ${payment.id}`} value={recoveryHash} onChange={(event) => setRecoveryHash(event.target.value)} placeholder="0x…" /></label><Button variant="outline" disabled={busy} onClick={() => void recover(payment)}>Khôi phục hash</Button></div>}
          </li>)}</ul>
        </section>
      </div>
    </main>
  );
}
