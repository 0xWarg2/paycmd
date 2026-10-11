"use client";

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
import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ScrollReveal } from "@/components/scroll-reveal";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const capabilities = [
  {
    icon: MessageSquareText,
    titleKey: "landing.capability.chat.title",
    descriptionKey: "landing.capability.chat.description",
  },
  {
    icon: WalletCards,
    titleKey: "landing.capability.wallet.title",
    descriptionKey: "landing.capability.wallet.description",
  },
  {
    icon: Waypoints,
    titleKey: "landing.capability.bridge.title",
    descriptionKey: "landing.capability.bridge.description",
  },
  {
    icon: FileCheck2,
    titleKey: "landing.capability.proof.title",
    descriptionKey: "landing.capability.proof.description",
  },
] as const;

const flowStepKeys = [
  "landing.flow.step1",
  "landing.flow.step2",
  "landing.flow.step3",
  "landing.flow.step4",
  "landing.flow.step5",
  "landing.flow.step6",
] as const;

const stackItems = [
  { label: "Circle Wallets", detailKey: "landing.stack.circleWallets" },
  { label: "Circle Gateway", detailKey: "landing.stack.circleGateway" },
  { label: "CCTP v2", detailKey: "landing.stack.cctp" },
  { label: "Arc Testnet", detailKey: "landing.stack.arc" },
  { label: "AskPayna", detailKey: "landing.stack.askpayna" },
  { label: "Supabase", detailKey: "landing.stack.supabase" },
] as const;

const heroChipKeys = ["landing.hero.chip1", "landing.hero.chip2", "landing.hero.chip3"] as const;

