import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("requires confirmation before deleting the selected contact", async ({ page }) => {
  let deleteRequests = 0;
  await page.route("**/api/contacts/contact-minh", async (route) => {
    deleteRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true, id: "contact-minh" }) });
  });
  await page.goto("/dev/contacts-preview");

  const deleteMinhButton = page.getByRole("button", { name: "Xoá contact Minh" });
  await deleteMinhButton.click();
  await expect(page.getByRole("dialog")).toContainText("Minh");
  await page.getByRole("button", { name: "Hủy" }).click();
  expect(deleteRequests).toBe(0);
  await expect(page.getByText("Minh", { exact: true })).toBeVisible();
  await expect(deleteMinhButton).toBeFocused();

  await deleteMinhButton.click();
  await page.getByRole("button", { name: "Xoá contact", exact: true }).click();
  await expect(page.getByText("Minh", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Đã xoá contact Minh.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Xoá contact Lan" })).toBeFocused();
  expect(deleteRequests).toBe(1);
});

test("shows the empty state after deleting the final contact", async ({ page }) => {
  await page.route("**/api/contacts/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true, id: "contact-minh" }) }),
  );
  await page.goto("/dev/contacts-preview?single=1");
  await page.getByRole("button", { name: "Xoá contact Minh" }).click();
  await page.getByRole("button", { name: "Xoá contact", exact: true }).click();
  const emptyState = page.getByText(/Chưa có contact\./);
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toBeFocused();
});

test("disables the destructive action while deletion is pending", async ({ page }) => {
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/contacts/contact-minh", async (route) => {
    await responseGate;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true, id: "contact-minh" }) });
  });
  await page.goto("/dev/contacts-preview");
  await page.getByRole("button", { name: "Xoá contact Minh" }).click();
  await page.getByRole("button", { name: "Xoá contact", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đang xoá..." })).toBeDisabled();
  releaseResponse();
  await expect(page.getByText("Minh", { exact: true })).toHaveCount(0);
});

test("keeps the contact and dialog available when deletion fails", async ({ page }) => {
  await page.route("**/api/contacts/contact-minh", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "database unavailable" }) }),
  );
  await page.goto("/dev/contacts-preview");
  await page.getByRole("button", { name: "Xoá contact Minh" }).click();
  await page.getByRole("button", { name: "Xoá contact", exact: true }).click();
  await expect(page.getByText("Minh", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Không thể xoá contact. Vui lòng thử lại.")).toBeVisible();
});

test("keeps the contact confirmation accessible without horizontal overflow", async ({ page }) => {
  await page.goto("/dev/contacts-preview");
  await page.getByRole("button", { name: "Xoá contact Minh" }).click();

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("creates a group and manages members without deleting contacts", async ({ page }) => {
  await page.goto("/dev/contacts-preview");
  await page.getByRole("button", { name: "Tạo nhóm" }).click();
  await page.getByLabel("Tên nhóm").fill("Core Team");
  await page.getByRole("button", { name: "Lưu nhóm" }).click();
  await expect(page.getByRole("button", { name: /Core Team.*0 thành viên/ })).toBeVisible();

  await page.getByRole("button", { name: /Quản lý thành viên Core Team/ }).click();
  await page.getByRole("checkbox", { name: "Minh" }).check();
  await page.getByRole("button", { name: "Lưu thành viên" }).click();
  await expect(page.getByRole("button", { name: /Core Team.*1 thành viên/ })).toBeVisible();
  await expect(page.getByText("Minh", { exact: true })).toBeVisible();
});

test("deleting a group keeps its contacts", async ({ page }) => {
  await page.goto("/dev/contacts-preview?group=core-team");
  await page.getByRole("button", { name: "Xoá nhóm Core Team" }).click();
  await expect(page.getByRole("dialog")).toContainText("contact vẫn được giữ lại");
  await page.getByRole("button", { name: "Xoá nhóm", exact: true }).click();
  await expect(page.getByText("Core Team", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Minh", { exact: true })).toBeVisible();
});
