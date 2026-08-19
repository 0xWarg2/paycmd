---
slug: "safety-and-support/troubleshooting"
title: "Troubleshooting"
description: "Diagnose wallet, balance, finality, quote, and research issues without repeating a live transaction."
section: "safety-and-support"
order: 71
lastUpdated: "2026-08-05"
keywords: ["troubleshooting", "gas", "pending", "MetaMask", "Gateway"]
tutorial: true
aiSummary:
  - "Match the symptom to its last confirmed stage, correct only pre-submission errors, and reconcile any existing hash or transfer ID before retrying."
---

## MetaMask unavailable or wrong chain

**Diagnosis:** MetaMask is unavailable or shows another account/network. A `/link metamask` mismatch means a different account signed `personal_sign`; linking has no gas transaction.

**Safe action:** Unlock/reconnect, finish or cancel the request, select the testnet/account, then preview again. Review network name, chain ID, and RPC.

**Do not repeat:** Do not approve unfamiliar prompts or sign another account. Payna confirmation is not MetaMask signature. See [wallet roles](/docs/getting-started/account-and-wallets).

## Login, link, or SCA balance mismatch

**Diagnosis:** Signed-in user, linked MetaMask, Circle SCA, Gateway depositor, and signer can differ. Missing SCA USDC may be MetaMask; partial total is a lower bound.

**Safe action:** Re-authenticate, verify the link, and check the named SCA/depositor and chain. Classify USDC as MetaMask, SCA, pending Gateway, or ready Gateway.

**Do not repeat:** Do not query only the signer, treat a partial response as empty, or send secrets to relink.

## `/fund` versus Gateway balance

**Diagnosis:** `/fund` moves MetaMask USDC only to Circle SCA. `/deposit` uses SCA allowance/Gateway call; confirmed deposits remain `pending_gateway_finality` until Circle finality makes them ready.

**Safe action:** Confirm SCA balance, submit one `/deposit` only if absent, retain its hash, then wait for webhook/recovery. Query the same depositor/domain.

**Do not repeat:** Do not plain-transfer USDC to a Gateway contract or submit a duplicate pending deposit. See [deposit and finality](/docs/circle/gateway/deposit-and-finality).

## Quote, fee, or source amount error

**Diagnosis:** A failed `/transfer` estimate is read-only. Payna is source-scoped: explicit `from` needs `amount + estimated fee` despite a larger visible total.

**Safe action:** Retry an unavailable estimate later, reduce the amount, or wait for/deposit finalized USDC on that exact source. Re-quote after changing route, recipient, amount, or mint mode.

**Do not repeat:** Do not assume fees are fixed, reuse a quote, or borrow Base's shortfall from Arc. If a transfer ID, burn, or forwarding request exists, reconcile it instead.

## Source gas, destination gas, or payment ambiguity

**Diagnosis:** Source native gas pays unsponsored Gateway approval/deposit; the USDC fee is separate. Manual mint needs named SCA gas when Gas Station does not sponsor it; auto forwarding normally avoids destination gas. Ambiguous rail, chain, source, or recipient blocks payment.

**Safe action:** Fund only the public address and chain named by the error. Clarify the payment details and reopen its preview; use `/gas check <chain>` as a read aid.

**Do not repeat:** Do not fund a depositor contract, call Gateway gas MetaMask gas, or confirm an ambiguous payment. See [fees and forwarding](/docs/circle/gateway/fees-gas-and-forwarding).

## CCTP delay or missing mint

**Diagnosis:** A CCTP source burn can succeed while attestation/destination mint is pending. Manual self-mint needs destination MetaMask gas and a signature; CCTP uses MetaMask USDC, never SCA/Gateway balance.

**Safe action:** Preserve burn hash, route, speed, and mint hash. Check source burn, query the existing attestation, then wait for or recover the destination mint on its explorer.

**Do not repeat:** Do not burn again for `pending_mint`, a timeout, missing history, or missing proof. Use the [CCTP guide](/docs/circle/cctp-bridge).

## Arc swap slippage or pending receipt

**Diagnosis:** Arc Swap is MetaMask-only on Arc Testnet. Liquidity, input, approval, fresh reserves, or its fixed 1% minimum-output guard can stop execution. A swap hash with an uncertain receipt is pending, not proven failed.

**Safe action:** Refresh preflight/quote errors and preview again. With an approval or swap hash, inspect ArcScan and allowance first; fund the exact MetaMask account with input token and Arc gas if required.

**Do not repeat:** Do not duplicate an approval, change slippage outside the rule, or retry a hashed swap because history is late. See [Arc swaps](/docs/arc/overview-and-swap).

## Missing history, proof, or AskPayna sources

**Diagnosis:** `/history` is read-only and Arc proof is a downstream receipt, so either can be late after an action moved funds. AskPayna `partial` has some evidence, `unavailable` none, and `not_applicable` no selected source family.

**Safe action:** Clear filters, label hashes by chain/stage, and check each correct explorer. Narrow a research question, retry later, or use official docs and reference cards.

**Do not repeat:** Do not rerun business commands for a missing record, call uncited text verified, or share credentials to repair retrieval. See [AskPayna](/docs/features/askpayna) and [proof](/docs/arc/onchain-proof).

## Escalate with public evidence

**Diagnosis:** Escalation is for an unresolved existing state, not a way to bypass finality.

**Safe action:** Share public address/SCA, chain or domain, route, time, transfer ID, hashes, proof status, sanitized error, and the last confirmed stage.

**Do not repeat:** Never share a seed phrase, private key, password, API/session key, signing secret, or private RPC detail; do not submit another money-moving command while the original remains unresolved.
