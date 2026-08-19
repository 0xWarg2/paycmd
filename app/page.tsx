import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  FileCheck2,
  MessageSquareText,
  Network,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Waypoints,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { PublicPlatformMetrics } from "@/components/public-platform-metrics";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";

const capabilities = [
  {
    icon: MessageSquareText,
    title: "Command chat",
    description: "Type natural requests or slash commands. Payna turns them into safe previews before execution.",
  },
  {
    icon: WalletCards,
    title: "Circle wallet rails",
    description: "Create wallet, check balance, pay contacts, request payments, and run Gateway transfer flows.",
  },
  {
    icon: Waypoints,
    title: "MetaMask bridge",
    description: "Bridge USDC with CCTP v2 from MetaMask across supported testnets with guided network switching.",
  },
  {
    icon: FileCheck2,
    title: "Onchain proof",
    description: "Record pay/transfer/bridge receipts with a Payna proof contract deployed on Arc Testnet.",
  },
];

const flowSteps = [
  "Sign in with MetaMask",
  "Create or link Circle wallet",
  "Fund USDC from MetaMask",
  "Ask Payna to pay, transfer, bridge, or swap",
  "Review preview and confirm",
  "Open explorer proof when complete",
];

const stackItems = [
  { label: "Circle Wallets", detail: "SCA wallet, ERC-1271, USDC balance" },
  { label: "Circle Gateway", detail: "Unified USDC liquidity and cross-chain transfer path" },
  { label: "CCTP v2", detail: "MetaMask bridge flow through Circle Bridge Kit" },
  { label: "Arc Testnet", detail: "Receipt proof contract and explorer-linked transaction records" },
  { label: "AskPayna", detail: "Crypto research with verified references, sections, tables, and related questions" },
  { label: "Supabase", detail: "Auth, profile, contacts, history, notifications" },
];

