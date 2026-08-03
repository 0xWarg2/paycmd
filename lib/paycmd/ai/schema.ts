import { z } from "zod";

export const aiCommandResponseSchema = z.object({
  intent: z.enum(["command", "answer", "clarify", "crypto_research"]),
  canonicalCommand: z.string().default(""),
  assistantText: z.string().default(""),
  missingFields: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});

export type AiCommandResponse = z.infer<typeof aiCommandResponseSchema>;

// There is deliberately no provider-side JSON schema here. DeepSeek rejects
// `response_format: {type: "json_schema"}` with a 400 ("This response_format type is unavailable
// now"), so the only structured-output mode available is `json_object` — which constrains the
// output to valid JSON but not to any particular shape. The zod schema above is therefore the only
// thing validating that shape, and the caller must handle it failing.
