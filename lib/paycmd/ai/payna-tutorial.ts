import tutorial from "../../../content/payna-tutorial.json" with { type: "json" };

import type { GroundedDocument, SourceRetrieval } from "./knowledge-types.ts";

type Locale = "vi" | "en";
type TutorialSection = { id: string; title: string; keywords: string[]; content: string[] };

function tokens(value: string) {
  return new Set(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9/]+/)
      .filter((token) => token.length > 1),
  );
}

function sectionScore(queryTokens: Set<string>, section: TutorialSection) {
  const searchable = tokens(`${section.title} ${section.keywords.join(" ")} ${section.content.join(" ")}`);
  let score = 0;
  for (const token of queryTokens) if (searchable.has(token)) score += 1;
  return score;
}

export function getPaynaTutorialVersion() {
  return tutorial.version;
}

export function searchPaynaTutorial(query: string, locale: Locale): SourceRetrieval {
  const sections = tutorial.locales[locale].sections as TutorialSection[];
  const queryTokens = tokens(query);
  const ranked = sections
    .map((section, index) => ({ section, index, score: sectionScore(queryTokens, section) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = (ranked.length ? ranked : sections.slice(0, 2).map((section, index) => ({ section, index, score: 0 })))
    .slice(0, 4);

  const documents: GroundedDocument[] = selected.map(({ section, score }) => ({
    source: "payna",
    title: section.title,
    url: `https://heypayna.xyz/docs#${section.id}`,
    content: section.content.join("\n"),
    score,
  }));

  return { source: "payna", documents, available: documents.length > 0 };
}
