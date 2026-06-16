import { z } from "zod";

export const aiCommandResponseSchema = z.object({
  intent: z.enum(["command", "answer", "clarify", "crypto_research"]),
  canonicalCommand: z.string().default(""),
  assistantText: z.string().default(""),
  missingFields: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});

export type AiCommandResponse = z.infer<typeof aiCommandResponseSchema>;

export const aiCommandJsonSchema = {
  name: "paycmd_ai_command_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      intent: {
        type: "string",
        enum: ["command", "answer", "clarify", "crypto_research"],
      },
      canonicalCommand: {
        type: "string",
      },
      assistantText: {
        type: "string",
      },
      missingFields: {
        type: "array",
        items: { type: "string" },
      },
      suggestions: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["intent", "canonicalCommand", "assistantText", "missingFields", "suggestions"],
  },
} as const;
