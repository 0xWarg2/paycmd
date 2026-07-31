# Legacy AskSurf API flow

AskSurf is intentionally inactive while Payna uses OpenRouter. This note preserves the prior integration contract so it can be restored after the AskSurf subscription/API key is renewed.

## Environment

```dotenv
SURF_API_KEY=your-asksurf-api-key
SURF_API_BASE_URL=https://api.asksurf.ai/gateway/v1
SURF_COMMAND_ROUTER_MODEL=surf-1.5-instant
SURF_TIMEOUT_MS=600000
```

## Research request

`POST ${SURF_API_BASE_URL}/chat/completions`

Headers:

```http
Authorization: Bearer ${SURF_API_KEY}
Content-Type: application/json
```

Model mapping:

| UI option | Model | `reasoning_effort` |
| --- | --- | --- |
| Instant | `surf-1.5-instant` | `low` |
| Research / Standard | `surf-1.5` | `medium` |
| Research / Extended | `surf-1.5` | `high` |
| Research / Maximum | `surf-1.5-thinking` | `high` |

Payload fields retained from the old flow:

```json
{
  "stream": false,
  "ability": ["search", "evm_onchain", "solana_onchain", "market_analysis", "calculate"],
  "citation": ["source", "chart"]
}
```

## Restore steps

1. Add the `SURF_*` values to `.env.local` and deploy environment variables.
2. Replace the `askOpenRouter(...)` call in `lib/paycmd/ai/surf.ts` with an AskSurf Chat Completions call using the request contract above.
3. Keep `app/api/ai/crypto/route.ts` unchanged; it already delegates to `askSurfResearch()`.
4. Optionally restore the AskSurf command-router fallback in `app/api/ai/command/route.ts`; this is separate from research and is not required for the AskSurf UI mode.
