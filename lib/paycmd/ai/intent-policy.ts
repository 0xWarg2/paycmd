export type SpeechAct = "action" | "question" | "ambiguous";
export type ChatMode = "paycmd" | "asksurf";
export type IntentDecision = {
  speechAct: SpeechAct;
  confidence: "high" | "medium" | "low";
  reasonCode:
    | "explicit_imperative"
    | "explicit_slash_command"
    | "informational_question"
    | "missing_action_commitment"
    | "conflicting_signals";
};
export type ModePolicyAction = "run_payna_action" | "run_askpayna" | "offer_askpayna" | "clarify";

const QUESTION_SIGNAL = /(?:\?|\bhow\b|\bwhat\b|\bwhy\b|\bshould\b|\blàm sao\b|\blà gi\b|\blà gì\b|\bvì sao\b|\bcó nên\b|\bphí (?:là |bao nhiêu))/iu;

const REASON_CODES = new Set<IntentDecision["reasonCode"]>([
  "explicit_imperative",
  "explicit_slash_command",
  "informational_question",
  "missing_action_commitment",
  "conflicting_signals",
]);

export function questionSignals(input: string): boolean {
  return QUESTION_SIGNAL.test(input);
}

export function normalizeIntentDecision(raw: Partial<IntentDecision>, input: string): IntentDecision {
  if (questionSignals(input)) {
    return { speechAct: "question", confidence: "high", reasonCode: "informational_question" };
  }

  if (
    (raw.speechAct !== "action" && raw.speechAct !== "question" && raw.speechAct !== "ambiguous") ||
    raw.confidence === "low" ||
    (raw.confidence !== "high" && raw.confidence !== "medium") ||
    !REASON_CODES.has(raw.reasonCode ?? "conflicting_signals")
  ) {
    return { speechAct: "ambiguous", confidence: "low", reasonCode: "conflicting_signals" };
  }

  return {
    speechAct: raw.speechAct,
    confidence: raw.confidence,
    reasonCode: raw.reasonCode ?? "conflicting_signals",
  };
}

export function applyModePolicy(mode: ChatMode, decision: IntentDecision): ModePolicyAction {
  if (mode === "asksurf") return "run_askpayna";
  if (decision.speechAct === "action") return "run_payna_action";
  if (decision.speechAct === "question") return "offer_askpayna";
  return "clarify";
}
