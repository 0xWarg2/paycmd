import type { PublicDocsLocale, PublicDocsPage } from "./catalog.ts";

export type PublicDocsNavigationPage = {
  slug: string;
  title: string;
  description: string;
  order: number;
};

export type PublicDocsNavigationGroup = {
  id: string;
  title: string;
  pages: PublicDocsNavigationPage[];
};

export type PublicDocsNavigationSection = {
  id: string;
  title: string;
  groups: PublicDocsNavigationGroup[];
};

const sectionOrder = ["getting-started", "circle", "features", "arc", "commands", "safety-and-support"] as const;

const labels = {
  vi: {
    "getting-started": "Bắt đầu",
    circle: "Circle",
    features: "Tính năng",
    arc: "Arc",
    commands: "Command reference",
    "safety-and-support": "An toàn và hỗ trợ",
    guides: "Hướng dẫn",
    gateway: "Circle Gateway",
    cctp: "CCTP v2",
  },
  en: {
    "getting-started": "Getting started",
    circle: "Circle",
    features: "Features",
    arc: "Arc",
    commands: "Command reference",
    "safety-and-support": "Safety and support",
    guides: "Guides",
    gateway: "Circle Gateway",
    cctp: "CCTP v2",
  },
} as const;

export const legacyDocsDestinations = {
  overview: "/docs",
  research: "/docs/features/askpayna",
  stack: "/docs",
  funding: "/docs/getting-started/quickstart",
  commands: "/docs/commands/wallet-and-balance",
  swap: "/docs/arc/overview-and-swap",
  proof: "/docs/arc/onchain-proof",
  safety: "/docs/safety-and-support/security",
  faq: "/docs/safety-and-support/faq",
} as const;

export function buildPublicDocsNavigation(pages: PublicDocsPage[], locale: PublicDocsLocale): PublicDocsNavigationSection[] {
  return sectionOrder.map((sectionId) => {
    const sectionPages = pages.filter((page) => page.section === sectionId || page.section.startsWith(`${sectionId}.`));
    const grouped = new Map<string, PublicDocsNavigationPage[]>();
    for (const page of sectionPages) {
      const groupId = page.section.split(".")[1] ?? "guides";
      const pagesInGroup = grouped.get(groupId) ?? [];
      pagesInGroup.push({
        slug: page.slug,
        title: page.locales[locale].title,
        description: page.locales[locale].description,
        order: page.order,
      });
      grouped.set(groupId, pagesInGroup);
    }
    const groupOrder = sectionId === "circle" ? ["gateway", "cctp"] : ["guides"];
    const groups = [...grouped.entries()]
      .sort(([a], [b]) => groupOrder.indexOf(a) - groupOrder.indexOf(b) || a.localeCompare(b))
      .map(([id, groupedPages]) => ({
        id,
        title: labels[locale][id as keyof (typeof labels)[typeof locale]] ?? id,
        pages: groupedPages.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug)),
      }));
    return { id: sectionId, title: labels[locale][sectionId], groups };
  });
}

export function orderedPublicDocsPages(pages: PublicDocsPage[]) {
  return [...pages].sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}
