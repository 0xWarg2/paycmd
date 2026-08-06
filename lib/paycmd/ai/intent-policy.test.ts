import assert from "node:assert/strict";
import test from "node:test";

import { applyModePolicy, normalizeIntentDecision, questionSignals } from "./intent-policy.ts";

test("keeps Vietnamese transfer questions non-transactional in AskPayna", () => {
  const decision = normalizeIntentDecision(
    { speechAct: "action", confidence: "high", reasonCode: "explicit_imperative" },
    "Làm sao gửi 50 USDC sang Arc nhanh nhất?",
  );

  assert.equal(decision.speechAct, "question");
  assert.equal(applyModePolicy("asksurf", decision), "run_askpayna");
});

test("detects Unicode-safe bilingual question signals", () => {
  assert.equal(questionSignals("Phí chuyển USDC là bao nhiêu?"), true);
  assert.equal(questionSignals("What is Circle Gateway?"), true);
  assert.equal(questionSignals("Gửi 50 USDC cho Minh"), false);
});

test("offers AskPayna instead of researching automatically from Payna", () => {
  const decision = normalizeIntentDecision(
    { speechAct: "question", confidence: "high", reasonCode: "informational_question" },
    "Circle Gateway là gì?",
  );

  assert.equal(applyModePolicy("paycmd", decision), "offer_askpayna");
});

test("never grants an action to low-confidence or invalid output", () => {
  assert.equal(normalizeIntentDecision({ speechAct: "action", confidence: "low" }, "send money").speechAct, "ambiguous");
  assert.equal(normalizeIntentDecision({}, "send money").speechAct, "ambiguous");
});

test("allows an explicit action only inside Payna", () => {
  const decision = normalizeIntentDecision(
    { speechAct: "action", confidence: "high", reasonCode: "explicit_imperative" },
    "Gửi 50 USDC cho Minh từ Base sang Arc",
  );

  assert.equal(applyModePolicy("paycmd", decision), "run_payna_action");
  assert.equal(applyModePolicy("asksurf", decision), "run_askpayna");
});
