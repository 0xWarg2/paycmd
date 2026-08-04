# AskPayna Web3 Knowledge Orchestration Design

**Date:** 2026-08-04
**Product version:** 1.0.0
**Status:** Approved

## Goal

Turn AskPayna into a grounded Web3 expert without relying on Surf. DeepSeek remains the answer generator, while local Payna tutorial content, Circle MCP, Arc MCP, and Tavily supply verifiable knowledge.

## Decisions

- The feature is an AskPayna server-runtime capability, not a Codex skill.
- Payna tutorial content is authoritative for product usage.
- Circle MCP is authoritative for Circle products such as USDC, CCTP, Gateway, Wallets, Contracts, and Mint.
- Arc MCP is authoritative for the Arc chain, including architecture, RPC, network settings, and deployment.
- Tavily covers broader Web3 topics and time-sensitive questions.
- DeepSeek may synthesize retrieved content but may not invent citation URLs.
- The leaked Tavily key from chat must never be stored or used. Deployment requires a newly rotated `TAVILY_API_KEY`.

## Architecture

The research request enters a deterministic topic router. It can select more than one source for mixed questions. The knowledge orchestrator calls selected sources in parallel, normalizes their results into `GroundedDocument` values, caps the context, and passes an explicitly untrusted source block to DeepSeek.

```text
AskPayna request
  -> Web3 topic router
  -> Payna tutorial | Circle MCP | Arc MCP | Tavily Search
  -> Knowledge orchestrator
  -> DeepSeek synthesis
  -> answer + exact retrieval citations + grounding status
```

## Topic routing

`classifyKnowledgeRequest(input)` returns a set containing any of:

- `payna`: Hey Payna usage, commands, funding, transfers, swaps, receipts, and onboarding.
- `circle`: Circle products and APIs.
- `arc`: Arc blockchain and chain-specific development.
- `web3`: L1/L2, EVM, consensus, rollups, bridges, protocols, tokens, DeFi, and crypto concepts.
- `live`: newest/current/news/price/date-sensitive requests.

Circle and Arc are not always called together. A mixed request such as “Circle Gateway on Arc” selects both. A general Circle CCTP question selects Circle only. A general Arc RPC question selects Arc only.

## Retrieval policies

### Payna tutorial

`content/payna-tutorial.json` is the canonical, bilingual tutorial. It starts at version `1.0.0`. `/docs`, research retrieval, and future onboarding changes must consume this file instead of duplicating user instructions.

### Circle and Arc MCP

Remote MCP uses Streamable HTTP with the official endpoints:

- Circle: `https://api.circle.com/v1/codegen/mcp`
- Arc: `https://docs.arc.io/mcp`

The client discovers tools and invokes the server's documentation search tool. The application does not call mutation or feedback tools. Each MCP call has an 8-second budget and returns at most 4 normalized documents.

### Tavily

Tavily Search uses server-only `TAVILY_API_KEY`, `search_depth: "basic"`, `max_results: 5`, `include_answer: false`, and `include_raw_content: false`. One focused query is the default. Complex comparisons or current-news questions may use at most two queries. Current/news questions set the news topic and a time range.

Results are accepted only when they have an HTTPS URL, useful content, and sufficient relevance. Official project documentation is ranked above data providers, research/news, and unknown sites. The first release does not use Tavily Extract.

## Privacy and security

- API keys remain server-only and are never logged.
- Seed phrases, private keys, and obvious credentials cause external retrieval to be skipped.
- Wallet addresses and transaction hashes are redacted from external search queries in v1.
- Retrieved text is wrapped as untrusted data. Instructions found inside sources must be ignored.
- Only HTTPS citations from retrieval adapters are returned. Model-authored links are stripped.
- Context is limited to 12,000 characters and 8 citations.

## Failure behavior

Source failures are isolated. If one selected source succeeds, DeepSeek answers from that source and the result is `partial`. If no selected source succeeds, DeepSeek may provide stable background knowledge while clearly saying online verification is unavailable. Missing Tavily configuration does not break Payna tutorial or MCP retrieval.

Grounding status values are:

- `verified`: every selected retrieval family returned usable documents.
- `partial`: at least one selected family succeeded and at least one failed.
- `unavailable`: retrieval was needed but returned no usable documents.
- `not_applicable`: no external or local retrieval was needed.

## Response contract

Research responses keep legacy `provider: "asksurf"` and `surfMode` metadata so existing chat history and the rich renderer remain compatible. They add:

```ts
type KnowledgeSource = "payna" | "circle" | "arc" | "web";

type ResearchCitation = {
  title?: string;
  url?: string;
  source?: KnowledgeSource;
  publishedAt?: string;
};

type GroundingStatus = "verified" | "partial" | "unavailable" | "not_applicable";
```

The UI displays source-family badges and a grounding label. Existing persisted messages without these fields continue rendering normally.

## Versioning

- `package.json` and `content/payna-tutorial.json` start at `1.0.0`.
- Release Git tags use `v<version>`.
- A release validation script checks package/tutorial parity and validates the tutorial schema.
- Product behavior changes must update the tutorial content or explicitly keep the same version when the user-facing workflow is unchanged.
- Only the product owner decides when a milestone warrants a minor or major version jump.

## Tests and acceptance

Unit tests cover bilingual routing, mixed Circle/Arc selection, privacy redaction, Tavily request/response handling, MCP normalization, orchestration failure states, citation provenance, and tutorial version parity. Full verification runs unit tests, ESLint, and the Next.js production build.

Acceptance examples:

- “Circle Gateway trên Arc hoạt động thế nào?” uses Circle and Arc.
- “RPC của Arc testnet là gì?” uses Arc only.
- “CCTP chuyển USDC thế nào?” uses Circle only.
- “So sánh Ethereum với Solana hiện nay” uses Tavily.
- “Dùng Hey Payna để chuyển USDC thế nào?” uses the local tutorial.
- A non-Web3 conversational question does not trigger Tavily.

## Out of scope for 1.0.0

- Tavily Extract and Crawl.
- Personalized financial advice or automated trading.
- Public-wallet or transaction-hash investigation through Tavily.
- Persistent retrieval cache or vector database.
- Automatic Git tagging or production deployment without a newly rotated Tavily key.
