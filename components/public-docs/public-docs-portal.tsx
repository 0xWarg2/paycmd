"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Menu,
  Search,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isValidElement, type ReactNode, useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./public-docs-portal.module.css";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n, type Locale } from "@/lib/i18n";
import type { PublicDocsPage } from "@/lib/public-docs/catalog";
import { publicDocsHeadingId } from "@/lib/public-docs/headings";
import {
  legacyDocsDestinations,
  type PublicDocsNavigationSection,
} from "@/lib/public-docs/navigation";
import { cn } from "@/lib/utils";

type SearchEntry = {
  slug: string;
  locales: Record<Locale, { title: string; description: string; keywords: string[]; searchText: string }>;
};

type AdjacentPage = PublicDocsPage | null;

type GatewaySupport = {
  key: string;
  label: string;
  domain: number;
  walletSdk: boolean;
};

type PublicDocsPortalProps = {
  page: PublicDocsPage;
  navigation: Record<Locale, PublicDocsNavigationSection[]>;
  searchIndex: SearchEntry[];
  adjacent: { previous: AdjacentPage; next: AdjacentPage };
  gatewaySupport: GatewaySupport[];
  version: string;
};

const copyLabels = { vi: "Sao chép lệnh", en: "Copy command" } as const;

const ui = {
  vi: {
    docs: "Tài liệu",
    home: "Trang chủ",
    launch: "Mở app",
    overview: "Tổng quan",
    search: "Tìm trong tài liệu",
    noResults: "Không tìm thấy trang phù hợp.",
    menu: "Mở mục lục tài liệu",
    menuTitle: "Mục lục tài liệu",
    onPage: "Trong trang này",
    updated: "Cập nhật",
    previous: "Trang trước",
    next: "Trang tiếp",
    gatewayFlow: "Luồng Circle Gateway unified",
    supportTitle: "Gateway domains trong Payna",
    supportIntro: "Bảng được tạo từ cấu hình Gateway hiện tại của ứng dụng.",
    chain: "Network",
    domain: "Domain",
    listed: "Gateway listed",
    sdk: "Wallet SDK operations",
    yes: "Có",
    no: "Chưa hỗ trợ",
    allGuides: "Khám phá tài liệu",
  },
  en: {
    docs: "Docs",
    home: "Home",
    launch: "Launch app",
    overview: "Overview",
    search: "Search documentation",
    noResults: "No matching documentation found.",
    menu: "Open documentation navigation",
    menuTitle: "Documentation navigation",
    onPage: "On this page",
    updated: "Updated",
    previous: "Previous",
    next: "Next",
    gatewayFlow: "Circle Gateway unified flow",
    supportTitle: "Gateway domains in Payna",
    supportIntro: "This table is generated from the application's current Gateway configuration.",
    chain: "Network",
    domain: "Domain",
    listed: "Gateway listed",
    sdk: "Wallet SDK operations",
    yes: "Yes",
    no: "Not yet",
    allGuides: "Explore documentation",
  },
} as const;

function reactNodeText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(reactNodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(value)) return reactNodeText(value.props.children);
  return "";
}

