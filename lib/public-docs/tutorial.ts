import { readFile } from "node:fs/promises";

import { loadPublicDocsCatalog, publicDocsLocales, type PublicDocsLocale } from "./catalog.ts";

type GeneratedTutorialSection = {
  id: string;
  title: string;
  keywords: string[];
  content: string[];
  url: string;
};

export type GeneratedPaynaTutorial = {
  version: string;
  updatedAt: string;
  product: "Hey Payna";
  locales: Record<PublicDocsLocale, { sections: GeneratedTutorialSection[] }>;
};

export async function generatePaynaTutorial(): Promise<GeneratedPaynaTutorial> {
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  const pages = (await loadPublicDocsCatalog())
    .filter((page) => page.tutorial)
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  const updatedAt = pages
    .flatMap((page) => publicDocsLocales.map((locale) => page.locales[locale].lastUpdated))
    .sort()
    .at(-1) ?? "";

  const locales = Object.fromEntries(
    publicDocsLocales.map((locale) => [
      locale,
      {
        sections: pages.map((page) => ({
          id: page.slug || "overview",
          title: page.locales[locale].title,
          keywords: page.locales[locale].keywords,
          content: page.locales[locale].aiSummary,
          url: `https://heypayna.xyz/docs${page.slug ? `/${page.slug}` : ""}`,
        })),
      },
    ]),
  ) as GeneratedPaynaTutorial["locales"];

  return {
    version: packageJson.version,
    updatedAt,
    product: "Hey Payna",
    locales,
  };
}
