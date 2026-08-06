import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicDocsPortal } from "@/components/public-docs/public-docs-portal";
import tutorial from "@/content/payna-tutorial.json";
import { GATEWAY_CHAIN_CONFIGS, supportedGatewayChains } from "@/lib/circle/gateway-sdk";
import { loadPublicDocsCatalog } from "@/lib/public-docs/catalog";
import { projectPublicGatewaySupport } from "@/lib/public-docs/gateway-support";
import { buildPublicDocsNavigation, orderedPublicDocsPages } from "@/lib/public-docs/navigation";

type DocsRouteProps = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;

function routeSlug(slug?: string[]) {
  return slug?.join("/") ?? "";
}

export async function generateStaticParams() {
  return (await loadPublicDocsCatalog()).map((page) => ({ slug: page.slug ? page.slug.split("/") : [] }));
}

export async function generateMetadata({ params }: DocsRouteProps): Promise<Metadata> {
  const catalog = await loadPublicDocsCatalog();
  const resolvedParams = await params;
  const page = catalog.find((candidate) => candidate.slug === routeSlug(resolvedParams.slug));
  if (!page) return {};
  return {
    title: `${page.locales.en.title} · Payna Docs`,
    description: page.locales.en.description,
  };
}

export default async function PublicDocsPage({ params }: DocsRouteProps) {
  const slug = routeSlug((await params).slug);
  const catalog = await loadPublicDocsCatalog();
  const page = catalog.find((candidate) => candidate.slug === slug);
  if (!page) notFound();

  const ordered = orderedPublicDocsPages(catalog);
  const pageIndex = ordered.findIndex((candidate) => candidate.slug === slug);
  const adjacent = {
    previous: pageIndex > 0 ? ordered[pageIndex - 1] : null,
    next: pageIndex < ordered.length - 1 ? ordered[pageIndex + 1] : null,
  };
  const navigation = {
    vi: buildPublicDocsNavigation(catalog, "vi"),
    en: buildPublicDocsNavigation(catalog, "en"),
  };
  const searchIndex = catalog.map((candidate) => ({
    slug: candidate.slug,
    locales: {
      vi: {
        title: candidate.locales.vi.title,
        description: candidate.locales.vi.description,
        keywords: candidate.locales.vi.keywords,
        searchText: candidate.locales.vi.searchText,
      },
      en: {
        title: candidate.locales.en.title,
        description: candidate.locales.en.description,
        keywords: candidate.locales.en.keywords,
        searchText: candidate.locales.en.searchText,
      },
    },
  }));
  const gatewaySupport = projectPublicGatewaySupport(
    Object.fromEntries(supportedGatewayChains.map((chain) => [chain, GATEWAY_CHAIN_CONFIGS[chain]])),
  );

  return (
    <PublicDocsPortal
      page={page}
      navigation={navigation}
      searchIndex={searchIndex}
      adjacent={adjacent}
      gatewaySupport={gatewaySupport}
      version={tutorial.version}
    />
  );
}
