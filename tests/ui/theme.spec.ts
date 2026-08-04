import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const visualRoutes = [
  { name: "landing", path: "/" },
  { name: "docs", path: "/docs" },
  { name: "login", path: "/auth/login" },
] as const;

const accessibilityRoutes = [
  "/",
  "/docs",
  "/auth/login",
  "/auth/sign-up",
] as const;

function isThemeAcceptanceProject(projectName: string) {
  return projectName === "desktop-1440" || projectName === "desktop-1440-light";
}

function isVisualProject(projectName: string) {
  return ["desktop-1440", "desktop-1440-light", "mobile-390", "mobile-390-light"].includes(projectName);
}

test("keeps an explicit theme while navigating between public, auth, and app surfaces", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one browser context is enough for persistence");

  await page.goto("/");
  const themeButton = page.getByRole("button", { name: "Giao diện" });
  await expect(themeButton).toBeVisible();
  await expect(themeButton).toHaveCSS("min-height", "44px");
  await expect(themeButton).toHaveCSS("min-width", "44px");

  await themeButton.click();
  await page.getByRole("menuitemradio", { name: "Sáng" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  for (const path of [
    "/docs",
    "/auth/login",
    "/auth/sign-up",
    "/auth/error",
    "/auth/update-password",
    "/dev/ui-preview",
  ]) {
    await page.goto(path);
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Giao diện" })).toBeVisible();
  }

  await page.getByRole("button", { name: "Giao diện" }).click();
  await page.getByRole("menuitemradio", { name: "Tối" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Giao diện" }).click();
  await page.getByRole("menuitemradio", { name: "Theo hệ thống" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("system");

  await page.goto("/docs");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("system");
});

for (const path of accessibilityRoutes) {
  test(`${path} has no serious or critical accessibility violations`, async ({ page }, testInfo) => {
    test.skip(!isThemeAcceptanceProject(testInfo.project.name), "axe runs once for each color scheme");
    await page.goto(path);

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
}

test("public and auth surfaces do not overflow on mobile", async ({ page }, testInfo) => {
  test.skip(!/mobile-390/.test(testInfo.project.name), "390px mobile acceptance check");

  for (const { path } of visualRoutes) {
    await page.goto(path);
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow, `${path} should fit the mobile viewport`).toBe(false);

    const themeButton = page.getByRole("button", { name: "Giao diện" });
    const box = await themeButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

for (const { name, path } of visualRoutes) {
  test(`${name} matches its light and dark visual baseline`, async ({ page }, testInfo) => {
    test.skip(!isVisualProject(testInfo.project.name), "desktop 1440px and mobile 390px only");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);

    await expect(page).toHaveScreenshot(`${name}.png`, {
      animations: "disabled",
      fullPage: true,
      stylePath: "tests/ui/screenshot.css",
    });
  });
}
