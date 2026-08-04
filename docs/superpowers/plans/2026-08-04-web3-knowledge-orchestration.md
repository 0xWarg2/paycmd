# AskPayna Web3 Knowledge Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ground AskPayna answers with the versioned Payna tutorial, official Circle/Arc MCP documentation, and Tavily Web3 search before DeepSeek synthesis.

**Architecture:** A deterministic bilingual router selects source families. Focused adapters normalize local, MCP, and Tavily content into `GroundedDocument`; an orchestrator applies privacy, timeouts, limits, and failure isolation; the existing research layer sends only normalized untrusted evidence to DeepSeek and returns exact adapter citations.

**Tech Stack:** Next.js 16, TypeScript 5.9, Node test runner, Zod 4, `@modelcontextprotocol/client` 2.0, Tavily Search API, DeepSeek Chat Completions.

## Global Constraints

- Keep legacy wire values `provider: "asksurf"` and `surfMode` for persisted history compatibility.
- Never use or store the Tavily key pasted into chat; runtime reads only a newly rotated server-side `TAVILY_API_KEY`.
- Tutorial and package version start at exactly `1.0.0`.
- Circle endpoint is `https://api.circle.com/v1/codegen/mcp`; Arc endpoint is `https://docs.arc.io/mcp`.
- Tavily v1 uses `search_depth: "basic"`, at most 5 raw results, no generated Tavily answer, and no raw-content extraction.
- External retrieval receives neither secrets nor raw wallet addresses/transaction hashes.
- DeepSeek cannot create citation URLs.

---

## File map

- Create `lib/paycmd/ai/knowledge-types.ts`: shared topic, document, citation, and status contracts.
- Create `lib/paycmd/ai/web3-expert.ts`: bilingual deterministic routing and privacy-safe search query creation.
- Create `lib/paycmd/ai/tavily.ts`: Tavily HTTP adapter and response normalization.
- Create `lib/paycmd/ai/mcp-docs.ts`: Circle/Arc Streamable HTTP client and tool-result normalization.
- Create `lib/paycmd/ai/knowledge-orchestrator.ts`: parallel selection, failure isolation, context/citation limits.
- Create `content/payna-tutorial.json`: versioned bilingual product tutorial.
- Create `lib/paycmd/ai/payna-tutorial.ts`: validated tutorial loading and retrieval.
- Modify `lib/paycmd/ai/research.ts`: replace static citations with grounded evidence and DeepSeek synthesis.
- Modify `components/paycmd-app.tsx`: persist and render grounding/source metadata.
- Create `scripts/validate-tutorial-version.mjs`: validate schema and package/tutorial version parity.
- Modify `package.json`, `.env.example`, `.github/workflows/ci.yml`, and deployment docs.

### Task 1: Routing and privacy boundary

**Files:**
- Create: `lib/paycmd/ai/knowledge-types.ts`
- Create: `lib/paycmd/ai/web3-expert.ts`
- Test: `lib/paycmd/ai/web3-expert.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `classifyKnowledgeRequest(input: string): KnowledgeRoute`
- Produces: `buildSafeSearchQuery(input: string): { query: string; blocked: boolean; redacted: boolean }`

- [ ] Write tests proving Vietnamese/English Payna, Circle, Arc, Web3, live, and mixed Circle+Arc routing; secret blocking; address/hash redaction; and non-Web3 bypass.
- [ ] Run `node --test lib/paycmd/ai/web3-expert.test.ts` and confirm imports/functions are missing.
- [ ] Implement exact topic word sets, multi-topic selection, a 400-character query cap, secret-pattern blocking, and address/hash replacement.
- [ ] Re-run the focused test and confirm it passes.
- [ ] Change `npm test` to include `lib/paycmd/**/*.test.ts` and run it once.

### Task 2: Tavily retrieval adapter

**Files:**
- Create: `lib/paycmd/ai/tavily.ts`
- Test: `lib/paycmd/ai/tavily.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `KnowledgeRoute` and `buildSafeSearchQuery`
- Produces: `searchTavily(input: string, route: KnowledgeRoute, options?: { fetchImpl?: typeof fetch }): Promise<SourceRetrieval>`

- [ ] Write tests that inspect the actual request body, including `basic`, 5 results, no Tavily answer/raw content, `news` for live questions, Bearer auth, relevance filtering, missing-key degradation, 401/429 handling, and unsafe-query bypass.
- [ ] Run the focused test and confirm failure because the adapter is absent.
- [ ] Implement one request with an 8-second timeout, normalize only HTTPS results with useful content and score at least 0.45, then cap to 4 documents.
- [ ] Re-run the focused test and all AI unit tests.

### Task 3: Official Circle and Arc MCP adapters

