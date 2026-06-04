import { ArrowRight, CheckCircle2, Globe2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="relative h-dvh overflow-hidden bg-[#07090d] text-[#f4f7f8]">
      <Image
        src="/brand/paycmd-hero-bg.svg"
        alt=""
        fill
        priority
        className="object-cover opacity-80"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#07090d_0%,rgba(7,9,13,.82)_36%,rgba(7,9,13,.44)_72%,#07090d_100%)]" />
      <div className="paycmd-nebula absolute inset-0 opacity-80" />
      <div className="paycmd-stars absolute inset-0 opacity-70" />
      <div className="paycmd-stars paycmd-stars-far absolute inset-0 opacity-45" />
      <div className="paycmd-hero-grid absolute inset-0 opacity-50" />
      <div className="paycmd-orbit absolute -left-32 top-12 h-[620px] w-[620px] rounded-full border border-white/10" />
      <div className="paycmd-orbit paycmd-orbit-slow absolute -left-10 top-28 h-[450px] w-[450px] rounded-full border border-white/15" />
      <div className="paycmd-cosmic-globe absolute right-[4%] top-[11%] hidden h-44 w-44 md:block" aria-hidden="true" />
      <div className="paycmd-deep-orbit absolute right-[-9rem] top-[7rem] hidden h-[520px] w-[520px] md:block" aria-hidden="true" />
      <div className="paycmd-deep-orbit paycmd-deep-orbit-reverse absolute right-[-5rem] top-[11rem] hidden h-[370px] w-[370px] md:block" aria-hidden="true" />
      <div className="paycmd-signal-line absolute left-0 top-[28%] h-px w-full opacity-50" />
      <div className="paycmd-signal-line absolute left-0 top-[72%] h-px w-full opacity-30 [animation-delay:1.4s]" />

      <header className="paycmd-reveal relative z-10 mx-auto flex h-24 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="paycmd-pulse-ring relative h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/5">
            <Image src="/brand/paycmd-ai-logo-vietnam.png" alt="PayCMD" fill className="object-cover" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-normal">PayCMD</div>
            <div className="text-xs text-white/48">AI stablecoin copilot</div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <button className="hidden items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-sm text-white/80 md:flex">
            <Globe2 className="h-4 w-4" />
            EN
          </button>
          <Button asChild className="paycmd-button-shine rounded-full bg-white px-6 text-[#07090d] hover:bg-[#dffdf5]">
            <Link href="/app">
              Launch App
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid h-[calc(100dvh-6rem)] max-w-7xl items-center gap-8 px-5 pb-8 md:grid-cols-[minmax(0,1fr)_minmax(380px,560px)] md:px-8">
        <div className="max-w-3xl">
          <div className="paycmd-reveal paycmd-reveal-delay-1 mb-5 inline-flex items-center gap-2 rounded-full border border-[#63f4c8]/40 bg-[#63f4c8]/10 px-4 py-2 text-sm text-[#caffee]">
            <span className="h-2 w-2 rounded-full bg-[#ff4d5e] shadow-[0_0_18px_rgba(255,77,94,.85)]" />
            USDC payments by command
          </div>
          <h1 className="paycmd-reveal paycmd-reveal-delay-2 max-w-3xl text-5xl font-semibold leading-[.98] tracking-normal md:text-7xl">
            Your AI payment copilot for stablecoin teams
          </h1>
          <p className="paycmd-reveal paycmd-reveal-delay-3 mt-6 max-w-2xl text-lg leading-8 text-white/64">
            Pay contributors, request invoices, run payroll, and route USDC across
            Circle Gateway with simple chat commands.
          </p>

          <div className="paycmd-reveal paycmd-reveal-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="paycmd-button-shine h-14 rounded-full bg-[#f4f7f8] px-8 text-base text-[#07090d] hover:bg-[#dffdf5]">
              <Link href="/app">
                Launch App
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-white/15 bg-white/[0.03] px-8 text-base text-white transition hover:-translate-y-px hover:bg-white/10 hover:text-white">
              <Link href="/auth/login?next=/app">Sign in</Link>
            </Button>
          </div>

          <div className="paycmd-reveal paycmd-reveal-delay-3 mt-10 grid max-w-2xl gap-3 text-sm text-white/58 sm:grid-cols-3">
            {["Circle-first wallet", "P2P requests", "Payroll batches"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 transition hover:border-[#63f4c8]/35 hover:text-white">
                <CheckCircle2 className="h-4 w-4 text-[#63f4c8]" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="paycmd-reveal paycmd-reveal-delay-2 relative hidden md:block">
          <div className="absolute -inset-8 rounded-[52px] bg-[#63f4c8]/10 blur-3xl" />
          <div className="paycmd-logo-orbit absolute -left-16 -top-16 z-10 h-36 w-36 overflow-hidden rounded-full border border-white/15 bg-[#07090d] shadow-[0_0_70px_rgba(99,244,200,.22)]">
            <Image src="/brand/paycmd-ai-logo-vietnam.png" alt="PayCMD AI logo" fill className="object-cover" />
          </div>
          <Image
            src="/brand/paycmd-chat-preview.svg"
            width={820}
            height={620}
            alt="PayCMD chat preview"
            className="paycmd-preview-float relative rounded-[44px] drop-shadow-[0_40px_90px_rgba(0,0,0,.55)]"
          />
        </div>
      </section>
    </main>
  );
}
