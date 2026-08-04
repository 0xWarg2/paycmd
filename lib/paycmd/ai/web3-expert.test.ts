import assert from "node:assert/strict";
import test from "node:test";

import { buildSafeSearchQuery, classifyKnowledgeRequest } from "./web3-expert.ts";

test("routes bilingual product and protocol questions to their authoritative families", () => {
  assert.deepEqual(classifyKnowledgeRequest("Hướng dẫn dùng Hey Payna để chuyển USDC").topics, ["payna"]);
  assert.deepEqual(classifyKnowledgeRequest("How does Circle CCTP burn and mint USDC?").topics, ["circle"]);
  assert.deepEqual(classifyKnowledgeRequest("RPC và chain ID của Arc testnet là gì?").topics, ["arc"]);
  assert.deepEqual(classifyKnowledgeRequest("Giải thích khác nhau giữa L1 và L2").topics, ["web3"]);
  assert.deepEqual(classifyKnowledgeRequest("Monad là gì?").topics, ["web3"]);
  assert.deepEqual(classifyKnowledgeRequest("So sánh Sui với Aptos").topics, ["web3"]);
});

test("selects Circle and Arc together only for a mixed question", () => {
  assert.deepEqual(classifyKnowledgeRequest("Circle Gateway hoạt động trên Arc thế nào?").topics, ["circle", "arc"]);
  assert.deepEqual(classifyKnowledgeRequest("Circle Wallets API").topics, ["circle"]);
  assert.deepEqual(classifyKnowledgeRequest("Deploy smart contract lên Arc").topics, ["arc"]);
});

test("marks current Web3 questions as live but bypasses unrelated conversation", () => {
  assert.deepEqual(classifyKnowledgeRequest("Tin mới nhất về Ethereum Pectra hôm nay").topics, ["web3", "live"]);
  assert.equal(classifyKnowledgeRequest("Viết giúp tôi một email xin nghỉ phép").requiresKnowledge, false);
});

test("blocks secret-bearing search and redacts public chain identifiers", () => {
  assert.deepEqual(buildSafeSearchQuery("seed phrase của tôi là abandon ability able about"), {
    query: "",
    blocked: true,
    redacted: false,
  });

  const address = "0x1111111111111111111111111111111111111111";
  const hash = `0x${"a".repeat(64)}`;
  const result = buildSafeSearchQuery(`Kiểm tra ví ${address} và giao dịch ${hash}`);

  assert.equal(result.blocked, false);
  assert.equal(result.redacted, true);
  assert.equal(result.query, "Kiểm tra ví [wallet-address] và giao dịch [transaction-hash]");
});

test("normalizes whitespace and caps external search queries at 400 characters", () => {
  const result = buildSafeSearchQuery(`  Ethereum   ${"rollup ".repeat(80)} `);

  assert.equal(result.blocked, false);
  assert.equal(result.query.length, 400);
  assert.equal(result.query.includes("  "), false);
});
