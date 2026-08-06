import { readFile } from "node:fs/promises";

import { generatePaynaTutorial } from "../lib/public-docs/tutorial.ts";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const tutorial = JSON.parse(await readFile(new URL("../content/payna-tutorial.json", import.meta.url), "utf8"));
const generatedTutorial = await generatePaynaTutorial();

const semver = /^\d+\.\d+\.\d+$/;
const locales = ["en", "vi"];
const errors = [];

if (!semver.test(tutorial.version ?? "")) errors.push("tutorial.version must be semantic x.y.z");
if (packageJson.version !== tutorial.version) errors.push(`package version ${packageJson.version} does not match tutorial ${tutorial.version}`);
if (JSON.stringify(tutorial) !== JSON.stringify(generatedTutorial)) errors.push("payna-tutorial.json is stale; run npm run docs:sync");
for (const locale of locales) {
  const sections = tutorial.locales?.[locale]?.sections;
  if (!Array.isArray(sections) || sections.length === 0) errors.push(`${locale} tutorial requires sections`);
  for (const section of sections ?? []) {
    if (!section.id || !section.title || !section.url || !Array.isArray(section.keywords) || !Array.isArray(section.content) || section.content.length === 0) {
      errors.push(`${locale} tutorial contains an invalid section`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Payna tutorial ${tutorial.version} is valid and matches package.json`);
}
