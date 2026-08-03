import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the command center state catalog with safe transaction copy", async ({ page }) => {
  await page.goto("/dev/ui-preview");

  await expect(page.getByRole("heading", { name: "Command center UI states" })).toBeVisible();
  await expect(page.getByText("From network", { exact: true })).toBeVisible();
  await expect(page.getByText("To network", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm 50 USDC" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Giao diện" })).toBeVisible();
  await expect(
    page.getByLabel("Transaction status: waiting_gateway").getByText("Finalizing", { exact: true }),
  ).toBeVisible();
});

test("keeps mobile navigation to four primary destinations without overflow", async ({ page }, testInfo) => {
  test.skip(!/mobile|tablet/.test(testInfo.project.name), "mobile-only navigation assertion");
  await page.goto("/dev/ui-preview");

  const navigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(navigation.getByRole("link", { name: "Chat" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Activity" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Contacts" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "More" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("uses activity cards instead of a horizontally scrolling table on mobile", async ({ page }, testInfo) => {
  test.skip(!/mobile/.test(testInfo.project.name), "mobile-only activity assertion");
  await page.goto("/dev/ui-preview");

  await expect(page.getByTestId("transaction-mobile-card")).toBeVisible();
  await expect(page.getByRole("table")).toBeHidden();
});

test("has no serious or critical automated accessibility violations", async ({ page }) => {
  await page.goto("/dev/ui-preview");

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
});

test("supports keyboard navigation and dismissal in the command palette", async ({ page }) => {
  await page.goto("/dev/ui-preview");

  const input = page.getByLabel("Command palette test");
  await input.focus();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toHaveValue("/balance avalanche");
  await input.press("Escape");
  await expect(input).toHaveValue("");
});

test("keeps the public landing and login surfaces available", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Stablecoin commands that feel like messaging" })).toBeVisible();

  await page.goto("/auth/login");
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("disables progress animation when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/ui-preview");

  const activeProgressIcon = page
    .getByLabel("Transaction status: waiting_gateway")
    .locator(".animate-spin")
    .first();
  await expect(activeProgressIcon).toBeVisible();
  await expect.poll(() => activeProgressIcon.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
});

test("historical execution snapshots stop animating and read as completed steps", async ({ page }) => {
  await page.goto("/dev/ui-preview");

  const historical = page.getByTestId("historical-running-status");
  await expect(historical.getByText("Step completed", { exact: true })).toBeVisible();
  await expect(historical.locator(".animate-spin")).toHaveCount(0);
});

test("desktop toolbar stays above chat content without overlap", async ({ page }, testInfo) => {
  test.skip(!/desktop-1024/.test(testInfo.project.name), "1024px desktop geometry assertion");
  await page.goto("/dev/ui-preview");

  const toolbarBox = await page.getByTestId("desktop-command-toolbar").boundingBox();
  const contentBox = await page.getByTestId("command-center-content").boundingBox();

  expect(toolbarBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(contentBox!.y);
});

test("matches the command center visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/ui-preview");

  await expect(page).toHaveScreenshot("command-center.png", {
    animations: "disabled",
    fullPage: true,
    stylePath: "tests/ui/screenshot.css",
  });
});
