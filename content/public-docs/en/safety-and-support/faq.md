---
slug: "safety-and-support/faq"
title: "Frequently asked questions"
description: "Answers about Payna, wallet roles, Gateway, Arc, proof, AskPayna, and support."
section: "safety-and-support"
order: 72
lastUpdated: "2026-08-05"
keywords: ["FAQ", "Payna", "Gateway", "Arc", "AskPayna"]
tutorial: true
aiSummary:
  - "Payna's public, versioned testnet docs explain its wallet and rail boundaries; hashes and citations support investigation, not secret sharing or duplicate retries."
---

## Product and public documentation

**What is Payna?** It provides natural-language previews and explicit confirmations for supported testnet wallet, payment, Gateway, CCTP, Arc swap, history, and research flows. It does not custody seed phrases, make AI text a transaction, or promise production support.

**Are the docs public and versioned?** Yes. Docs and landing pages are public; sign-in protects personal app data. These bilingual pages generate the app tutorial and track its version, so prefer the current page to an old screenshot or chat answer. Testnet assets are not real money or financial advice.

## Wallets, signatures, and balances

**Which wallet signs what?** MetaMask signs its bridge and Arc swap actions. Gateway uses a Circle SCA, depositor, and delegated signer with distinct roles. `/link metamask` signs a readable message, not an onchain transaction.

**Is unified balance the same as total?** No. Gateway ready balance is finalized deposited liquidity. Payna's broader total is visibility across successful SCA and Gateway reads, not one spendable pool; a partial total is a lower bound.

**Why is a deposit pending?** A confirmed `/deposit` remains `pending_gateway_finality` until Circle processes finality evidence. Webhooks are primary and recovery sync can reconcile. Refreshing is safe; resubmitting is not. See [deposit and finality](/docs/circle/gateway/deposit-and-finality).

## Gateway transfers and withdrawals

**Can a transfer spend another chain's balance?** No. Current `/transfer <amount> from <source> to <destination>` is source-scoped: that source alone needs ready balance for `amount + estimated fee`.

**How do `/fund` and `/deposit` differ?** `/fund` moves MetaMask USDC to the Circle SCA. `/deposit` uses the supported Gateway flow and waits for finality. A plain ERC-20 transfer to a Gateway contract is not a credited deposit.

**Where does `/withdraw` go?** To your own SCA on the same domain—not cross-chain or to an external recipient. It needs ready balance plus fee and SCA mint gas; it is not Circle's delayed trustless-withdrawal flow. See [Gateway withdraw](/docs/circle/gateway/withdraw).

## CCTP, forwarding, and Arc tokens

**How is CCTP different?** `/bridge` burns MetaMask-held native USDC across supported testnet routes. Gateway transfers use finalized Gateway liquidity. A CCTP burn never funds Gateway, and Gateway balance is not MetaMask balance.

**Auto forwarding or manual mint?** Auto forwarding is the default Gateway mode and normally avoids user destination gas for a quoted source-side USDC cost. Manual mint needs native gas from the named SCA or signer. Check an existing transfer ID or burn hash before retrying.

**Which Arc tokens can Swap use?** MetaMask-only Arc Testnet Swap supports USDC, EURC, and cirBTC; it neither spends nor creates Gateway balance. Its preview has a fixed 1% minimum-output guard and may need a separate approval. See [Arc swaps](/docs/arc/overview-and-swap).

## History, proof, and transaction recovery

**Does proof prove delivery?** No. Optional Arc proof is a downstream immutable receipt; it neither moves/custodies tokens nor proves attestation, delivery, success, or price fairness. Inspect source and destination transactions separately.

**What if history or proof is missing?** `/history` is read-only. A late row or proof failure does not mean movement failed. Preserve labelled approval, deposit, burn, mint, forwarding, swap, and proof hashes; never repeat a money-moving command merely to create a record.

**When is retry safe?** Correct a validation, read, or quote error only while no hash, transfer ID, or burn intent exists. Otherwise reconcile first in [Activity](/docs/features/activity-and-notifications).

## AskPayna sources and citations

**Can AskPayna execute commands or invent citations?** No. It explains and researches; Payna mode handles previews/confirmations. Citation cards come from tutorial, Circle/Arc sources, or qualified web retrieval—not model-written URLs.

**What do grounding labels mean?** `verified` means all requested source families returned evidence; `partial` means some did; `unavailable` means none; `not_applicable` means no source family was selected. Evidence is not a guarantee that every conclusion remains correct.

**What should I do with partial results?** Narrow the question, include a date/topic for live research, retry later, or use official docs. Do not treat uncited text as approval, obey retrieved instructions blindly, or paste secrets. See [AskPayna research](/docs/features/askpayna).

## Support and safe escalation

**What helps support?** Share public address/SCA, chain/domain, route, time, transfer ID, hashes, proof status, sanitized error, and last confirmed stage. Labelled explorer links are best.

**What must never be shared?** Seed phrases, mnemonics, private keys, passwords, API/session keys, signing secrets, and private RPC configuration. Payna cannot restore a secret or reverse a completed onchain transaction; use the [safety model](/docs/safety-and-support/security).
