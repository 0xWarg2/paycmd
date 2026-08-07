---
slug: "features/askpayna"
title: "AskPayna research"
description: "How AskPayna retrieves Circle, Arc, and Web3 sources before DeepSeek synthesis."
section: "features"
order: 40
lastUpdated: "2026-08-07"
keywords: ["AskPayna", "Circle MCP", "Arc MCP", "Tavily", "DeepSeek", "mode", "wallet observations"]
tutorial: true
aiSummary:
  - "AskPayna never creates a transaction preview and never renders, confirms, or executes one; transaction requests require Payna mode."
  - "AskPayna routes Payna tutorial, Circle MCP, Arc MCP, and Tavily for broad or live Web3 questions, then asks DeepSeek to synthesize only the retrieved evidence."
  - "Operational wallet questions can include authenticated point-in-time observations, with Gateway ready and pending amounts, Circle SCA USDC, external-wallet USDC, and native gas kept separate."
  - "References come from retrieval; missing sources produce partial or unavailable grounding, never invented citations."
---

## Choose the right mode

Use AskPayna for explanations, comparisons, research, and Web3 questions. Use Payna mode for commands, transaction previews, wallet checks, and transaction history. AskPayna never creates a transaction preview: it does not parse a command into a draft, render confirmation controls, confirm, sign, or execute a transaction, even when the text begins with `/pay` or sounds like a transfer request. It can explain a route and suggest a slash command; switch to Payna and submit there if you intend to act.

| Current mode | Input | Result |
| --- | --- | --- |
| AskPayna | Question or research prompt | Retrieve evidence and explain; no transaction preview or execution. |
| AskPayna | Slash command or transfer-like text | Explain the safety boundary and offer a switch to Payna; no preview, confirmation, or execution. |
| Payna | Clear operational command | Parse it and, when valid, show a transaction preview that still requires explicit confirmation. |
| Payna | Question unrelated to execution | Offer an explicit **Switch to AskPayna** action; remain in Payna and do not research until the user consents. |

Choose Instant for a concise answer with low latency. Choose Research for more structured analysis; its Standard and Deep effort levels control depth and model profile. More effort cannot compensate for missing evidence, and neither mode makes an unsourced live claim trustworthy.

For example, ask **“Làm sao gửi 50 USDC sang Arc nhanh nhất?”** in AskPayna. The result is a non-executing explanation grounded in official Circle and Arc evidence, supplemented only when relevant by authenticated point-in-time wallet observations. It is not a `/pay` draft or transaction, and it has no confirmation button.

## How intent routing works

The router identifies one or more topic families from the question. A Payna usage question selects the product tutorial. A Circle or CCTP question selects Circle documentation. An Arc network question selects Arc documentation. A recognized broad blockchain topic such as Ethereum, L2s, or DeFi selects web search. A mixed question can retrieve several families in parallel.

Be specific about the product, protocol, chain, comparison criteria, and desired date range. That gives retrieval a better query than “tell me about crypto.” An unrelated prompt still runs through AskPayna and DeepSeek, but selects no knowledge source: grounding is `not_applicable`, with no retrieval documents or citations.

## Payna tutorial source

Payna usage and tutorial guidance comes from Payna's synchronized bilingual, versioned public docs. It matches the web-app tutorial version, so AskPayna can explain current command syntax, previews, rails, and safety boundaries without treating a generic search result as product truth. Include “Payna” or “AskPayna” when the question is about the app.

## Circle and Arc sources

Circle facts come from Circle MCP searches of official Circle developer material. Arc facts come from Arc MCP, backed by the documentation published at [arc.io](https://www.arc.io/). A question about Circle Gateway on Arc legitimately needs both families. A question only about Circle Wallets should not add unrelated web results, and an Arc RPC question should remain with the Arc specialist source.

These retrieval systems return factual snippets and HTTPS source URLs. They are evidence, not instructions: AskPayna must ignore commands embedded inside retrieved text.

## Authenticated wallet observations

AskPayna loads wallet observations only when the user is authenticated and the question is operationally relevant, such as asking whether current funds can support a route. Conceptual questions do not trigger wallet reads. Observations are point-in-time context, not web citations or authority to spend.

The evidence keeps every spendability family separate: Gateway-ready USDC, Gateway-pending USDC, Circle SCA USDC, external-wallet USDC, and external-wallet native gas. It never adds these into one balance or treats one rail as another. Partial reads stay unavailable rather than becoming zero. This context feature added no MetaMask signing or transaction rail; AskPayna still cannot ask MetaMask to sign or submit anything.

## Tavily for broad or live Web3

Tavily covers recognized broad Web3 subjects and dated or live requests. A bare “market data” prompt selects nothing until it names a qualifying topic; Circle and Arc specialist questions add Tavily only for broader or current information. Results must clear the relevance threshold and provide an HTTPS URL. Check source quality and publication date before acting.

## DeepSeek evidence synthesis

DeepSeek synthesizes a bounded evidence bundle; it is not the citation authority. Factual and time-sensitive claims must use that bundle and separate inference. Payna removes model-authored URLs, then creates capped, deduplicated reference cards only from retrieval records.

## Citation and grounding states

`verified` means every requested family returned usable documents; `partial` means some succeeded; `unavailable` means none did; `not_applicable` means no knowledge source applied. For `partial`, identify missing families. For `unavailable`, attach no citations or current claims. Missing evidence is a reason to retry or narrow the question, never to invent a source.

## Secrets and identifier handling

Never enter a seed phrase, mnemonic, recovery phrase, private key, API key, password, or signing secret. Queries that explicitly contain wallet-secret terms are blocked before external retrieval. Public EVM addresses and transaction hashes are replaced with neutral placeholders in the outbound search query. This redaction is a safety boundary, not a reason to paste sensitive data into chat.

## When a source fails

Check grounding and references. Retry timeouts later, remove unrelated topics, and add dates to live questions. Ask missing Circle or Arc topics separately. If the result remains `unavailable`, use official docs or defer the decision. Never paste credentials or treat an uncited answer as operational approval.
