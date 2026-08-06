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

const COMPATIBLE_REASON_CODES: Record<SpeechAct, readonly IntentDecision["reasonCode"][]> = {
  action: ["explicit_imperative", "explicit_slash_command"],
  question: ["informational_question"],
  ambiguous: ["missing_action_commitment", "conflicting_signals"],
};

export function questionSignals(input: string): boolean {
  return QUESTION_SIGNAL.test(input);
}

function isValidIntentDecision(decision: Partial<IntentDecision>): decision is IntentDecision {
  if (
    (decision.speechAct !== "action" && decision.speechAct !== "question" && decision.speechAct !== "ambiguous") ||
    (decision.confidence !== "high" && decision.confidence !== "medium") ||
    !REASON_CODES.has(decision.reasonCode ?? "conflicting_signals")
  ) {
    return false;
  }

  return COMPATIBLE_REASON_CODES[decision.speechAct].includes(decision.reasonCode);
}

export function normalizeIntentDecision(raw: Partial<IntentDecision>, input: string): IntentDecision {
  if (!isValidIntentDecision(raw)) {
    return { speechAct: "ambiguous", confidence: "low", reasonCode: "conflicting_signals" };
  }

  if (questionSignals(input)) {
    return { speechAct: "question", confidence: "high", reasonCode: "informational_question" };
  }

  return raw;
}

export function applyModePolicy(mode: ChatMode, decision: IntentDecision): ModePolicyAction {
  if (mode === "asksurf") return "run_askpayna";
  if (!isValidIntentDecision(decision)) return "clarify";
  if (decision.speechAct === "action") return "run_payna_action";
  if (decision.speechAct === "question") return "offer_askpayna";
  return "clarify";
}
