import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

import { publicDocsHeadingId } from "./headings.ts";

export const publicDocsLocales = ["vi", "en"] as const;
export type PublicDocsLocale = (typeof publicDocsLocales)[number];

export type PublicDocsHeading = {
  id: string;
  level: 2 | 3;
  title: string;
};

export type PublicDocsLocalePage = {
  title: string;
  description: string;
  keywords: string[];
  lastUpdated: string;
  content: string;
  headings: PublicDocsHeading[];
  searchText: string;
  aiSummary: string[];
};

export type PublicDocsPage = {
  slug: string;
  section: string;
  order: number;
  commands: string[];
  tutorial: boolean;
  locales: Record<PublicDocsLocale, PublicDocsLocalePage>;
};

const contentRoot = path.join(process.cwd(), "content/public-docs");

export function extractPublicDocsHeadings(content: string): PublicDocsHeading[] {
  return content
    .split("\n")
    .map((line) => line.match(/^(#{2,3})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      id: publicDocsHeadingId(match[2]),
      level: match[1].length as 2 | 3,
      title: match[2].replace(/`/g, ""),
    }));
}

function markdownSearchText(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`#>*_[\]()|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? markdownFiles(target) : Promise.resolve(entry.name.endsWith(".md") ? [target] : []);
    }),
  );
  return nested.flat();
}

async function loadLocale(locale: PublicDocsLocale) {
  const localeRoot = path.join(contentRoot, locale);
  const files = await markdownFiles(localeRoot);
  const pages = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, "utf8");
      const parsed = matter(source);
      const relative = path.relative(localeRoot, file).replace(/\.md$/, "").replaceAll(path.sep, "/");
      const fallbackSlug = relative === "index" ? "" : relative;
      const slug = typeof parsed.data.slug === "string" ? parsed.data.slug : fallbackSlug;
      return {
        slug,
        section: String(parsed.data.section ?? "overview"),
        order: Number(parsed.data.order ?? 0),
        commands: Array.isArray(parsed.data.commands) ? parsed.data.commands.map(String) : [],
        tutorial: parsed.data.tutorial === true,
        localePage: {
          title: String(parsed.data.title ?? ""),
          description: String(parsed.data.description ?? ""),
          keywords: Array.isArray(parsed.data.keywords) ? parsed.data.keywords.map(String) : [],
          lastUpdated: String(parsed.data.lastUpdated ?? ""),
          content: parsed.content.trim(),
          headings: extractPublicDocsHeadings(parsed.content),
          searchText: markdownSearchText(parsed.content),
          aiSummary: Array.isArray(parsed.data.aiSummary) ? parsed.data.aiSummary.map(String) : [],
        } satisfies PublicDocsLocalePage,
      };
    }),
  );
  return new Map(pages.map((page) => [page.slug, page]));
}

export async function loadPublicDocsCatalog(): Promise<PublicDocsPage[]> {
  const [viPages, enPages] = await Promise.all([loadLocale("vi"), loadLocale("en")]);
  const slugs = [...new Set([...viPages.keys(), ...enPages.keys()])].sort();

  return slugs.map((slug) => {
    const vi = viPages.get(slug);
    const en = enPages.get(slug);
    if (!vi || !en) throw new Error(`Public docs slug ${slug || "overview"} must have both vi and en content`);
    return {
      slug,
      section: vi.section,
      order: vi.order,
      commands: [...new Set([...vi.commands, ...en.commands])],
      tutorial: vi.tutorial || en.tutorial,
      locales: { vi: vi.localePage, en: en.localePage },
    };
  });
}

export async function loadPublicDocsPage(slug: string) {
  return (await loadPublicDocsCatalog()).find((page) => page.slug === slug) ?? null;
}
