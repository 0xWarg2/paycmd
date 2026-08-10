import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function runtimeSourceFiles(directory: string): string[] {
  const absolute = path.join(root, directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return runtimeSourceFiles(relative);
    if (!/\.(?:ts|tsx)$/.test(entry.name) || entry.name.endsWith(".test.ts")) return [];
    return [relative];
  });
}

test("Gateway runtime contains no managed EOA signer or delegate fallback", () => {
  const forbidden = [
    /gateway_signer/,
    /getOrCreateGatewayEOAWallet/,
    /getGatewayEOAWalletId/,
    /transferGateway\w*WithEOA/,
    /isGatewaySignerAuthorized/,
    /addDelegate\s*\(/,
    /isAuthorizedForBalance/,
    /PAYNA_GATEWAY_AUTH_MODE/,
    /accountType\s*:\s*["']EOA["']/,
  ];
  const violations: string[] = [];

  for (const file of [
    ...runtimeSourceFiles("app"),
    ...runtimeSourceFiles("components"),
    ...runtimeSourceFiles("lib/circle"),
    ...runtimeSourceFiles("lib/paycmd"),
  ]) {
    const contents = source(file);
    for (const pattern of forbidden) {
      if (pattern.test(contents)) violations.push(`${file}: ${pattern}`);
    }
  }

  assert.deepEqual(violations, []);
  assert.equal(
    existsSync(path.join(root, "lib/circle/create-gateway-eoa-wallets.ts")),
    false,
    "the managed Gateway EOA module must stay deleted",
  );
});

test("wallet onboarding creates SCA wallets from the configured Circle chain list", () => {
  for (const file of ["app/api/wallet/route.ts", "lib/circle/ensure-user-wallet.ts"]) {
    const contents = source(file);
    assert.match(contents, /accountType\s*:\s*["']SCA["']/);
    assert.match(contents, /Object\.values\(CIRCLE_CHAIN_NAMES\)/);
    assert.doesNotMatch(contents, /accountType\s*:\s*["']EOA["']/);
  }
});

test("Gateway execution binds depositor, signer, multi-source and manual mint to the SCA", () => {
  const transferRoute = source("app/api/gateway/transfer/route.ts");
  const unifiedServer = source("lib/paycmd/gateway-unified-server.ts");
  const withdrawRoute = source("app/api/gateway/withdraw/route.ts");

  assert.match(transferRoute, /const sourceSignerAddress = walletAddress;/);
  assert.match(transferRoute, /transferGatewayBalanceWithSCA\s*\(/);
  assert.match(transferRoute, /transferGatewayBurnIntentSetWithSCA\s*\(/);
  assert.match(transferRoute, /executeMintCircle\(\s*walletId,/s);
  assert.match(unifiedServer, /sourceSigner:\s*input\.sourceDepositor/);
  assert.match(withdrawRoute, /transferGatewayBalanceWithSCA\s*\(/);
  assert.match(withdrawRoute, /executeMintCircle\(\s*walletId,/s);
});

test("retired Gateway EOA endpoints are immutable 410 tombstones", () => {
  for (const file of [
    "app/api/gateway/delegate/route.ts",
    "app/api/gateway/eoa-wallets/route.ts",
    "app/api/gateway/init-eoa-wallets/route.ts",
  ]) {
    const contents = source(file);
    assert.match(contents, /status:\s*410/);
    assert.doesNotMatch(contents, /circleDeveloperSdk|createClient|from\(["']wallets["']\)/);
  }
});
