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
      eoaWalletBlockchain: domain % 2 === 0 ? "supported" : null,
    }])),
  );

  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((row) => row.domain)).size, 12);
  assert.ok(rows.some((row) => row.walletSdk));
  assert.ok(rows.some((row) => !row.walletSdk));
  assert.deepEqual(Object.keys(rows[0]).sort(), ["domain", "key", "label", "walletSdk"]);
});
