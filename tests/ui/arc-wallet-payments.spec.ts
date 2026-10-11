import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { arcPaymentData, type ArcWalletPayment } from "../../lib/paycmd/arc-payment";

const sender = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";
const hash = `0x${"ab".repeat(32)}` as const;
const id = "d8c88df6-b144-483a-9e9d-34c2cc268ea0";
const makePayment = (network: "mainnet" | "testnet"): ArcWalletPayment => ({
  id, user_id: "user-1", network, chain_id: network === "mainnet" ? 5042 : 5042002,
  sender, recipient, amount: "0.000001", amount_units: "1", call_data: arcPaymentData(recipient, 1n),
  gas_limit: "30000", max_fee_per_gas: "20000000000", max_priority_fee_per_gas: "0",
  status: "prepared", tx_hash: null, expires_at: new Date(Date.now() + 120_000).toISOString(), created_at: new Date().toISOString(), error_message: null,
});

async function wallet(page: Page, reject = false) {
  await page.addInitScript(({ sender, hash, reject }) => {
    const state = { chain: "0x13b2", sends: 0, signatures: 0 };
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    Object.assign(window, {
      __walletState: state,
      ethereum: { isMetaMask: true,
        on: (event: string, fn: (...args: unknown[]) => void) => { (listeners[event] ??= []).push(fn); },
        removeListener: () => {},
        request: async ({ method, params }: { method: string; params?: Record<string, string>[] }) => {
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [sender];
          if (method === "eth_chainId") return state.chain;
          if (method === "wallet_switchEthereumChain") { state.chain = params![0].chainId; return null; }
          if (method === "personal_sign") { state.signatures++; return `0x${"11".repeat(65)}`; }
          if (method === "eth_sendTransaction") {
            state.sends++;
            await new Promise((resolve) => setTimeout(resolve, 150));
            if (reject) throw Object.assign(new Error("User rejected"), { code: 4001 });
            return hash;
          }
          throw new Error(`Unexpected wallet method ${method}`);
        },
      },
    });
  }, { sender, hash, reject });
}

async function boundary(page: Page, options: { pending?: boolean; failSubmit?: boolean; failPreview?: boolean } = {}) {
  const payments: ArcWalletPayment[] = [];
  let confirms = 0;
  let syncs = 0;
  await page.route("**/api/arc-payments**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "GET") {
      await route.fulfill({ json: { payments: payments.filter((p) => p.network === url.searchParams.get("network")), userId: "user-1" } }); return;
    }
    const body = req.postDataJSON();
    if (url.pathname === "/api/arc-payments") {
      if (options.failPreview) { await route.fulfill({ status: 503, json: { error: "RPC unavailable" } }); return; }
      const payment = makePayment(body.network); payments.push(payment);
      await route.fulfill({ json: { payment, ownershipMessage: "Confirm this payment preview" } }); return;
    }
    const payment = payments.find((p) => p.id === id)!;
    if (body.action === "confirm") { confirms++; payment.status = "signing"; }
    if (body.action === "reject") payment.status = "rejected";
    if (body.action === "submit") {
      if (options.failSubmit) { await route.fulfill({ status: 503, json: { error: "Storage temporarily unavailable" } }); return; }
      payment.tx_hash = body.txHash; payment.status = "submitted";
    }
    if (body.action === "sync") { syncs++; if (!options.pending) payment.status = "success"; }
    await route.fulfill({ json: { payment } });
  });
  return { payments, confirms: () => confirms, syncs: () => syncs };
}

async function preview(page: Page) {
  await page.goto("/pay");
  await page.getByRole("button", { name: "Kết nối MetaMask", exact: true }).click();
  await page.getByLabel("Lệnh /pay", { exact: true }).fill(`/pay 0.000001 USDC to ${recipient} on arc-mainnet`);
  await page.getByRole("button", { name: "Xem preview" }).click();
  await expect(page.getByRole("region", { name: "Payment preview" })).toBeVisible();
}

test("mainnet preview shows amount, recipient and gas and double confirmation broadcasts once", async ({ page }, testInfo) => {
  await wallet(page); const api = await boundary(page); await preview(page);
  const panel = page.getByRole("region", { name: "Payment preview" });
  await expect(panel).toContainText("Arc Mainnet · 5042");
  await expect(panel).toContainText(recipient);
  await expect(panel).toContainText("0.0006 USDC");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("arc-payment-preview.png"), fullPage: true });
  const confirm = page.getByRole("button", { name: "Xác nhận 0.000001 USDC trên Arc Mainnet" });
  const panelBox = (await panel.boundingBox())!;
  const confirmBox = (await confirm.boundingBox())!;
  expect(confirmBox.x + confirmBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
  // Invoke the same button twice in one event turn, before React renders disabled state.
  await confirm.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole("region", { name: "Payment history" })).toContainText("Thành công • đã xác minh trên chain");
  expect(api.confirms()).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { __walletState: { sends: number } }).__walletState.sends)).toBe(1);
  await expect(page.getByRole("link", { name: hash, exact: true })).toHaveAttribute("href", `https://explorer.arc.io/tx/${hash}`);
});

