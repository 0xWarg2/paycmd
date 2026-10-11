import assert from "node:assert/strict";
import test from "node:test";
import { encodeEventTopics, erc20Abi, parseUnits, toHex, type Transaction, type TransactionReceipt } from "viem";
import { arcPaymentData, arcPaymentReceiptOutcome, arcWalletNetworks, assertArcPaymentFunds, assertArcPaymentTransaction, parseArcWalletPayment, paymentOwnershipMessage, requireArcPaymentNetwork, type ArcWalletPayment } from "./arc-payment.ts";
import { parsePayCmd } from "./commands.ts";
import { legacyRailBlocked } from "./network-guard.ts";
import { assertArcWalletPaymentsEnabled } from "./arc-payment-server.ts";

const sender = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";
const hash = `0x${"ab".repeat(32)}` as const;
const payment: ArcWalletPayment = {
  id: "d8c88df6-b144-483a-9e9d-34c2cc268ea0", user_id: "user-1", network: "mainnet", chain_id: 5042,
  sender, recipient, amount: "0.000001", amount_units: "1", call_data: arcPaymentData(recipient, 1n),
  gas_limit: "30000", max_fee_per_gas: "20000000000", max_priority_fee_per_gas: "0", status: "submitted",
  tx_hash: hash, expires_at: "2026-10-12T10:00:00Z", created_at: "2026-10-12T09:58:00Z", error_message: null,
};
const tx = { from: sender, to: arcWalletNetworks.mainnet.usdcAddress, input: payment.call_data, value: 0n, chainId: 5042, hash } as Pick<Transaction, "from" | "to" | "input" | "value" | "chainId" | "hash">;
const receipt = {
  transactionHash: hash, status: "success", logs: [{
    address: arcWalletNetworks.mainnet.usdcAddress, data: toHex(1n, { size: 32 }),
    topics: encodeEventTopics({ abi: erc20Abi, eventName: "Transfer", args: { from: sender, to: recipient } }),
  }],
} as unknown as TransactionReceipt;

test("wallet parser reuses /pay and resolves an explicit mainnet without Gateway", () => {
  const parsed = parseArcWalletPayment(`/pay 0.000001 USDC to ${recipient} on arc-mainnet`, "mainnet");
  assert.equal(parsed.units, 1n);
  assert.equal(parsed.fields.sourceChain, "arcMainnet");
  assert.equal(parsed.fields.destinationChain, "arcMainnet");
  assert.equal(parsed.status, "draft_ready");
  assert.deepEqual(parsed.missingFields, []);
});

test("wallet parser rejects ambiguous amounts, addresses, networks and unsupported rails", () => {
  for (const raw of [
    `/pay 0 USDC to ${recipient}`, `/pay -1 USDC to ${recipient}`, `/pay 0.0000001 USDC to ${recipient}`,
    `/pay 1e6 USDC to ${recipient}`, `/pay 1 USDC to 0x123`, `/pay 1 EURC to ${recipient}`,
    `/pay 1 USDC to 0x${"0".repeat(40)}`, `/pay 1 USDC to ${recipient} from gateway`,
    `/pay 1 USDC to ${recipient} on base`, `/pay 1 USDC to ${recipient} on arc-testnet`,
    `/transfer 1 USDC to ${recipient}`, `/pay ${2n ** 256n} USDC to ${recipient}`,
  ]) assert.throws(() => parseArcWalletPayment(raw, "mainnet"), { name: "Error" }, raw);
  assert.throws(() => requireArcPaymentNetwork(undefined));
});

test("Arc gas shares the same balance but has 18 decimals, not ERC-20's 6", () => {
  const token = parseUnits("1", 6);
  const native = parseUnits("1", 18);
  assertArcPaymentFunds(parseUnits("0.9", 6), token, native, parseUnits("0.01", 18));
  assert.throws(() => assertArcPaymentFunds(token, token, native, 1n), /plus gas/);
  assert.throws(() => assertArcPaymentFunds(token + 1n, token, native, 0n), /Insufficient USDC/);
  assert.throws(() => assertArcPaymentFunds(1n, token, 1n, 0n), /plus gas/);
});

test("receipt success requires exact chain, transaction and USDC Transfer evidence", () => {
  assertArcPaymentTransaction(payment, tx);
  assert.equal(arcPaymentReceiptOutcome(payment, receipt), "success");
  assert.equal(arcPaymentReceiptOutcome(payment, { ...receipt, status: "reverted", logs: [] }), "failed");
  assert.throws(() => arcPaymentReceiptOutcome(payment, { ...receipt, logs: [] }), /no matching/);
  assert.throws(() => arcPaymentReceiptOutcome(payment, { ...receipt, transactionHash: `0x${"cd".repeat(32)}` }), /hash/);
  assert.throws(() => arcPaymentReceiptOutcome({ ...payment, amount_units: "2" }, receipt), /no matching/);
  assert.throws(() => arcPaymentReceiptOutcome({ ...payment, recipient: sender }, receipt), /no matching/);
  assert.throws(() => arcPaymentReceiptOutcome(payment, { ...receipt, logs: receipt.logs.map((log) => ({ ...log, address: recipient })) }), /no matching/);
  for (const patch of [{ chainId: 5042002 }, { from: recipient }, { to: recipient }, { input: "0x" }, { value: 1n }, { hash: `0x${"cd".repeat(32)}` }]) {
    assert.throws(() => assertArcPaymentTransaction(payment, { ...tx, ...patch } as Transaction), /does not match/);
  }
});

test("wallet ownership confirmation binds user, preview, chain, amount, recipient and fee", () => {
  const original = paymentOwnershipMessage(payment);
  for (const change of [{ user_id: "other-user" }, { network: "testnet", chain_id: 5042002 }, { amount_units: "2" }, { recipient: sender }, { gas_limit: "40000" }, { expires_at: "2026-10-12T11:00:00Z" }]) {
    assert.notEqual(paymentOwnershipMessage({ ...payment, ...change } as ArcWalletPayment), original);
  }
});

test("mainnet kill switch blocks new payments and legacy mainnet commands never become testnet drafts", () => {
  assert.throws(() => assertArcWalletPaymentsEnabled("mainnet", {} as NodeJS.ProcessEnv), /DISABLED/);
  assertArcWalletPaymentsEnabled("mainnet", { ARC_MAINNET_PAYMENTS_ENABLED: "true" } as NodeJS.ProcessEnv);
  assertArcWalletPaymentsEnabled("testnet", {} as NodeJS.ProcessEnv);
  for (const raw of [`/pay 1 USDC to ${recipient} on arc-mainnet from base`, "/swap 1 USDC to EURC on mainnet", "/bridge from base to arc-mainnet 1 USDC", "/schedule 1 on mainnet"]) {
    assert.equal(parsePayCmd(raw).status, "needs_input");
  }
  for (const path of ["/api/payments/pay", "/api/gateway/transfer", "/api/swap/quote", "/api/cctp/bridge/record", "/api/payroll/batches", "/api/schedules/1/run-demo", "/api/payment-drafts/1/confirm", "/api/user/fund", "/api/ai/command"]) {
    assert.equal(legacyRailBlocked(path, { body: { sourceChain: "arcMainnet" } }), true, path);
    assert.equal(legacyRailBlocked(path, { network: "mainnet" }), true, path);
    assert.equal(legacyRailBlocked(path, { body: { chainId: 5042 } }), true, path);
    assert.equal(legacyRailBlocked(path, { body: { sourceChain: "arcTestnet" } }), false, path);
  }
  assert.equal(legacyRailBlocked("/api/arc-payments", { network: "mainnet" }), false);
});