**Files:**
- Create: `lib/paycmd/ai/mcp-docs.ts`
- Test: `lib/paycmd/ai/mcp-docs.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `searchCircleDocs(query: string, deps?: McpDependencies): Promise<SourceRetrieval>`
- Produces: `searchArcDocs(query: string, deps?: McpDependencies): Promise<SourceRetrieval>`
- Internal dependency injection: `callTool(server: "circle" | "arc", preferredNames: string[], args: Record<string, unknown>)`

- [ ] Install exact dependency `@modelcontextprotocol/client@2.0.0`.
- [ ] Write tests using an injected tool caller to verify Circle and Arc select documentation-search tools, convert MCP text/resource blocks, reject non-HTTPS citations, cap results, and return an unavailable result on timeout or tool errors.
- [ ] Run the focused test and confirm failure because the MCP adapter is absent.
- [ ] Implement Streamable HTTP clients that list tools, select only approved search/read names, call the tool, and close the client in `finally`; do not expose feedback or mutation tools.
- [ ] Re-run focused and aggregate tests.

### Task 4: Versioned Payna tutorial

**Files:**
- Create: `content/payna-tutorial.json`
- Create: `lib/paycmd/ai/payna-tutorial.ts`
- Test: `lib/paycmd/ai/payna-tutorial.test.ts`
- Create: `scripts/validate-tutorial-version.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `searchPaynaTutorial(query: string, locale: "vi" | "en"): SourceRetrieval`
- Produces CLI command: `npm run tutorial:validate`

- [ ] Write tests proving schema validity, version `1.0.0`, bilingual retrieval, command retrieval, and package/tutorial version parity.
- [ ] Run focused tests and the validation script; confirm failure while files/version are missing.
- [ ] Add a focused tutorial containing overview, setup/funding, core commands, AskPayna research behavior, Circle/Arc source policy, safety, and version metadata.
- [ ] Implement token-overlap section ranking with at most 4 tutorial documents.
- [ ] Add the validation command to CI, then re-run tests and validation.

### Task 5: Knowledge orchestration

**Files:**
- Create: `lib/paycmd/ai/knowledge-orchestrator.ts`
- Test: `lib/paycmd/ai/knowledge-orchestrator.test.ts`

**Interfaces:**
- Produces: `gatherKnowledge(options: GatherKnowledgeOptions, deps?: KnowledgeDependencies): Promise<KnowledgeBundle>`
- Produces: `formatKnowledgeContext(bundle: KnowledgeBundle): string`

- [ ] Write tests proving selected sources run in parallel, mixed Circle+Arc routing, Tavily is skipped for non-Web3 questions, privacy blocking, `verified`/`partial`/`unavailable`/`not_applicable`, deduplicated exact citations, 8-citation limit, and 12,000-character context limit.
- [ ] Run the focused test and confirm failure because orchestration is absent.
- [ ] Implement source selection with `Promise.allSettled`, normalized errors, stable ordering, citation deduplication, and explicitly delimited untrusted evidence blocks.
- [ ] Re-run focused and aggregate tests.

### Task 6: DeepSeek research integration and UI metadata

**Files:**
- Modify: `lib/paycmd/ai/research.ts`
- Test: `lib/paycmd/ai/research.test.ts`
- Modify: `components/paycmd-app.tsx`

**Interfaces:**
- `askResearch` returns existing fields plus `groundingStatus` and `knowledgeSources`.
- `ChatCitation` adds optional `source` and `publishedAt`.

- [ ] Write tests with injected DeepSeek/orchestrator dependencies proving the prompt contains untrusted evidence, live-data date, source-only citations, no static fallback links, and explicit unavailable wording.
- [ ] Run the focused test and confirm current static-citation behavior fails the new assertions.
- [ ] Refactor `askResearch` to gather knowledge before DeepSeek and forbid generated links while keeping the existing Markdown renderer contract.
- [ ] Extend client result/message metadata parsing and persistence, then render source-family badges and grounding status without changing legacy provider values.
- [ ] Re-run unit tests and `npm run lint`.

### Task 7: Documentation, security, and release verification

**Files:**
- Modify: `docs/05-moi-truong-va-trien-khai.md`
- Modify: `docs/08-paycmd-v1-tinh-nang-va-test-plan.md`
- Modify: `app/docs/page.tsx` only if it can consume the canonical tutorial without losing current layout; otherwise document that UI migration as a separate versioned follow-up.

**Interfaces:**
- Documents `TAVILY_API_KEY`, MCP endpoints, source routing, fallback behavior, and key rotation.

- [ ] Update environment/deployment documentation and remove Surf from the active runtime instructions.
- [ ] Run `npm test` and confirm zero failures.
- [ ] Run `npm run tutorial:validate` and confirm version `1.0.0` matches.
- [ ] Run `npm run lint` and confirm zero errors.
- [ ] Run `npm run build` and confirm exit code 0.
- [ ] Inspect `git diff --check`, `git status --short`, and changed files for secrets; confirm `.claude/` and unrelated user files are untouched.
- [ ] Do not configure Vercel or redeploy until the user supplies a newly rotated Tavily key through a secure channel or confirms it is already present in Vercel.
