import assert from "node:assert/strict";
import test from "node:test";

import {
  applyModePolicy,
  normalizeIntentDecision,
  questionSignals,
  submissionRoute,
  type IntentDecision,
} from "./intent-policy.ts";

test("routes every AskPayna submission away from the command parser", () => {
  assert.equal(submissionRoute("asksurf", "/pay 50 USDC to Minh on arc from base"), "askpayna");
  assert.equal(submissionRoute("asksurf", "Gửi 50 USDC cho Minh"), "askpayna");
  assert.equal(submissionRoute("paycmd", "/pay 50 USDC to Minh on arc from base"), "payna_slash");
});

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

test("fails invalid router output closed even when the input is a question", () => {
  const decision = normalizeIntentDecision({}, "How do I send USDC?");

  assert.equal(decision.speechAct, "ambiguous");
  assert.equal(applyModePolicy("paycmd", decision), "clarify");
});

test("fails low-confidence actions closed even when the input is a question", () => {
  const decision = normalizeIntentDecision({ speechAct: "action", confidence: "low" }, "Làm sao gửi USDC?");

  assert.equal(decision.speechAct, "ambiguous");
  assert.equal(applyModePolicy("paycmd", decision), "clarify");
});

test("rejects action decisions with non-action reason codes", () => {
  for (const reasonCode of ["informational_question", "missing_action_commitment", "conflicting_signals"] as const) {
    const decision = normalizeIntentDecision(
      { speechAct: "action", confidence: "high", reasonCode },
      "Send 50 USDC to Minh",
    );

    assert.equal(decision.speechAct, "ambiguous");
    assert.equal(applyModePolicy("paycmd", decision), "clarify");
  }
});

test("does not authorize malformed action decisions passed directly to the policy", () => {
  const malformedAction = {
    speechAct: "action",
    confidence: "low",
    reasonCode: "informational_question",
  } as IntentDecision;

  assert.equal(applyModePolicy("paycmd", malformedAction), "clarify");
});

test("allows an explicit action only inside Payna", () => {
  const decision = normalizeIntentDecision(
    { speechAct: "action", confidence: "high", reasonCode: "explicit_imperative" },
    "Gửi 50 USDC cho Minh từ Base sang Arc",
  );

  assert.equal(applyModePolicy("paycmd", decision), "run_payna_action");
  assert.equal(applyModePolicy("asksurf", decision), "run_askpayna");
});