function CommandCode({ children, locale }: { children: ReactNode; locale: Locale }) {
  const value = String(children).replace(/\n$/, "");
  const isCommand = value.startsWith("/");
  const [copied, setCopied] = useState(false);

  if (!isCommand) {
    return <code className="rounded-md border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[0.88em] text-foreground">{children}</code>;
  }

  return (
    <span className="my-1 inline-flex max-w-full items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1 align-middle">
      <code className="overflow-x-auto font-mono text-[0.88em] text-foreground">{value}</code>
      <button
        type="button"
        className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={copyLabels[locale]}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

function MarkdownContent({ content, locale }: { content: string; locale: Locale }) {
  const components: Components = {
    h2: ({ children }) => {
      const title = reactNodeText(children);
      return <h2 id={publicDocsHeadingId(title)} className="scroll-mt-6 pt-8 text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">{children}</h2>;
    },
    h3: ({ children }) => {
      const title = reactNodeText(children);
      return <h3 id={publicDocsHeadingId(title)} className="scroll-mt-6 pt-5 text-lg font-semibold text-foreground sm:text-xl">{children}</h3>;
    },
    p: ({ children }) => <p className="text-[15px] leading-[1.75] text-muted-foreground">{children}</p>,
    ul: ({ children }) => <ul className="my-4 list-disc space-y-2 pl-6 text-[15px] leading-[1.75] text-muted-foreground">{children}</ul>,
    ol: ({ children }) => <ol className="my-4 list-decimal space-y-2 pl-6 text-[15px] leading-[1.75] text-muted-foreground">{children}</ol>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    blockquote: ({ children }) => <blockquote className="my-5 rounded-r-xl border-l-4 border-primary bg-primary/8 px-5 py-3 text-foreground">{children}</blockquote>,
    a: ({ href = "", children }) => {
      const external = href.startsWith("http");
      return (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
        >
          {children}
          {external ? <ExternalLink className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" /> : null}
        </a>
      );
    },
    code: ({ children }) => <CommandCode locale={locale}>{children}</CommandCode>,
    table: ({ children }) => <div className="my-6 overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[560px] text-left text-sm">{children}</table></div>,
    th: ({ children }) => <th className="border-b border-border bg-muted/70 px-4 py-3 font-semibold text-foreground">{children}</th>,
    td: ({ children }) => <td className="border-b border-border/60 px-4 py-3 text-muted-foreground">{children}</td>,
  };

  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>;
}

function DocsSearch({ entries, locale }: { entries: SearchEntry[]; locale: Locale }) {
  const [query, setQuery] = useState("");
  const labels = ui[locale];
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return entries
      .map((entry) => {
        const page = entry.locales[locale];
        const haystack = `${page.title} ${page.description} ${page.keywords.join(" ")} ${page.searchText}`.toLowerCase();
        const titleMatch = page.title.toLowerCase().includes(normalized) ? 2 : 0;
        return { entry, score: titleMatch + (haystack.includes(normalized) ? 1 : 0) };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7);
  }, [entries, locale, query]);

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        role="searchbox"
        aria-label={labels.search}
        placeholder={labels.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background/80 pl-10 pr-3 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      {query ? (
        <div data-testid="docs-search-results" className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-xl">
          {results.length ? results.map(({ entry }) => {
            const result = entry.locales[locale];
            return (
              <Link
                key={entry.slug || "overview"}
                href={`/docs${entry.slug ? `/${entry.slug}` : ""}`}
                onClick={() => setQuery("")}
                className="block rounded-lg px-3 py-2.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block text-sm font-semibold text-foreground">{result.title}</span>
                <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">{result.description}</span>
              </Link>
            );
          }) : <p className="px-3 py-4 text-sm text-muted-foreground">{labels.noResults}</p>}
        </div>
      ) : null}
    </div>
  );
}

function DocsNavigation({ sections, activeSlug, locale, onNavigate }: { sections: PublicDocsNavigationSection[]; activeSlug: string; locale: Locale; onNavigate?: () => void }) {
  return (
    <nav aria-label={ui[locale].menuTitle} className="space-y-6">
      <Link
        href="/docs"
        onClick={onNavigate}
        className={cn(
          "flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors",
          activeSlug === "" ? "bg-primary/12 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        {ui[locale].overview}
      </Link>
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`docs-nav-${section.id}`}>
          <h2 id={`docs-nav-${section.id}`} className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{section.title}</h2>
          <div className="mt-2 space-y-3">
            {section.groups.map((group) => (
              <div key={group.id}>
                {section.groups.length > 1 || group.id !== "guides" ? <p className="px-3 pb-1 text-xs font-medium text-foreground/80">{group.title}</p> : null}
                <div className="space-y-0.5 border-l border-border/70 pl-2">
                  {group.pages.map((navPage) => (
                    <Link
                      key={navPage.slug}
                      href={`/docs/${navPage.slug}`}
                      onClick={onNavigate}
                      aria-current={activeSlug === navPage.slug ? "page" : undefined}
                      className={cn(
                        "block rounded-lg px-3 py-2 text-sm leading-5 transition-colors",
                        activeSlug === navPage.slug ? "bg-primary/12 font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {navPage.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}

function GatewayFlow({ locale }: { locale: Locale }) {
  const steps = locale === "vi"
    ? [["1", "Fund SCA", "MetaMask → Circle SCA"], ["2", "Deposit", "SCA → Gateway pending"], ["3", "Finality", "Webhook → ready balance"], ["4", "Transfer", "Source burn intent → destination mint"]]
    : [["1", "Fund SCA", "MetaMask → Circle SCA"], ["2", "Deposit", "SCA → Gateway pending"], ["3", "Finality", "Webhook → ready balance"], ["4", "Transfer", "Source burn intent → destination mint"]];
  return (
    <section aria-labelledby="gateway-flow-title" className="my-8 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
      <h2 id="gateway-flow-title" className="text-lg font-semibold text-foreground">{ui[locale].gatewayFlow}</h2>
      <ol className="mt-5 grid gap-3 md:grid-cols-4">
        {steps.map(([number, title, detail], index) => (
          <li key={number} className="relative rounded-xl border border-border bg-card p-4">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">{number}</span>
            <p className="mt-3 text-sm font-semibold text-card-foreground">{title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
            {index < steps.length - 1 ? <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-primary md:block" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function GatewaySupportMatrix({ rows, locale }: { rows: GatewaySupport[]; locale: Locale }) {
  const labels = ui[locale];
  return (
    <section aria-labelledby="gateway-support-title" className="my-8">
      <h2 id="gateway-support-title" className="text-2xl font-semibold text-foreground">{labels.supportTitle}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{labels.supportIntro}</p>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-muted/70 text-foreground">
            <tr><th className="px-4 py-3">{labels.chain}</th><th className="px-4 py-3">{labels.domain}</th><th className="px-4 py-3">{labels.listed}</th><th className="px-4 py-3">{labels.sdk}</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border/70">
                <td className="px-4 py-3 font-medium text-foreground">{row.label}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{row.domain}</td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{labels.yes}</span></td>
                <td className="px-4 py-3">{row.walletSdk ? <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{labels.yes}</span> : <span className="inline-flex items-center gap-1.5 text-muted-foreground"><XCircle className="h-4 w-4" />{labels.no}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OverviewCards({ sections, locale }: { sections: PublicDocsNavigationSection[]; locale: Locale }) {
  const icons = [WalletCards, CircleDollarSign, BookOpen, CircleDollarSign, BookOpen, ShieldCheck];
  return (
    <section aria-labelledby="docs-explore-title" className="my-10">
      <h2 id="docs-explore-title" className="text-2xl font-semibold text-foreground">{ui[locale].allGuides}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {sections.map((section, index) => {
          const firstPage = section.groups[0]?.pages[0];
          const Icon = icons[index] ?? BookOpen;
          return firstPage ? (
            <Link key={section.id} href={`/docs/${firstPage.slug}`} className="group rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-semibold text-card-foreground">{section.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{firstPage.description}</p>
            </Link>
          ) : null;
        })}
      </div>
    </section>
  );
}

export function PublicDocsPortal({ page, navigation, searchIndex, adjacent, gatewaySupport, version }: PublicDocsPortalProps) {
  const { locale } = useI18n();
  const labels = ui[locale];
  const localized = page.locales[locale];
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (pathname !== "/docs") return;
    const hash = window.location.hash.slice(1) as keyof typeof legacyDocsDestinations;
    const destination = legacyDocsDestinations[hash];
    if (destination && destination !== "/docs") router.replace(destination);
  }, [pathname, router]);

  const breadcrumb = page.slug.split("/").filter(Boolean);
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-40 shrink-0 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 min-h-11 w-11 min-w-11 lg:hidden" aria-label={labels.menu}>
                <Menu className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined} className="left-0 top-0 h-dvh max-w-[88vw] translate-x-0 translate-y-0 overflow-y-auto rounded-none border-y-0 border-l-0 p-5 sm:max-w-sm">
              <DialogTitle>{labels.menuTitle}</DialogTitle>
              <div className="mt-4"><DocsNavigation sections={navigation[locale]} activeSlug={page.slug} locale={locale} onNavigate={() => setDrawerOpen(false)} /></div>
            </DialogContent>
          </Dialog>
          <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="payna-logo-frame relative h-9 w-9 overflow-hidden rounded-xl border border-primary/25"><Image src="/brand/antlers_transparent.png" alt="Payna" fill className="object-contain p-0.5" /></span>
            <span className="hidden text-sm font-semibold sm:inline">Payna</span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{labels.docs}</span>
          </Link>
          <div className="ml-auto hidden flex-1 justify-center px-6 md:flex"><DocsSearch entries={searchIndex} locale={locale} /></div>
          <nav className="ml-auto hidden items-center gap-1 md:ml-0 lg:flex" aria-label="Public">
            <Button variant="ghost" asChild><Link href="/">{labels.home}</Link></Button>
            <Button asChild><Link href="/app">{labels.launch}<ArrowRight className="h-4 w-4" /></Link></Button>
          </nav>
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
        <div className="border-t border-border/60 px-4 py-2 md:hidden"><DocsSearch entries={searchIndex} locale={locale} /></div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_220px]">
        <aside aria-label={labels.menuTitle} className={cn(styles.scrollbar, "hidden min-h-0 overflow-y-auto border-r border-border/70 px-5 py-8 lg:block")}>
          <DocsNavigation sections={navigation[locale]} activeSlug={page.slug} locale={locale} />
        </aside>

        <main data-testid="docs-scroll-container" className={cn(styles.scrollbar, styles.mainScrollbar, "min-h-0 min-w-0 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10 xl:px-12")}>
          <div className="mx-auto max-w-3xl">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Link href="/docs" className="hover:text-foreground">{labels.docs}</Link>
              {breadcrumb.map((segment, index) => (
                <span key={`${segment}-${index}`} className="inline-flex items-center gap-1.5"><ChevronRight className="h-3.5 w-3.5" /><span>{index === breadcrumb.length - 1 ? localized.title : segment.replaceAll("-", " ")}</span></span>
              ))}
            </nav>
            <div className="mt-6 border-b border-border pb-8">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground"><span className="rounded-full border border-border bg-muted/60 px-2.5 py-1">v{version}</span><span>{labels.updated} {localized.lastUpdated}</span></div>
              <h1 className="mt-4 text-[28px] font-bold tracking-tight text-foreground sm:text-[32px] lg:text-4xl">{localized.title}</h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">{localized.description}</p>
            </div>

            {page.slug === "circle/gateway/overview" ? <GatewayFlow locale={locale} /> : null}
            <article className="space-y-1"><MarkdownContent content={localized.content} locale={locale} /></article>
            {page.slug === "circle/gateway/support-matrix" ? <GatewaySupportMatrix rows={gatewaySupport} locale={locale} /> : null}
            {page.slug === "" ? <OverviewCards sections={navigation[locale]} locale={locale} /> : null}

            <nav aria-label="Pagination" className="mt-14 grid gap-4 border-t border-border pt-8 sm:grid-cols-2">
              {adjacent.previous ? <Link href={`/docs${adjacent.previous.slug ? `/${adjacent.previous.slug}` : ""}`} className="rounded-xl border border-border p-4 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" />{labels.previous}</span><span className="mt-2 block font-semibold text-foreground">{adjacent.previous.locales[locale].title}</span></Link> : <span />}
              {adjacent.next ? <Link href={`/docs/${adjacent.next.slug}`} className="rounded-xl border border-border p-4 text-right hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex items-center justify-end gap-2 text-xs text-muted-foreground">{labels.next}<ArrowRight className="h-3.5 w-3.5" /></span><span className="mt-2 block font-semibold text-foreground">{adjacent.next.locales[locale].title}</span></Link> : null}
            </nav>
          </div>
        </main>

        <aside aria-label={labels.onPage} className={cn(styles.scrollbar, "hidden min-h-0 overflow-y-auto border-l border-border/70 px-5 py-8 xl:block")}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{labels.onPage}</p>
          <nav className="mt-4 space-y-2" aria-label={labels.onPage}>
            {localized.headings.map((heading) => <a key={heading.id} href={`#${heading.id}`} className={cn("block text-sm leading-5 text-muted-foreground hover:text-foreground", heading.level === 3 && "pl-3")}>{heading.title}</a>)}
          </nav>
        </aside>
      </div>
    </div>
  );
}
