---
slug: "arc/onchain-proof"
title: "Payna onchain proof"
description: "An Arc receipt event that links commands and transactions without holding funds."
section: "arc"
order: 51
lastUpdated: "2026-08-05"
keywords: ["Arc", "proof", "receipt", "contract", "ArcScan"]
tutorial: true
aiSummary:
  - "Payna's Arc proof contract only emits a receipt linking a command, amount, and transaction hashes; it neither holds nor moves funds."
---

## Purpose and lifecycle

Payna onchain proof is an optional application receipt on **Arc Testnet**. After an eligible `bridge`, Gateway `transfer`, `pay`, or Arc `swap`, the backend may ask an authorized relayer to call `recordReceipt`. Users do not sign it; the proof is downstream of money movement and is not required by Circle Gateway, CCTP, or the swap adapter.

Proof writing is configuration-gated. If receipts are disabled, the registry address is unavailable, or relayer credentials are invalid, Payna marks the proof `skipped` or `failed` while preserving the transaction record. A successful source action remains successful even when its later proof does not exist.

## Receipt event payload

`ReceiptRecorded` emits a hashed command ID, numeric action type (`1` bridge, `2` transfer, `3` pay, `4` swap in V2), user address, recipient address, atomic amount, source and destination EVM chain IDs, source and destination transaction hashes, and a metadata hash. Addresses or transaction hashes that are missing or invalid at recording time become zero values rather than invented data.

The command ID is hashed from an explicit identifier or stable action/route fields. The metadata hash commits to canonical JSON containing Payna app/version and action-specific details such as history ID, transfer ID, modes, labels, or swap route. The event stores the hash, not the metadata object.

## What the proof establishes

A mined proof establishes that an authorized recorder submitted this exact receipt payload to the configured registry at a specific Arc block. Anyone can independently compare its event fields with the hashes, addresses, chain IDs, amount, and metadata supplied by Payna. Because the contract only emits an immutable event, it provides a public timestamped linkage among the Payna action, source transaction, destination or mint transaction, and receipt metadata commitment.

For a swap, both hashes normally point to the same Arc transaction. For CCTP, they can represent source burn and destination mint. For Gateway transfer/pay, source may be auto-deposit while destination identifies mint or forwarding. A zero hash only means that side was not supplied.

## What it does not establish

The registry never holds, approves, burns, mints, swaps, or transfers tokens. It does not verify Circle attestation, Gateway ready balance, recipient delivery, AMM price fairness, command wording, contact identity, or the truth of offchain metadata. It also does not prove that a source or destination transaction succeeded merely because its hash was included. Verify each business transaction on its own chain.

Relayer authorization proves who may write, not that every statement is automatically correct. The owner manages recorder permissions; the current contract rejects unauthorized recorders and invalid action types. The trust boundary therefore includes Payna's backend construction of the payload and the authorized relayer's key management.

## Verify on ArcScan

When present, open the “Payna proof” ArcScan transaction link from the chat receipt. Activity currently renders transaction hashes but not proof fields, and Payna does not display `proofContractAddress`. On ArcScan, confirm the proof transaction succeeded, identify its called contract, and inspect the `ReceiptRecorded` log. Compare action type, atomic amount, chain IDs, participant addresses, and source/destination hashes with the original receipt. Swap precision follows the input token; other actions default to six-decimal USDC unless an explicit atomic amount was supplied.

Next, open source and destination explorer links separately. Proof, source, and mint hashes answer different questions. Use [Activity and notifications](/docs/features/activity-and-notifications) to reconcile the underlying transaction, not to find proof fields; see [Arc Swap](/docs/arc/overview-and-swap) for swap receipts. If chat has no proof link, do not infer failure from Activity alone.

## Failure and retry boundaries

If `proof_status` is `skipped`, the feature or required configuration was unavailable; no user action can replace the relayer. If it is `failed`, preserve the payment/transfer/bridge/swap hashes and report the proof error. A proof RPC timeout or relayer gas issue may be retried by operators because `recordReceipt` does not move user funds, but users should not rerun the business command.

If money moved but history writing failed, reconcile source and destination first. A missing Payna row is not evidence of failure. Escalate with public hashes, route, time, and proof status—never secrets or authentication tokens.

## Privacy and support

Onchain event fields are public and durable. User/recipient addresses, amounts, chain IDs, action type, and supplied transaction hashes can be correlated. Hashing command ID and metadata hides their plaintext but does not provide perfect secrecy: someone who already knows a candidate value may reproduce and compare its hash. Do not place sensitive payroll notes, personal data, credentials, or secrets in command metadata.

For support, state whether the problem is with the source transaction, destination/mint transaction, history record, or Arc proof. Include only public explorer URLs and sanitized context. The proof is a useful audit pointer, not a custody guarantee or replacement for chain-specific finality.
