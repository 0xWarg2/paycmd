import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { supportedChains } from "./chains.ts";

const requiredSlugs = [
  "",
  "getting-started/quickstart",
  "getting-started/account-and-wallets",
  "circle/gateway/overview",
  "circle/gateway/unified-balance",
  "circle/gateway/deposit-and-finality",
  "circle/gateway/transfer",
  "circle/gateway/withdraw",
  "circle/gateway/fees-gas-and-forwarding",
  "circle/gateway/support-matrix",
  "circle/cctp-bridge",
  "features/askpayna",
  "features/payments-and-contacts",
  "features/payment-requests-and-payroll",
  "features/budgets-and-schedules",
  "features/activity-and-notifications",
  "arc/overview-and-swap",
  "arc/onchain-proof",
  "commands/wallet-and-balance",
  "commands/gateway",
  "commands/payments",
  "commands/metamask-and-data",
  "safety-and-support/security",
  "safety-and-support/troubleshooting",
  "safety-and-support/faq",
] as const;

function publicDocsWordCount(value: string) {
  return value.match(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu)?.length ?? 0;
}

function selectedPublicDocsPages<T extends { slug: string }>(pages: T[]) {
  const selectors = new Set((process.env.PUBLIC_DOCS_SLUGS ?? "").split(",").filter(Boolean));
  if (selectors.size === 0) return pages;
  return pages.filter((page) => selectors.has(page.slug || "overview"));
}

test("public docs expose a paired Vietnamese and English page for every slug", async () => {
  const catalogModule = await import("../public-docs/catalog.ts").catch(() => null);

  assert.ok(catalogModule, "the public docs catalog must exist");
  const pages = await catalogModule.loadPublicDocsCatalog();
  const slugs = new Set(pages.map((page) => page.slug));

  assert.ok(slugs.has(""), "the docs overview route must exist");
  assert.ok(slugs.has("circle/gateway/unified-balance"), "the unified balance guide must exist");
  for (const page of pages) {
    assert.ok(page.locales.vi, `${page.slug || "overview"} is missing Vietnamese content`);
    assert.ok(page.locales.en, `${page.slug || "overview"} is missing English content`);
  }
});

test("public docs provide substantial bilingual reading depth", async () => {
  const { loadPublicDocsCatalog } = await import("../public-docs/catalog.ts");
  const pages = await loadPublicDocsCatalog();

  for (const page of selectedPublicDocsPages(pages)) {
    for (const locale of ["vi", "en"] as const) {
      const count = publicDocsWordCount(page.locales[locale].searchText);
      const [minimum, maximum] = page.slug === ""
        ? [350, 700]
        : page.slug === "circle/gateway/support-matrix"
          ? [450, 1000]
          : page.slug.startsWith("circle/gateway/")
            ? [900, 1700]
            : [500, 1000];
      assert.ok(count >= minimum, `${locale}:${page.slug || "overview"} has only ${count} words`);
      assert.ok(count <= maximum, `${locale}:${page.slug || "overview"} has ${count} words and needs editing`);
    }
  }
});

test("paired locales keep equivalent document structure and finished copy", async () => {
  const { loadPublicDocsCatalog } = await import("../public-docs/catalog.ts");
  const pages = await loadPublicDocsCatalog();

  const draftMarkers = new RegExp("\\b(?:T[B]D|T[O]DO|FIXM[E])\\b|lorem ipsum|coming soon", "i");
  for (const page of selectedPublicDocsPages(pages)) {
    assert.deepEqual(
      page.locales.vi.headings.map((heading) => heading.level),
      page.locales.en.headings.map((heading) => heading.level),
      `${page.slug || "overview"} must keep the same VI/EN heading hierarchy`,
    );
    for (const locale of ["vi", "en"] as const) {
      const localized = page.locales[locale];
      assert.ok(localized.headings.length >= 5, `${locale}:${page.slug || "overview"} needs at least five sections`);
      assert.doesNotMatch(localized.content, draftMarkers);
    }
  }
});

test("Markdown headings with inline command code keep stable table-of-contents IDs", async () => {
  const headingsModule = await import("../public-docs/headings.ts").catch(() => null);

  assert.ok(headingsModule, "the shared public docs heading helper must exist");
  assert.equal(headingsModule.publicDocsHeadingId("`/fund` versus `/deposit`"), "fund-versus-deposit");
  assert.equal(headingsModule.publicDocsHeadingId("Tại sao `/fund` xong?"), "tai-sao-fund-xong");
});