test("rejecting wallet transaction records rejection and never claims success", async ({ page }) => {
  await wallet(page, true); const api = await boundary(page); await preview(page);
  await page.getByRole("button", { name: "Xác nhận 0.000001 USDC trên Arc Mainnet" }).click();
  await expect(page.getByRole("alert", { name: "Payment error" })).toContainText("từ chối ký");
  await expect(page.getByRole("region", { name: "Payment history" })).toContainText("Đã từ chối ký • chưa gửi");
  expect(api.syncs()).toBe(0);
  expect(api.payments[0].tx_hash).toBeNull();
});

test("pending remains pending after reload and histories stay network-scoped", async ({ page }) => {
  await wallet(page); await boundary(page, { pending: true }); await preview(page);
  await page.getByRole("button", { name: "Xác nhận 0.000001 USDC trên Arc Mainnet" }).click();
  await expect(page.getByRole("region", { name: "Payment history" })).toContainText("Đã gửi • đang chờ receipt");
  await page.reload();
  await expect(page.getByRole("region", { name: "Payment history" })).toContainText(hash);
  expect(await page.evaluate(() => (window as unknown as { __walletState: { sends: number } }).__walletState.sends)).toBe(0);
  await page.getByLabel("Mạng thanh toán", { exact: true }).selectOption("testnet");
  await expect(page.getByRole("region", { name: "Payment history" })).toContainText("Chưa có thanh toán");
  await expect(page.getByRole("link", { name: hash, exact: true })).toHaveCount(0);
});

test("reload restores a locally saved hash when API failed after broadcast", async ({ page }) => {
  await wallet(page); const options = { failSubmit: true }; const api = await boundary(page, options); await preview(page);
  await page.getByRole("button", { name: "Xác nhận 0.000001 USDC trên Arc Mainnet" }).click();
  await expect(page.getByRole("alert", { name: "Payment error" })).toContainText("Storage temporarily unavailable");
  expect(api.payments[0].status).toBe("signing");
  options.failSubmit = false;
  await page.reload();
  await expect(page.getByRole("region", { name: "Payment history" })).toContainText("Thành công • đã xác minh trên chain", { timeout: 20_000 });
  expect(await page.evaluate(() => (window as unknown as { __walletState: { sends: number } }).__walletState.sends)).toBe(0);
});

test("wrong network, invalid amount and RPC failure never prompt transaction signing", async ({ page }) => {
  await wallet(page); await boundary(page, { failPreview: true });
  await page.goto("/pay"); await page.getByRole("button", { name: "Kết nối MetaMask", exact: true }).click();
  await page.getByLabel("Lệnh /pay", { exact: true }).fill(`/pay 0 USDC to ${recipient}`);
  await page.getByRole("button", { name: "Xem preview" }).click();
  await expect(page.getByRole("alert", { name: "Payment error" })).toContainText("positive");
  await page.getByLabel("Lệnh /pay", { exact: true }).fill(`/pay 1 USDC to ${recipient}`);
  await page.evaluate(() => { (window as unknown as { __walletState: { chain: string } }).__walletState.chain = "0x4cef52"; });
  await page.getByRole("button", { name: "Xem preview" }).click();
  await expect(page.getByRole("alert", { name: "Payment error" })).toContainText("Chuyển MetaMask sang Arc Mainnet");
  await page.evaluate(() => { (window as unknown as { __walletState: { chain: string } }).__walletState.chain = "0x13b2"; });
  await page.getByRole("button", { name: "Xem preview" }).click();
  await expect(page.getByRole("alert", { name: "Payment error" })).toContainText("RPC unavailable");
  expect(await page.evaluate(() => (window as unknown as { __walletState: { sends: number; signatures: number } }).__walletState)).toMatchObject({ sends: 0, signatures: 0 });
});

test("legacy API rejects mainnet before invoking any testnet rail", async ({ request }) => {
  const response = await request.post("/api/swap/quote", { data: { network: "mainnet", chain: "arcMainnet" } });
  expect(response.status()).toBe(422);
  expect((await response.json()).error).toBe("MAINNET_RAIL_UNSUPPORTED");
});
