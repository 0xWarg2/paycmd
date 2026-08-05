---
slug: "features/askpayna"
title: "AskPayna research"
description: "How AskPayna retrieves Circle, Arc, and Web3 sources before DeepSeek synthesis."
section: "features"
order: 40
lastUpdated: "2026-08-05"
keywords: ["AskPayna", "Circle MCP", "Arc MCP", "Tavily", "DeepSeek"]
tutorial: true
aiSummary:
  - "AskPayna uses the versioned tutorial for Payna guidance, Circle MCP for Circle, Arc MCP and arc.io for Arc, Tavily for broad or live Web3 data, and DeepSeek for evidence-grounded synthesis."
  - "Citations can only come from retrieval; source failures return partial or unavailable instead of invented URLs."
---

## When to use AskPayna

Use AskPayna for Web3, crypto, L1/L2, Circle, or Arc knowledge. Payment and wallet commands belong in Payna mode, where parsing, preview, and confirmation protect execution.

## Source routing

- Hey Payna usage: the bilingual tutorial matching the web-app version.
- Circle: Circle MCP and official Circle documentation.
- Arc: Arc MCP and blockchain documentation at [arc.io](https://www.arc.io/).
- Broad Web3 or time-sensitive data: Tavily search.
- DeepSeek: evidence synthesis, response structure, and related questions.

## Citation policy

DeepSeek may cite only HTTPS URLs returned by retrieval. If a source times out or lacks credentials, the answer reports `partial` or `unavailable`; AskPayna does not invent references. Queries containing seed phrases, private keys, or API keys are blocked before external retrieval.
