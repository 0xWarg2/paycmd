import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { expect, test } from "@playwright/test";

const walletAddress = "0x2222222222222222222222222222222222222222";

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function testAccessToken() {
  return [
    base64UrlJson({ alg: "HS256", typ: "JWT" }),
    base64UrlJson({ exp: 4_102_444_800, sub: "wallet-context-user", role: "authenticated" }),
    "test-signature",
  ].join(".");
}

type PersistedChatRow = {
  id: string;
  thread_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  kind: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

function jsonResponse(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": [
      "authorization",
      "apikey",
      "content-profile",
      "content-type",
      "prefer",
      "x-client-info",
      "x-supabase-api-version",
    ].join(", "),
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(body));
}

async function requestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function startSupabaseBoundary() {
  const rows: PersistedChatRow[] = [];
  const user = {
    id: "wallet-context-user",
    aud: "authenticated",
    role: "authenticated",
    email: "wallet-context@example.com",
  };
  const thread = {
    id: "wallet-context-thread",
    user_id: user.id,
    title: "Payna chat",
    status: "active",
    created_at: "2026-08-07T00:00:00.000Z",
    updated_at: "2026-08-07T00:00:00.000Z",
    last_message_preview: null,
    last_message_at: null,
    last_message_role: null,
    last_message_kind: null,
    message_count: 0,
  };
  let rowSequence = 0;

  const server = createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": [
          "authorization",
          "apikey",
          "content-profile",
          "content-type",
          "prefer",
          "x-client-info",
          "x-supabase-api-version",
        ].join(", "),
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      });
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1:54321");
    if (request.method === "GET" && url.pathname === "/auth/v1/user") {
      jsonResponse(response, 200, user);
      return;
    }

    if (url.pathname === "/rest/v1/chat_threads") {
      if (request.method === "PATCH") {
        response.writeHead(204, { "Access-Control-Allow-Origin": "*" });
        response.end();
        return;
      }

      const wantsSingle = request.headers.accept?.includes("application/vnd.pgrst.object+json");
      jsonResponse(response, 200, wantsSingle ? thread : [thread]);
      return;
    }

    if (url.pathname === "/rest/v1/chat_messages" && request.method === "GET") {
      jsonResponse(response, 200, [...rows].reverse());
      return;
    }

    if (url.pathname === "/rest/v1/chat_messages" && request.method === "POST") {
      const insert = await requestBody(request);
      rowSequence += 1;
      const row = {
        id: `wallet-context-message-${rowSequence}`,
        ...insert,
        created_at: new Date(Date.UTC(2026, 7, 7, 0, 0, rowSequence)).toISOString(),
      } as PersistedChatRow;
      rows.push(row);
      jsonResponse(response, 201, row);
      return;
    }

    jsonResponse(response, 404, {
      message: `Unhandled Supabase boundary: ${request.method} ${url.pathname}`,
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(54_321, "127.0.0.1", resolve);
  });

  return {
    rows,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

test("real PaycmdApp persists wallet status and enforces AskPayna mode boundaries", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1024", "focused real-app integration assertion");

  const supabase = await startSupabaseBoundary();
  try {
    const cryptoInputs: string[] = [];
    const commandInputs: string[] = [];
    const executionRequests: string[] = [];
    const slashInput = "/pay 50 USDC to Minh on arc from base";
    const transferQuestion = "Làm sao gửi 50 USDC sang Arc nhanh nhất?";
    const researchQuestion = "What is Circle Gateway?";
    const accessToken = testAccessToken();
    const session = {
      access_token: accessToken,
      refresh_token: "wallet-context-refresh-token",
      expires_at: 4_102_444_800,
      expires_in: 3_600,
      token_type: "bearer",
      user: {
        id: "wallet-context-user",
        aud: "authenticated",
        role: "authenticated",
        email: "wallet-context@example.com",
      },
    };

    await page.context().addCookies([
      {
        name: "sb-127-auth-token",
        value: `base64-${base64UrlJson(session)}`,
        url: "http://127.0.0.1:3010",
      },
    ]);
    await page.addInitScript(() => window.localStorage.setItem("paycmd_locale", "en"));
    await page.addInitScript(() => {
      const walletRequests: string[] = [];
      Object.defineProperty(window, "__paynaWalletRequests", { value: walletRequests });
      Object.defineProperty(window, "ethereum", {
        configurable: true,
        value: {
          request: async ({ method }: { method: string }) => {
            walletRequests.push(method);
            throw new Error(`Unexpected wallet request: ${method}`);
          },
        },
      });
    });
    page.on("request", (request) => {
      if (request.method() === "GET") return;
      const pathname = new URL(request.url()).pathname;
      if (
        pathname === "/api/commands/parse" ||
        pathname === "/api/payments/pay" ||
        pathname === "/api/payment-drafts" ||
        pathname.startsWith("/api/payment-drafts/") ||
        pathname === "/api/gateway/transfer" ||
        pathname === "/api/gateway/deposit" ||
        pathname === "/api/gateway/withdraw" ||
        pathname === "/api/gateway/delegate" ||
        pathname === "/api/user/fund" ||
        pathname === "/api/user/link-metamask" ||
        pathname === "/api/deposit" ||
        pathname.startsWith("/api/cctp/") ||
        pathname.startsWith("/api/swap/")
      ) {
        executionRequests.push(`${request.method()} ${pathname}`);
      }
    });
    await page.route("**/api/notifications", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"notifications":[]}' }),
    );
    await page.route("**/api/gateway/balance", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"totalUnified":0,"failedChains":[]}',
      }),
    );
    await page.route("**/api/gateway/deposit/sync", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"pending":[],"completed":[]}',
      }),
    );
    await page.route("**/api/ai/quota", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );
    await page.route("**/api/ai/crypto", async (route) => {
      const input = (route.request().postDataJSON() as { input: string }).input;
      cryptoInputs.push(input);
      const acceptanceResponse =
        input === slashInput
          ? "AskPayna explained the slash command without preparing a transaction."
          : input === transferQuestion
            ? "AskPayna explained the Arc route with Circle and Arc evidence."
            : input === researchQuestion
              ? "AskPayna researched Circle Gateway after explicit consent."
              : null;
      if (acceptanceResponse) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            assistantText: acceptanceResponse,
            provider: "asksurf",
            citations: [],
            groundingStatus: "verified",
            knowledgeSources: ["circle", "arc"],
            walletContextStatus: "verified",
          }),
        });
        return;
      }
      const requestedStatus = input.split(" ").at(-1);
      const walletContextStatus = requestedStatus === "invalid" ? "ready" : requestedStatus;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assistantText: `# Wallet context\n\nWallet context ${requestedStatus} response.`,
          provider: "asksurf",
          citations: [],
          walletContextStatus,
          walletContext: {
            externalWallets: [{ address: walletAddress, usdc: "30" }],
          },
        }),
      });
    });
    await page.route("**/api/ai/command", async (route) => {
      const input = (route.request().postDataJSON() as { input: string }).input;
      commandInputs.push(input);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          intent: "crypto_research",
          canonicalCommand: "",
          assistantText: "Research requires explicit AskPayna consent.",
          missingFields: [],
          suggestions: [],
          parsedCommand: null,
          decision: {
            speechAct: "question",
            confidence: "high",
            reasonCode: "informational_question",
          },
          modelProfile: "test-intent-router",
        }),
      });
    });

    await page.goto("/app");
    await expect(page.getByRole("button", { name: /^Payna chat/ }).first()).toBeVisible();
    await page.getByRole("button", { name: "AskPayna", exact: true }).click();
    const composer = page.locator("form").getByRole("textbox");
    for (const [status, label] of [
      ["verified", "Balances verified"],
      ["partial", "Some balances unavailable"],
      ["unavailable", "Balances unavailable"],
    ] as const) {
      await composer.fill(`explain context ${status}`);
      await page.getByRole("button", { name: "Send" }).click();
      await expect(
        page.getByText(`Wallet context ${status} response.`, { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(label, { exact: true })).toBeVisible();

      const savedAssistant = supabase.rows.at(-1);
      expect(savedAssistant?.role).toBe("assistant");
      expect(savedAssistant?.metadata.walletContextStatus).toBe(status);
      expect(JSON.stringify(savedAssistant?.metadata)).not.toContain(walletAddress);
      expect(JSON.stringify(savedAssistant?.metadata)).not.toContain("externalWallets");

      await page.reload();
      await expect(page.getByRole("button", { name: /^Payna chat/ }).first()).toBeVisible();
      await expect(
        page.getByText(`Wallet context ${status} response.`, { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(label, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "AskPayna", exact: true }).click();
    }

    await composer.fill("explain context invalid");
    await page.getByRole("button", { name: "Send" }).click();
    const invalidResponse = page.getByText("Wallet context invalid response.", { exact: true });
    await expect(invalidResponse).toBeVisible();
    const invalidMessage = invalidResponse.locator(
      "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' payna-message ')][1]",
    );
    await expect(invalidMessage).not.toContainText("Balances");
    expect(supabase.rows.at(-1)?.metadata.walletContextStatus).toBeNull();

    await expect(page.getByText(walletAddress)).toHaveCount(0);
    expect(JSON.stringify(supabase.rows)).not.toContain(walletAddress);
    expect(JSON.stringify(supabase.rows)).not.toContain("externalWallets");
    expect(JSON.stringify(supabase.rows)).not.toContain('"usdc":"30"');
    await expect(
      page.getByRole("button", { name: /confirm|retry command|switch to payna/i }),
    ).toHaveCount(0);
    await expect(page.getByText("Transaction preview", { exact: true })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("button", { name: /^Payna chat/ }).first()).toBeVisible();
    const reloadedInvalidResponse = page.getByText("Wallet context invalid response.", {
      exact: true,
    });
    await expect(reloadedInvalidResponse).toBeVisible();
    await expect(
      reloadedInvalidResponse.locator(
        "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' payna-message ')][1]",
      ),
    ).not.toContainText("Balances");
    await expect(page.getByText(walletAddress)).toHaveCount(0);

    await page.getByRole("button", { name: "AskPayna", exact: true }).click();
    await composer.fill(slashInput);
    await page.getByRole("button", { name: "Send" }).click();
    await expect.poll(() => [...cryptoInputs]).toContain(slashInput);
    await expect(
      page.getByText("AskPayna explained the slash command without preparing a transaction.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(/AskPayna only explains and researches/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Confirm\b/i })).toHaveCount(0);
    await expect(page.getByText("Transaction preview", { exact: true })).toHaveCount(0);
    expect(supabase.rows.some((row) => row.kind === "preview")).toBe(false);
    expect(executionRequests).toEqual([]);
    expect(
      await page.evaluate(() => [...((window as any).__paynaWalletRequests as string[])]),
    ).toEqual([]);

    await composer.fill(transferQuestion);
    await page.getByRole("button", { name: "Send" }).click();
    await expect.poll(() => [...cryptoInputs]).toContain(transferQuestion);
    await expect(
      page.getByText("AskPayna explained the Arc route with Circle and Arc evidence.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(commandInputs).toEqual([]);
    expect(cryptoInputs.filter((input) => input === slashInput)).toHaveLength(1);
    expect(cryptoInputs.filter((input) => input === transferQuestion)).toHaveLength(1);
    await expect(page.getByRole("button", { name: /^Confirm\b/i })).toHaveCount(0);
    await expect(page.getByText("Transaction preview", { exact: true })).toHaveCount(0);
    expect(supabase.rows.some((row) => row.kind === "preview")).toBe(false);
    expect(executionRequests).toEqual([]);
    expect(
      await page.evaluate(() => [...((window as any).__paynaWalletRequests as string[])]),
    ).toEqual([]);

    await page.getByRole("button", { name: "Payna", exact: true }).click();
    await composer.fill(researchQuestion);
    await page.getByRole("button", { name: "Send" }).click();
    await expect.poll(() => [...commandInputs]).toEqual([researchQuestion]);
    await expect(
      page
        .getByTestId("command-center-content")
        .getByText(/This question fits AskPayna\. Switch modes and start research only if you choose the action below\./i),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Research effort" })).toHaveCount(0);
    expect(cryptoInputs.filter((input) => input === researchQuestion)).toHaveLength(0);

    const consentAction = page.getByRole("button", { name: "Switch to AskPayna" });
    await expect(consentAction).toBeVisible();
    await consentAction.click();
    await expect.poll(() => cryptoInputs.filter((input) => input === researchQuestion)).toHaveLength(1);
    await expect(page.getByRole("combobox", { name: "Research effort" })).toBeVisible();
    await expect(
      page
        .getByTestId("command-center-content")
        .getByText("AskPayna researched Circle Gateway after explicit consent.", {
          exact: true,
        }),
    ).toBeVisible();
    expect(commandInputs).toEqual([researchQuestion]);
    expect(cryptoInputs.filter((input) => input === researchQuestion)).toHaveLength(1);
    await expect(page.getByRole("button", { name: /^Confirm\b/i })).toHaveCount(0);
    await expect(page.getByText("Transaction preview", { exact: true })).toHaveCount(0);
    expect(supabase.rows.some((row) => row.kind === "preview")).toBe(false);
    expect(executionRequests).toEqual([]);
    expect(
      await page.evaluate(() => [...((window as any).__paynaWalletRequests as string[])]),
    ).toEqual([]);
  } finally {
    await supabase.close();
  }
});
