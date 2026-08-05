import { writeFile } from "node:fs/promises";

import { generatePaynaTutorial } from "../lib/public-docs/tutorial.ts";

const tutorial = await generatePaynaTutorial();
const target = new URL("../content/payna-tutorial.json", import.meta.url);
await writeFile(target, `${JSON.stringify(tutorial, null, 2)}\n`, "utf8");
console.log(`Synced ${tutorial.locales.en.sections.length} Payna tutorial sections for v${tutorial.version}`);
