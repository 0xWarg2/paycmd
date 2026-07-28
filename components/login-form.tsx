"use client";

import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    ethereum?: {
      request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

function nextPath() {
  if (typeof window === "undefined") return "/app";
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || "/app";
}

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  const router = useRouter();

  async function finishLogin(options: {
    authProvider: "email" | "web3";
    externalWalletAddress?: string | null;
  }) {
    const response = await fetch("/api/user/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authProvider: options.authProvider,
        externalWallet: options.externalWalletAddress
          ? {
              walletType: "metamask",
              chainType: "evm",
              walletAddress: options.externalWalletAddress,
            }
          : null,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error ?? "Failed to bootstrap Payna account");
    }

    router.push(nextPath());
    router.refresh();
  }

  async function handleMetaMaskLogin() {
    const supabase = createClient();
    setIsWalletLoading(true);
    setError(null);

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not available. Install MetaMask and try again.");
      }

      const accounts = await window.ethereum.request?.({ method: "eth_requestAccounts" });
      const address = Array.isArray(accounts) ? String(accounts[0] ?? "") : "";

      const { error } = await supabase.auth.signInWithWeb3({
        chain: "ethereum",
        statement: "I authorize Payna to authenticate this wallet for stablecoin payment commands.",
      });

      if (error) throw error;
      await finishLogin({ authProvider: "web3", externalWalletAddress: address });
    } catch (error) {
      setError(error instanceof Error ? error.message : "MetaMask login failed");
    } finally {
      setIsWalletLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    setIsEmailLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      await finishLogin({ authProvider: "email" });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Email login failed");
    } finally {
      setIsEmailLoading(false);
    }
  }

  return (
    <div className={cn("payna-shell-bg grid min-h-dvh bg-[#07090d] text-[#f4f7f8] lg:grid-cols-[minmax(0,1fr)_minmax(420px,640px)]", className)} {...props}>
      <section className="relative hidden overflow-hidden border-r border-white/10 bg-[#0d1117] lg:block">
        <Image
          src="/brand/antlers_transparent.png"
          alt="Payna AI payment copilot"
          fill
          priority
          className="paycmd-logo-breathe object-contain p-24 opacity-90 drop-shadow-[0_30px_80px_rgba(99,244,200,.16)]"
        />
        <div className="paycmd-hero-grid absolute inset-0 opacity-20" />
        <div className="paycmd-login-scan absolute inset-0" />
        <div className="paycmd-signal-line absolute left-0 top-1/4 h-px w-full opacity-45" />
        <div className="paycmd-signal-line absolute left-0 top-2/3 h-px w-full opacity-30 [animation-delay:1.6s]" />
        <div className="absolute bottom-10 left-10 max-w-xl">
          <div className="paycmd-reveal mb-5 inline-flex rounded-2xl border border-white/35 bg-white/[0.035] px-4 py-3 text-sm font-semibold backdrop-blur">
            Payna: AI Stablecoin Copilot
          </div>
          <h1 className="paycmd-reveal paycmd-reveal-delay-1 text-4xl font-semibold leading-tight tracking-normal">
            Command your USDC rails with one secure sign-in
          </h1>
          <p className="paycmd-reveal paycmd-reveal-delay-2 mt-4 max-w-lg text-lg leading-8 text-white/66">
            Authenticate with MetaMask, then run payment requests, payroll, and
            Circle Gateway transfers from a single chat surface.
          </p>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10">
        <div className="paycmd-reveal w-full max-w-[430px]">
          <Link href="/" className="mb-10 inline-flex items-center gap-3 text-white/80 transition hover:text-white">
            <span className="paycmd-pulse-ring payna-logo-frame relative h-11 w-11 overflow-hidden rounded-full border border-white/15">
              <Image src="/brand/antlers_transparent.png" alt="Payna" fill className="object-contain p-1" />
            </span>
            <span className="font-semibold">Payna</span>
          </Link>

          <div className="mb-8 text-center">
            <h2 className="text-4xl font-semibold tracking-normal">Welcome</h2>
            <p className="mt-3 text-sm text-white/48">Sign in to launch your payment command center</p>
          </div>

          <Button
            type="button"
            className="paycmd-button-shine h-12 w-full rounded-2xl border border-white/12 bg-white text-[#07090d] shadow-[0_18px_55px_rgba(99,244,200,.16)] hover:bg-[#dffdf5]"
            disabled={isWalletLoading}
            onClick={handleMetaMaskLogin}
          >
            {isWalletLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <span className="mr-2 text-lg">🦊</span>
            )}
            Sign in with MetaMask
          </Button>

          <div className="my-7 flex items-center gap-3 text-xs uppercase text-white/36">
            <span className="h-px flex-1 bg-white/10" />
            or continue with email
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 border-white/10 bg-transparent pl-10 text-white transition focus-visible:border-[#63f4c8]/55 placeholder:text-white/36"
              />
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 border-white/10 bg-transparent text-white transition focus-visible:border-[#63f4c8]/55 placeholder:text-white/36"
            />
            <Button type="submit" className="paycmd-button-shine h-12 w-full bg-white/70 text-[#07090d] hover:bg-white" disabled={isEmailLoading}>
              {isEmailLoading ? "Signing in..." : "Continue"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {error ? (
            <div className="mt-5 rounded-md border border-[#ff4d5e]/30 bg-[#ff4d5e]/10 p-3 text-sm text-[#ffd5da]">
              {error}
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-center gap-2 text-xs leading-5 text-white/48">
            <ShieldCheck className="h-4 w-4 text-[#63f4c8]" />
            By continuing, you agree to use Payna for demo stablecoin commands.
          </div>

          <p className="mt-5 text-center text-sm text-white/48">
            Need email access?{" "}
            <Link href="/auth/sign-up" className="text-white underline underline-offset-4">
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
