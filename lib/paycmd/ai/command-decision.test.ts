import assert from "node:assert/strict";
import test from "node:test";

import { parsePayCmd } from "../commands.ts";
import { guardParsedCommand } from "./intent-policy.ts";
import { aiCommandRequestSchema, aiCommandResponseSchema } from "./schema.ts";

test("suppresses a parsed command outside Payna action policy", () => {
  const parsed = parsePayCmd("/pay 50 USDC to Minh on arc from base");

  assert.equal(
    guardParsedCommand(
      "asksurf",
      { speechAct: "action", confidence: "high", reasonCode: "explicit_imperative" },
      parsed,
    ),
    null,
  );
  assert.equal(
    guardParsedCommand(
      "paycmd",
      { speechAct: "question", confidence: "high", reasonCode: "informational_question" },
      parsed,
    ),
    null,
  );
  assert.equal(
    guardParsedCommand(
      "paycmd",
      { speechAct: "action", confidence: "high", reasonCode: "explicit_imperative" },
      parsed,
    )?.command,
    "pay",
  );
});

test("accepts only supported chat modes while keeping paycmd request compatibility", () => {
  assert.equal(aiCommandRequestSchema.parse({ input: "send USDC" }).chatMode, "paycmd");
  assert.equal(aiCommandRequestSchema.safeParse({ input: "send USDC", chatMode: "paycmd" }).success, true);
  assert.equal(aiCommandRequestSchema.safeParse({ input: "send USDC", chatMode: "asksurf" }).success, true);
  assert.equal(aiCommandRequestSchema.safeParse({ input: "send USDC", chatMode: "unsafe" }).success, false);
});

test("requires a structured intent decision from the command router", () => {
  const validResponse = {
    intent: "command",
    canonicalCommand: "/balance",
    assistantText: "Check balance",
    missingFields: [],
    suggestions: [],
    decision: {
      speechAct: "action",
      confidence: "high",
      reasonCode: "explicit_imperative",
    },
  };

  assert.equal(aiCommandResponseSchema.safeParse(validResponse).success, true);
  assert.equal(aiCommandResponseSchema.safeParse({ ...validResponse, decision: undefined }).success, false);
  assert.equal(
    aiCommandResponseSchema.safeParse({
      ...validResponse,
      decision: { ...validResponse.decision, reasonCode: "invented_reason" },
    }).success,
    false,
  );
});
