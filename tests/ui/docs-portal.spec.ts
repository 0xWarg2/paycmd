import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const acceptanceProjects = new Set(["desktop-1440", "desktop-1440-light", "mobile-390", "mobile-390-light"]);
const axeRoutes = [
  { name: "overview", path: "/docs" },
  { name: "quickstart", path: "/docs/getting-started/quickstart" },
  { name: "Gateway unified balance", path: "/docs/circle/gateway/unified-balance" },
  { name: "command reference", path: "/docs/commands/gateway" },
  { name: "troubleshooting", path: "/docs/safety-and-support/troubleshooting" },
] as const;
const visualRoutes = [
  { name: "command-reference", path: "/docs/commands/gateway" },
  { name: "troubleshooting", path: "/docs/safety-and-support/troubleshooting" },
] as const;

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!acceptanceProjects.has(testInfo.project.name), "docs portal acceptance uses desktop 1440 and mobile 390");
  await page.addInitScript(() => localStorage.setItem("paycmd_locale", "vi"));
});

test("renders nested Circle Gateway docs with navigation, search, and accessible content", async ({ page }, testInfo) => {
  await page.goto("/docs/circle/gateway/unified-balance");

  await expect(page.getByRole("heading", { level: 1, name: "Circle Gateway unified balance" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Transfer scoped-first và unified execution" })).toBeVisible();
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
  await expect(page.getByRole("heading", { level: 2, name: "Choose the right mode" })).toBeVisible();
});

test("links command headings from the on-page table of contents", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-1440"), "on-page navigation is visible on wide desktop");
  await page.goto("/docs/commands/gateway");

  const scroller = page.getByTestId("docs-scroll-container");
  const heading = page.locator("#gateway");
  await expect(heading).toHaveCount(1);
  const tableOfContents = page.getByRole("navigation", { name: "Trong trang này" });
  const gatewayLink = tableOfContents.getByRole("link", { name: "/gateway", exact: true });
  await expect(gatewayLink).toHaveAttribute("href", "#gateway");
  const initialScrollTop = await scroller.evaluate((element) => element.scrollTop);
  await gatewayLink.click();
  await expect(page).toHaveURL(/#gateway$/);
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(initialScrollTop + 100);
  await expect.poll(() => heading.evaluate((element) => {
    const container = document.querySelector<HTMLElement>("[data-testid='docs-scroll-container']");
    if (!container) return false;
    const headingRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return headingRect.top >= containerRect.top && headingRect.bottom <= containerRect.bottom;
  })).toBe(true);
});

test("keeps the left navigation position when opening a guide near the bottom", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-1440"), "desktop sidebar navigation check");
  await page.goto("/docs/arc/overview-and-swap");

  const sidebar = page.getByRole("complementary", { name: "Mục lục tài liệu" });
  await sidebar.evaluate((element) => element.scrollTo({ top: 650 }));
  await expect.poll(() => sidebar.evaluate((element) => element.scrollTop)).toBeGreaterThan(500);

  await sidebar.getByRole("link", { name: "Mô hình an toàn", exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/safety-and-support\/security$/);

  const navigatedSidebar = page.getByRole("complementary", { name: "Mục lục tài liệu" });
  await expect.poll(() => navigatedSidebar.evaluate((element) => element.scrollTop)).toBeGreaterThan(500);
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
  const scrollbar = page.getByTestId("docs-scrollbar");
  const thumb = page.getByTestId("docs-scrollbar-thumb");
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

  await expect(scrollbar).toBeVisible();
  await expect(thumb).toBeVisible();
  await expect(scrollbar).toHaveAttribute("role", "scrollbar");
  await expect(scrollbar).toHaveCSS("opacity", "1");
  await scroller.evaluate((element) => element.scrollTo({ top: 0 }));

  const trackBox = await scrollbar.boundingBox();
  const thumbBox = await thumb.boundingBox();
  expect(trackBox).not.toBeNull();
  expect(thumbBox).not.toBeNull();
  if (trackBox && thumbBox) {
    await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(thumbBox.x + thumbBox.width / 2, trackBox.y + trackBox.height - thumbBox.height / 2, { steps: 8 });
    await page.mouse.up();
  }
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop / (element.scrollHeight - element.clientHeight))).toBeGreaterThan(0.8);
  await expect(page.getByRole("navigation", { name: "Pagination" })).toBeInViewport();

  await scrollbar.focus();
  await scrollbar.press("Home");
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(0);
  await scrollbar.press("End");
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop / (element.scrollHeight - element.clientHeight))).toBeGreaterThan(0.95);
});

test("reflows Docs at a 200 percent equivalent viewport", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/docs/circle/gateway/unified-balance");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByTestId("docs-scroll-container")).toBeVisible();
});

for (const route of axeRoutes) {
  test(`${route.name} has no automated accessibility violations in both themes`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop-1440"), "paired desktop light/dark projects cover the Docs Axe matrix");
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });
}

for (const route of visualRoutes) {
  test(`${route.name} matches its detailed Docs visual baseline`, async ({ page }, testInfo) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByTestId("docs-scroll-container").evaluate((element) => element.scrollTo({ top: 0 }));
    await expect(page.getByTestId("docs-scrollbar")).toBeVisible();
    await expect(page).toHaveScreenshot(`docs-${route.name}-${testInfo.project.name}.png`, { fullPage: true });
  });
}