test("public docs cover the complete product information architecture with valid metadata", async () => {
  const { loadPublicDocsCatalog } = await import("../public-docs/catalog.ts");
  const pages = await loadPublicDocsCatalog();

  assert.deepEqual(
    requiredSlugs.filter((slug) => !pages.some((page) => page.slug === slug)),
    [],
    "the public docs portal is missing required routes",
  );
  for (const page of pages) {
    assert.ok(page.section);
    assert.ok(Number.isFinite(page.order));
    for (const locale of ["vi", "en"] as const) {
      const localized = page.locales[locale];
      assert.ok(localized.title);
      assert.ok(localized.description);
      assert.match(localized.lastUpdated, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(new Set(localized.headings.map((heading) => heading.id)).size, localized.headings.length);
    }
  }
});

test("the command reference documents every registered Payna command", async () => {
  const { loadPublicDocsCatalog } = await import("../public-docs/catalog.ts");
  const pages = await loadPublicDocsCatalog();
  const documentedCommands = new Set(pages.flatMap((page) => page.commands));
  const commandSource = await readFile(new URL("./commands.ts", import.meta.url), "utf8");
  const registrySource = commandSource.slice(commandSource.indexOf("export const commandRegistry"), commandSource.indexOf("function resolveCommand"));
  const registeredCommands = [...registrySource.matchAll(/^    name: "([a-z]+)",$/gm)].map((match) => match[1]);

  assert.deepEqual(
    registeredCommands.filter((command) => !documentedCommands.has(command)),
    [],
  );
});

test("Circle Gateway guides preserve the core balance and finality contracts", async () => {
  const { loadPublicDocsCatalog } = await import("../public-docs/catalog.ts");
  const pages = await loadPublicDocsCatalog();
  const gatewayText = pages
    .filter((page) => page.slug.startsWith("circle/gateway/"))
    .map((page) => `${page.locales.en.content}\n${page.locales.vi.content}`)
    .join("\n")
    .toLowerCase();

  for (const fact of [
    "sca wallet is not gateway balance",
    "pending finality",
    "source-scoped",
    "same domain",
    "webhook",
    "recovery",
  ]) {
    assert.ok(gatewayText.includes(fact), `Gateway docs must explain: ${fact}`);
  }
});

test("tutorial generation uses the public docs as its source and keeps the app version", async () => {
  const generator = await import("../public-docs/tutorial.ts").catch(() => null);

  assert.ok(generator, "the tutorial generator must exist");
  const tutorial = await generator.generatePaynaTutorial();
  assert.equal(tutorial.version, "1.0.0");
  assert.ok(tutorial.locales.en.sections.some((section) => section.id === "circle/gateway/unified-balance"));
  assert.ok(tutorial.locales.vi.sections.some((section) => section.id === "features/askpayna"));
});

test("docs navigation keeps Circle Gateway prominent and preserves legacy destinations", async () => {
  const navigationModule = await import("../public-docs/navigation.ts").catch(() => null);
  assert.ok(navigationModule, "the public docs navigation contract must exist");
  const { loadPublicDocsCatalog } = await import("../public-docs/catalog.ts");
  const pages = await loadPublicDocsCatalog();
  const navigation = navigationModule.buildPublicDocsNavigation(pages, "vi");
  const circle = navigation.find((section) => section.id === "circle");

  assert.ok(circle);
  assert.equal(navigation[0].id, "getting-started");
  assert.equal(navigation[1].id, "circle");
  assert.ok(circle.groups.some((group) => group.id === "gateway" && group.pages.length >= 7));
  assert.equal(navigationModule.legacyDocsDestinations.commands, "/docs/commands/wallet-and-balance");
  assert.equal(navigationModule.legacyDocsDestinations.swap, "/docs/arc/overview-and-swap");
  assert.equal(navigationModule.legacyDocsDestinations.proof, "/docs/arc/onchain-proof");
});

test("the public Gateway support matrix exposes all configured domains without private configuration", async () => {
  const supportModule = await import("../public-docs/gateway-support.ts").catch(() => null);
  assert.ok(supportModule, "the public Gateway support projection must exist");
  const rows = supportModule.projectPublicGatewaySupport(
    Object.fromEntries(supportedChains.map((chain, domain) => [chain, {
      domain,
      label: chain,
      circleBlockchain: domain % 2 === 0 ? "supported" : null,
    }])),
  );

  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((row) => row.domain)).size, 12);
  assert.ok(rows.some((row) => row.walletSdk));
  assert.ok(rows.some((row) => !row.walletSdk));
  assert.deepEqual(Object.keys(rows[0]).sort(), ["domain", "key", "label", "walletSdk"]);
});
