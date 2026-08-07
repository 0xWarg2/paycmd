import { z } from "zod";

export const aiCommandRequestSchema = z.object({
  input: z.string().optional(),
  recentMessages: z
    .array(
      z.object({
        role: z.string(),
        text: z.string(),
      }),
    )
    .optional(),
  chatMode: z.enum(["paycmd", "asksurf"]).default("paycmd"),
});

export const intentDecisionSchema = z.object({
  speechAct: z.enum(["action", "question", "ambiguous"]),
  confidence: z.enum(["high", "medium", "low"]),
  reasonCode: z.enum([
    "explicit_imperative",
    "explicit_slash_command",
    "informational_question",
    "missing_action_commitment",
    "conflicting_signals",
  ]),
});

export const aiCommandResponseSchema = z.object({
  intent: z.enum(["command", "answer", "clarify", "crypto_research"]),
  canonicalCommand: z.string().default(""),
  assistantText: z.string().default(""),
  missingFields: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  decision: intentDecisionSchema,
});

export type AiCommandRequest = z.infer<typeof aiCommandRequestSchema>;
export type AiCommandResponse = z.infer<typeof aiCommandResponseSchema>;

// There is deliberately no provider-side JSON schema here. DeepSeek rejects
// `response_format: {type: "json_schema"}` with a 400 ("This response_format type is unavailable
// now"), so the only structured-output mode available is `json_object` — which constrains the
// output to valid JSON but not to any particular shape. The zod schema above is therefore the only
// thing validating that shape, and the caller must handle it failing.
