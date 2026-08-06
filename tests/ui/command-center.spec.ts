import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the command center state catalog with safe transaction copy", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("paycmd_locale", "en"));
  await page.goto("/dev/ui-preview");

  await expect(page.getByRole("heading", { name: "Command center UI states" })).toBeVisible();
  await expect(page.getByText("From network", { exact: true })).toBeVisible();
  await expect(page.getByText("To network", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm 50 USDC" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Appearance" })).toBeVisible();
  await expect(
    page.getByLabel("Transaction status: waiting_gateway").getByText("Finalizing", { exact: true }),
  ).toBeVisible();
});

test("switching an active Payna preview to AskPayna cancels it and removes confirmation controls", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("paycmd_locale", "en"));
  await page.goto("/dev/ui-preview?modeSafety=1");

  await expect(page.getByRole("button", { name: "Confirm 50 USDC" })).toBeVisible();
  await page.getByRole("button", { name: "Select AskPayna" }).click();

  await expect(page.getByTestId("mode-safety-state")).toContainText("asksurf:cancelled");
  await expect(page.getByRole("button", { name: "Confirm 50 USDC" })).toHaveCount(0);
});

test("stale confirm and persisted retry callbacks cannot execute in AskPayna", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("paycmd_locale", "en"));
  await page.goto("/dev/ui-preview?modeSafety=1");

  await expect(page.getByRole("button", { name: "Retry command" })).toBeVisible();
  await page.getByRole("button", { name: "Select AskPayna" }).click();
  await expect(page.getByRole("button", { name: "Retry command" })).toHaveCount(0);

  await page.getByRole("button", { name: "Invoke stale confirm callback" }).click();
  await page.getByRole("button", { name: "Invoke stale retry callback" }).click();
  await expect(page.getByTestId("mode-safety-state")).toContainText("confirmed=0:retried=0");
});

test("switch to Payna only changes mode and prefills without submitting", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("paycmd_locale", "en"));
  await page.goto("/dev/ui-preview?modeSafety=1");

  await page.getByRole("button", { name: "Select AskPayna" }).click();
  await page.getByRole("button", { name: "Switch to Payna" }).click();

  await expect(page.getByLabel("Mode safety input")).toHaveValue("/pay 50 USDC to Minh on arc from base");
  await expect(page.getByTestId("mode-safety-state")).toContainText("paycmd");
  await expect(page.getByTestId("mode-safety-state")).toContainText("submitted=0");
});

test("Payna questions wait for the explicit AskPayna consent action", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("paycmd_locale", "en"));
  await page.goto("/dev/ui-preview?modeSafety=1");

  await expect(page.getByText("This question requires AskPayna consent.")).toBeVisible();
  await expect(page.getByTestId("mode-safety-state")).toContainText("research=0");
  await page.getByRole("button", { name: "Switch to AskPayna" }).click();

  await expect(page.getByTestId("mode-safety-state")).toContainText("asksurf");
  await expect(page.getByTestId("mode-safety-state")).toContainText("research=1");
});

test("shows compact wallet availability on AskPayna answers without exposing addresses", async ({ page }) => {
  await page.goto("/dev/ui-preview?walletContext=1");

  for (const [status, label] of [
    ["verified", "Balances verified"],
    ["partial", "Some balances unavailable"],
    ["unavailable", "Balances unavailable"],
  ] as const) {
    const message = page.getByTestId(`wallet-context-message-${status}`);
    await expect(message.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByTestId(`wallet-context-metadata-${status}`)).toHaveText(
      JSON.stringify({ walletContextStatus: status }),
    );
  }
  await expect(page.getByText("0x2222222222222222222222222222222222222222")).toHaveCount(0);
});

test("expires a transaction preview after fifteen seconds", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-08-07T00:00:00.000Z") });
  await page.addInitScript(() => window.localStorage.setItem("paycmd_locale", "en"));
  await page.goto("/dev/ui-preview");

  await expect(page.getByRole("timer")).toHaveText("00:15");
  await page.clock.fastForward(15_000);

  await expect(page.getByRole("button", { name: /Confirm 50 USDC/i })).toBeDisabled();
  await expect(page.getByText(/Preview expired/i)).toBeVisible();
  await expect(page.getByTestId("preview-lease-metadata")).toHaveText("cancelled:expired:1");
});

test("cancels an already expired persisted preview through the production card", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-08-07T00:00:00.000Z") });
  await page.addInitScript(() => window.localStorage.setItem("paycmd_locale", "en"));
  await page.goto("/dev/ui-preview?previewLease=expired");

  await expect(page.getByText(/Preview expired/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm 50 USDC/i })).toBeDisabled();
  await expect(page.getByTestId("preview-lease-metadata")).toHaveText("cancelled:expired:1");

  await page.clock.fastForward(60_000);
  await expect(page.getByTestId("preview-lease-metadata")).toHaveText("cancelled:expired:1");
});

test("fails closed for a legacy active preview without an expiry", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-08-07T00:00:00.000Z") });
  await page.addInitScript(() => window.localStorage.setItem("paycmd_locale", "en"));
  await page.goto("/dev/ui-preview?previewLease=legacy");

  await expect(page.getByText(/Preview expired/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm 50 USDC/i })).toBeDisabled();
  await expect(page.getByTestId("preview-lease-metadata")).toHaveText("cancelled:expired:1");
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
  await page.clock.install({ time: new Date("2026-08-07T00:00:00.000Z") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/ui-preview");
  await expect(page.getByText(/MetaMask is not available/i)).toBeVisible();

  await expect(page).toHaveScreenshot("command-center.png", {
    animations: "disabled",
    fullPage: true,
    mask: [page.getByRole("timer")],
    stylePath: "tests/ui/screenshot.css",
  });
});
