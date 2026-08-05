import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const acceptanceProjects = new Set(["desktop-1440", "desktop-1440-light", "mobile-390", "mobile-390-light"]);

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!acceptanceProjects.has(testInfo.project.name), "docs portal acceptance uses desktop 1440 and mobile 390");
  await page.addInitScript(() => localStorage.setItem("paycmd_locale", "vi"));
});

test("renders nested Circle Gateway docs with navigation, search, and accessible content", async ({ page }, testInfo) => {
  await page.goto("/docs/circle/gateway/unified-balance");

  await expect(page.getByRole("heading", { level: 1, name: "Circle Gateway unified balance" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Transfer vẫn source-scoped" })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Tìm trong tài liệu" });
  await expect(search).toBeVisible();
  await search.fill("finality");
  await expect(page.getByTestId("docs-search-results").getByRole("link", { name: /Deposit và Gateway finality/ })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await search.fill("");
  await page.getByTestId("docs-scroll-container").evaluate((element) => element.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`docs-gateway-${testInfo.project.name}.png`, { fullPage: true });
});

test("keeps the current docs slug while switching language", async ({ page }) => {
  await page.goto("/docs/features/askpayna");
  await expect(page.getByRole("heading", { level: 1, name: "AskPayna research" })).toBeVisible();

  await page.getByRole("button", { name: "Ngôn ngữ" }).click();
  await page.getByRole("menuitemradio", { name: "EN" }).click();

  await expect(page).toHaveURL(/\/docs\/features\/askpayna$/);
  await expect(page.getByRole("heading", { level: 2, name: "When to use AskPayna" })).toBeVisible();
});

test("links command headings from the on-page table of contents", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-1440"), "on-page navigation is visible on wide desktop");
  await page.goto("/docs/commands/gateway");

  const heading = page.locator("#deposit");
  await expect(heading).toHaveCount(1);
  const tableOfContents = page.getByRole("navigation", { name: "Trong trang này" });
  const depositLink = tableOfContents.getByRole("link", { name: "/deposit", exact: true });
  await expect(depositLink).toHaveAttribute("href", "#deposit");
  await depositLink.click();
  await expect(page).toHaveURL(/#deposit$/);
});

test("preserves legacy docs anchors by routing to their canonical pages", async ({ page }) => {
  await page.goto("/docs#commands");
  await expect(page).toHaveURL(/\/docs\/commands\/wallet-and-balance$/);

  await page.goto("/docs#swap");
  await expect(page).toHaveURL(/\/docs\/arc\/overview-and-swap$/);
});

test("uses a mobile drawer without horizontal overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-390"), "mobile drawer check");
  await page.goto("/docs/circle/gateway/overview");

  const menu = page.getByRole("button", { name: "Mở mục lục tài liệu" });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await menu.click();
  await expect(page.getByRole("dialog", { name: "Mục lục tài liệu" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("uses compact typography and scrolls a long guide to its final navigation", async ({ page }) => {
  await page.goto("/docs/circle/gateway/unified-balance");

  const scroller = page.getByTestId("docs-scroll-container");
  const metrics = await scroller.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(["auto", "scroll"]).toContain(metrics.overflowY);

  const bodySize = await page.locator("article p").first().evaluate((element) => getComputedStyle(element).fontSize);
  const titleSize = await page.getByRole("heading", { level: 1 }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(bodySize).toBe("15px");
  expect(titleSize).toBeGreaterThanOrEqual(28);
  expect(titleSize).toBeLessThanOrEqual(36);

  await scroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(page.getByRole("navigation", { name: "Pagination" })).toBeInViewport();
});

test("reflows Docs at a 200 percent equivalent viewport", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/docs/circle/gateway/unified-balance");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByTestId("docs-scroll-container")).toBeVisible();
});