export default function Home() {
  return (
    <main className="relative h-dvh overflow-y-auto overflow-x-hidden scroll-smooth bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0">
        <Image
          src="/brand/paycmd-hero-bg.svg"
          alt=""
          fill
          priority
          className="object-cover opacity-15 dark:opacity-70"
        />
        <div className="payna-public-backdrop absolute inset-0" />
        <div className="paycmd-nebula absolute inset-0 opacity-80" />
        <div className="paycmd-stars absolute inset-0 opacity-60" />
        <div className="paycmd-stars paycmd-stars-far absolute inset-0 opacity-35" />
        <div className="paycmd-hero-grid absolute inset-0 opacity-35" />
      </div>

      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="paycmd-pulse-ring payna-logo-frame relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/15">
              <Image src="/brand/antlers_transparent.png" alt="Payna" fill className="object-contain p-1" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold tracking-normal">Payna</div>
              <div className="truncate text-xs text-muted-foreground">AI stablecoin copilot</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#product" className="transition hover:text-foreground">Product</a>
            <a href="#stack" className="transition hover:text-foreground">Stack</a>
            <Link href="/docs" className="transition hover:text-foreground">Docs</Link>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
            <Button asChild variant="outline" className="hidden rounded-full border-border bg-background/55 text-foreground hover:bg-accent hover:text-accent-foreground sm:inline-flex">
              <Link href="/docs">
                <BookOpen className="h-4 w-4" />
                Docs
              </Link>
            </Button>
            <Button asChild className="paycmd-button-shine rounded-full bg-foreground px-5 text-background shadow-[0_16px_50px_color-mix(in_oklch,var(--primary)_18%,transparent)] hover:bg-foreground/90">
              <Link href="/app">
                Launch
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-5 py-16 md:grid-cols-[minmax(0,1fr)_minmax(360px,540px)] md:px-8 md:py-24">
        <div className="max-w-3xl">
          <div className="paycmd-reveal mb-5 inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-4 py-2 text-sm font-medium text-primary shadow-[0_0_36px_color-mix(in_oklch,var(--primary)_10%,transparent)] backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-destructive shadow-[0_0_18px_color-mix(in_oklch,var(--destructive)_70%,transparent)]" />
            Circle + Arc + MetaMask in one chatbox
          </div>
          <h1 className="paycmd-reveal paycmd-reveal-delay-1 text-5xl font-semibold leading-[.98] tracking-normal md:text-7xl">
            Stablecoin commands that feel like messaging
          </h1>
          <p className="paycmd-reveal paycmd-reveal-delay-2 mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Payna is a chat-first dapp for USDC payments, Circle wallet transfers,
            MetaMask CCTP bridges, swaps, research, and onchain receipt proofs.
          </p>

          <div className="paycmd-reveal paycmd-reveal-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="paycmd-button-shine h-14 rounded-full bg-foreground px-8 text-base text-background shadow-[0_20px_60px_color-mix(in_oklch,var(--primary)_18%,transparent)] hover:bg-foreground/90">
              <Link href="/app">
                Open Payna
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-border bg-background/55 px-8 text-base text-foreground transition hover:-translate-y-px hover:bg-accent hover:text-accent-foreground">
              <Link href="/docs">Read docs</Link>
            </Button>
          </div>

          <div className="paycmd-reveal paycmd-reveal-delay-3 mt-10 grid max-w-2xl gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            {["Pay contacts", "Bridge USDC", "Record proof"].map((item) => (
              <div key={item} className="payna-subtle-lift flex items-center gap-2 rounded-full border border-border bg-card/55 px-3 py-2 backdrop-blur transition hover:border-primary/40 hover:text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="paycmd-reveal paycmd-reveal-delay-2 relative hidden md:block">
          <div className="absolute -inset-8 rounded-[52px] bg-primary/10 blur-3xl" />
          <div className="paycmd-logo-orbit payna-logo-frame absolute -left-14 -top-14 z-10 h-32 w-32 overflow-hidden rounded-full border border-white/15 shadow-[0_0_70px_rgba(99,244,200,.22)]">
            <Image src="/brand/antlers_transparent.png" alt="Payna AI logo" fill className="object-contain p-2" />
          </div>
          <Image
            src="/brand/paycmd-chat-preview.svg"
            width={820}
            height={620}
            alt="Payna chat preview"
            className="paycmd-preview-float relative rounded-[44px] drop-shadow-[0_40px_90px_rgba(0,0,0,.55)]"
          />
        </div>
      </section>

      <PublicPlatformMetrics />

      <section id="product" className="relative z-10 border-y border-border bg-card/35 py-20 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Product surface
            </div>
            <h2 className="text-3xl font-semibold tracking-normal md:text-5xl">One chatbox, multiple payment rails</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Payna keeps the UX simple: users type intent, the app resolves the rail, shows a preview,
              then asks for explicit confirmation before money moves.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="payna-glass payna-subtle-lift rounded-3xl p-5">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-normal text-card-foreground">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[0.9fr_1.1fr] md:px-8">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <ShieldCheck className="h-4 w-4" />
              Safer command flow
            </div>
            <h2 className="text-3xl font-semibold tracking-normal md:text-5xl">Preview first, sign second</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Payna is built around confirmation. Commands can be parsed by rules or AI,
              but payment execution still requires a concrete preview and user approval.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="outline" className="rounded-full border-border bg-background/55 text-foreground hover:bg-accent hover:text-accent-foreground">
                <Link href="/docs#commands">
                  View commands
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-border bg-background/55 text-foreground hover:bg-accent hover:text-accent-foreground">
                <Link href="/docs#funding">
                  Funding guide
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="payna-glass rounded-3xl p-5">
            <div className="grid gap-3">
              {flowSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="text-sm text-card-foreground">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="stack" className="relative z-10 border-t border-border bg-background/70 py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
                <Network className="h-4 w-4" />
                Technology map
              </div>
              <h2 className="text-3xl font-semibold tracking-normal md:text-5xl">Built for testnet rails today, ready to explain every transaction</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                The docs page breaks down each rail: Circle wallet, Gateway, CCTP v2 bridge,
                swap recording, and Payna's own Arc Testnet proof contract.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {stackItems.map((item) => (
                <div key={item.label} className="payna-subtle-lift rounded-2xl border border-border bg-card/55 p-4 backdrop-blur">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                    {item.label}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 py-20 md:px-8">
        <div className="payna-glass mx-auto max-w-7xl overflow-hidden rounded-[2rem] p-8 md:p-12">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
                <CircleDollarSign className="h-4 w-4" />
                Start with USDC
              </div>
              <h2 className="text-3xl font-semibold tracking-normal md:text-5xl">Try the full payment flow from docs to chat</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Read the setup guide, add testnets, fund MetaMask, then let Payna guide the command preview.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="paycmd-button-shine h-14 rounded-full bg-foreground px-8 text-base text-background hover:bg-foreground/90">
                <Link href="/docs">Open docs</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-border bg-background/55 px-8 text-base text-foreground hover:bg-accent hover:text-accent-foreground">
                <Link href="/app">Launch app</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border px-5 py-8 text-sm text-muted-foreground md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Payna testnet dapp. Not financial advice.
          </div>
          <div className="flex gap-4">
            <Link href="/docs" className="hover:text-foreground">Docs</Link>
            <Link href="/app" className="hover:text-foreground">App</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
