import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("paycmd_locale", "en"));
});

test("shows the recommended Unified Gateway allocation before unused sources", async ({ page }) => {
  await page.goto("/dev/unified-gateway-preview");

  const selector = page.getByRole("region", { name: "Unified Gateway source allocation" });
  await expect(selector.getByText("Recommended · Auto-selected")).toBeVisible();
  await expect(selector.getByText("Unichain Sepolia")).toBeVisible();
  await expect(selector.getByText("OP Sepolia")).toBeVisible();
  await expect(selector.getByText("Other available sources (4)")).toBeVisible();
  await expect(selector.getByText("Unused sources will not be charged or signed.")).toBeVisible();
  await expect(selector.getByText("Estimated total fee")).toBeVisible();
  await expect(selector.getByText("Fee buffer")).toBeVisible();
  await expect(selector.getByText("Fee protection limit", { exact: true })).toBeVisible();
  await expect(selector.getByText("Maximum possible debit")).toBeVisible();

  const estimatedFee = Number(await selector.getByTestId("gateway-estimated-fee").getAttribute("data-atomic-usdc"));
  const feeLimit = Number(await selector.getByTestId("gateway-fee-limit").getAttribute("data-atomic-usdc"));
  expect(feeLimit).toBeGreaterThan(estimatedFee);

  const sourceCards = selector.getByTestId("gateway-allocated-source");
  await expect(sourceCards).toHaveCount(2);
  await expect(sourceCards.nth(0)).toContainText("Unichain Sepolia");
  await expect(sourceCards.nth(1)).toContainText("OP Sepolia");
});

test("starts custom mode from recommended sources and can restore automatic mode", async ({ page }) => {
  await page.goto("/dev/unified-gateway-preview");

  const selector = page.getByRole("region", { name: "Unified Gateway source allocation" });
  await selector.getByRole("button", { name: "Customize sources" }).click();
  await expect(selector.getByText("Custom selection")).toBeVisible();

  const unichain = selector.getByRole("checkbox", { name: "Unichain Sepolia" });
  const optimism = selector.getByRole("checkbox", { name: "OP Sepolia" });
  const base = selector.getByRole("checkbox", { name: "Base Sepolia" });
  await expect(unichain).toBeChecked();
  await expect(optimism).toBeChecked();
  await expect(base).not.toBeChecked();

  await base.check();
  await expect(selector.getByText("Refreshing allocation…")).toBeVisible();
  await expect(base).toBeChecked();

  await selector.getByRole("button", { name: "Restore recommended" }).click();
  await expect(selector.getByText("Recommended · Auto-selected")).toBeVisible();
});

test("keeps custom source cards inside a 390-pixel viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-390"), "390px mobile assertion");
  await page.goto("/dev/unified-gateway-preview");

  const selector = page.getByRole("region", { name: "Unified Gateway source allocation" });
  await selector.getByRole("button", { name: "Customize sources" }).click();
  await expect(selector.getByTestId("gateway-source-choice")).toHaveCount(6);
  expect(await selector.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("supports keyboard source customization without serious accessibility violations", async ({ page }) => {
  await page.goto("/dev/unified-gateway-preview");

  const selector = page.getByRole("region", { name: "Unified Gateway source allocation" });
  const customize = selector.getByRole("button", { name: "Customize sources" });
  await customize.focus();
  await customize.press("Enter");
  await expect(selector.getByText("Custom selection")).toBeVisible();

  const base = selector.getByRole("checkbox", { name: "Base Sepolia" });
  await base.focus();
  await base.press("Space");
  await expect(base).toBeChecked();

  const results = await new AxeBuilder({ page })
    .include('[aria-label="Unified Gateway source allocation"]')
    .analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === "serious" || violation.impact === "critical");
  expect(blocking).toEqual([]);
});

test("requires an explicit authorization action for allocated delegate sources", async ({ page }) => {
  await page.goto("/dev/unified-gateway-preview?delegate=1");

  const selector = page.getByRole("region", { name: "Unified Gateway source allocation" });
  await expect(selector.getByText("Authorization required")).toBeVisible();
  await expect(selector.getByText(/Delegate authorization is persistent/)).toBeVisible();
  await selector.getByRole("button", { name: "Authorize selected sources" }).click();
  await expect(selector.getByText("Authorization submitted")).toBeVisible();
});
