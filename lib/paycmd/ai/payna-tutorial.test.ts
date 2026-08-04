import assert from "node:assert/strict";
import test from "node:test";

import { getPaynaTutorialVersion, searchPaynaTutorial } from "./payna-tutorial.ts";

test("exposes the first tutorial release and retrieves Vietnamese transfer guidance", () => {
  assert.equal(getPaynaTutorialVersion(), "1.0.0");

  const result = searchPaynaTutorial("cách chuyển USDC từ base sang arc", "vi");

  assert.equal(result.available, true);
  assert.equal(result.documents[0]?.source, "payna");
  assert.equal(result.documents.some((document) => document.content.includes("/transfer 5 from base to arc")), true);
});

test("retrieves English AskPayna source policy from the canonical tutorial", () => {
  const result = searchPaynaTutorial("How does AskPayna research Circle and Arc?", "en");

  assert.equal(result.documents.some((document) => document.content.includes("Circle MCP")), true);
  assert.equal(result.documents.some((document) => document.content.includes("Arc MCP")), true);
  assert.equal(result.documents.some((document) => document.content.includes("Tavily")), true);
});

test("returns at most four ranked tutorial sections with stable docs citations", () => {
  const result = searchPaynaTutorial("wallet fund pay transfer bridge swap AskPayna", "en");

  assert.equal(result.documents.length <= 4, true);
  assert.equal(result.documents.every((document) => document.url?.startsWith("https://heypayna.xyz/docs#")), true);
});