export function LandingPage({ metricsSlot }: { metricsSlot: ReactNode }) {
  const { t } = useI18n();

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
        <div className="payna-aurora absolute -inset-[18%] opacity-60" />
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
              <div className="truncate text-xs text-muted-foreground">{t("landing.tagline")}</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#product" className="transition hover:text-foreground">{t("landing.nav.product")}</a>
            <a href="#stack" className="transition hover:text-foreground">{t("landing.nav.stack")}</a>
            <Link href="/docs" className="transition hover:text-foreground">{t("landing.nav.docs")}</Link>
            <Link href="/pay" className="transition hover:text-foreground">Arc wallet payments</Link>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
            <Button asChild variant="outline" className="hidden rounded-full border-border bg-background/55 text-foreground hover:bg-accent hover:text-accent-foreground sm:inline-flex">
              <Link href="/docs">
                <BookOpen className="h-4 w-4" />
                {t("landing.nav.docs")}
              </Link>
            </Button>
            <Button asChild className="paycmd-button-shine rounded-full bg-foreground px-5 text-background shadow-[0_16px_50px_color-mix(in_oklch,var(--primary)_18%,transparent)] hover:bg-foreground/90">
              <Link href="/app">
                {t("landing.nav.launch")}
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
            {t("landing.hero.badge")}
          </div>
          <h1 className="paycmd-reveal paycmd-reveal-delay-1 text-5xl font-semibold leading-[.98] tracking-normal md:text-7xl">
            {t("landing.hero.titleLead")}{" "}
            <span className="payna-gradient-text">{t("landing.hero.titleHighlight")}</span>
          </h1>
          <p className="paycmd-reveal paycmd-reveal-delay-2 mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            {t("landing.hero.description")}
          </p>

          <div className="paycmd-reveal paycmd-reveal-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full px-8 text-base">
              <Link href="/pay">Arc wallet payments <ArrowRight className="h-5 w-5" /></Link>
            </Button>
            <Button asChild size="lg" className="paycmd-button-shine h-14 rounded-full bg-foreground px-8 text-base text-background shadow-[0_20px_60px_color-mix(in_oklch,var(--primary)_18%,transparent)] hover:bg-foreground/90">
              <Link href="/app">
                {t("landing.hero.openApp")}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-border bg-background/55 px-8 text-base text-foreground transition hover:-translate-y-px hover:bg-accent hover:text-accent-foreground">
              <Link href="/docs">{t("landing.hero.readDocs")}</Link>
            </Button>
          </div>

          <div className="paycmd-reveal paycmd-reveal-delay-3 mt-10 grid max-w-2xl gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            {heroChipKeys.map((key) => (
              <div key={key} className="payna-subtle-lift flex items-center gap-2 rounded-full border border-border bg-card/55 px-3 py-2 backdrop-blur transition hover:border-primary/40 hover:text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {t(key)}
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
            alt={t("landing.hero.previewAlt")}
            className="paycmd-preview-float relative rounded-[44px] drop-shadow-[0_40px_90px_rgba(0,0,0,.55)]"
          />
        </div>
      </section>

      {metricsSlot}

      <section id="product" className="relative z-10 border-y border-border bg-card/35 py-20 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <ScrollReveal className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              {t("landing.product.eyebrow")}
            </div>
            <div aria-hidden="true" className="paycmd-signal-line mb-4 h-px w-full max-w-xs bg-border/60" />
            <h2 className="text-3xl font-semibold tracking-normal md:text-5xl">{t("landing.product.title")}</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {t("landing.product.description")}
            </p>
          </ScrollReveal>

          <ScrollReveal stagger className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.titleKey} className="payna-glass payna-subtle-lift payna-beam-card rounded-3xl p-5">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-normal text-card-foreground">{t(item.titleKey)}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{t(item.descriptionKey)}</p>
                </div>
              );
            })}
          </ScrollReveal>
        </div>
      </section>

      <section className="relative z-10 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[0.9fr_1.1fr] md:px-8">
          <ScrollReveal>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <ShieldCheck className="h-4 w-4" />
              {t("landing.flow.eyebrow")}
            </div>
            <h2 className="text-3xl font-semibold tracking-normal md:text-5xl">{t("landing.flow.title")}</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {t("landing.flow.description")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="outline" className="rounded-full border-border bg-background/55 text-foreground hover:bg-accent hover:text-accent-foreground">
                <Link href="/docs#commands">
                  {t("landing.flow.viewCommands")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-border bg-background/55 text-foreground hover:bg-accent hover:text-accent-foreground">
                <Link href="/docs#funding">
                  {t("landing.flow.fundingGuide")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </ScrollReveal>

          <div className="payna-glass rounded-3xl p-5">
            <ScrollReveal stagger className="grid gap-3">
              {flowStepKeys.map((key, index) => (
                <div key={key} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="text-sm text-card-foreground">{t(key)}</span>
                </div>
              ))}
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section id="stack" className="relative z-10 border-t border-border bg-background/70 py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
            <ScrollReveal>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
                <Network className="h-4 w-4" />
                {t("landing.stack.eyebrow")}
              </div>
              <div aria-hidden="true" className="paycmd-signal-line mb-4 h-px w-full max-w-xs bg-border/60" />
              <h2 className="text-3xl font-semibold tracking-normal md:text-5xl">{t("landing.stack.title")}</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {t("landing.stack.description")}
              </p>
            </ScrollReveal>

            <ScrollReveal stagger className="grid gap-3 sm:grid-cols-2">
              {stackItems.map((item) => (
                <div key={item.label} className="payna-subtle-lift rounded-2xl border border-border bg-card/55 p-4 backdrop-blur">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                    {item.label}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(item.detailKey)}</p>
                </div>
              ))}
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 py-20 md:px-8">
        <ScrollReveal className="payna-glass mx-auto max-w-7xl overflow-hidden rounded-[2rem] p-8 md:p-12">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
                <CircleDollarSign className="h-4 w-4" />
                {t("landing.cta.eyebrow")}
              </div>
              <h2 className="text-3xl font-semibold tracking-normal md:text-5xl">{t("landing.cta.title")}</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                {t("landing.cta.description")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="paycmd-button-shine h-14 rounded-full bg-foreground px-8 text-base text-background hover:bg-foreground/90">
                <Link href="/docs">{t("landing.cta.openDocs")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-border bg-background/55 px-8 text-base text-foreground hover:bg-accent hover:text-accent-foreground">
                <Link href="/app">{t("landing.cta.launchApp")}</Link>
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <footer className="relative z-10 border-t border-border px-5 py-8 text-sm text-muted-foreground md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            {t("landing.footer.disclaimer")}
          </div>
          <div className="flex gap-4">
            <Link href="/docs" className="hover:text-foreground">{t("landing.footer.docs")}</Link>
            <Link href="/app" className="hover:text-foreground">{t("landing.footer.app")}</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
