---
slug: "circle/cctp-bridge"
title: "CCTP v2 bridge with MetaMask"
description: "Bridge USDC through a MetaMask-signed source burn and destination mint."
section: "circle.cctp"
order: 30
lastUpdated: "2026-08-05"
keywords: ["CCTP v2", "bridge", "burn", "mint", "MetaMask"]
tutorial: true
aiSummary:
  - "Use /bridge for MetaMask-held USDC: review the route and fees, sign the CCTP v2 source burn, wait for attestation, and complete the destination mint."
  - "A recorded source burn is not safe to repeat; use its hash to diagnose or recover a pending mint."
---

## When CCTP is the right rail

Use `/bridge 5 USDC from base to arc on my metamask` when the USDC is in the connected MetaMask account and should move natively between supported CCTP testnet domains. This differs from `/transfer`, which spends source-scoped Circle Gateway balance.

CCTP is a burn-and-mint protocol, not a wrapped-token bridge. Circle describes it in the official [CCTP technical guide](https://developers.circle.com/cctp/references/technical-guide). Payna checks Bridge Kit route and Fast capabilities at runtime.

## Prerequisites

Connect the intended MetaMask account. The source and destination must differ and both must appear in Payna's CCTP selector. The source account needs enough native USDC for the amount plus any quoted USDC fee, and enough source-chain native token for gas. Manual mint also requires destination-chain native gas. Use the [Circle Faucet](https://faucet.circle.com/) only for testnet assets.

For an external recipient, enter the complete EVM address. Payna requires auto forwarding for this mode so the recipient does not need to submit the destination mint. Verify that the selected destination supports forwarding.

## Source burn and message

The preview precedes any irreversible action. On confirmation, Payna switches MetaMask to the source network, checks native gas and USDC, and asks for the required wallet operations. MetaMask may first show an ERC-20 allowance approval if the CCTP contract lacks sufficient allowance. A later request signs the source burn. Read every MetaMask network, contract, amount, and spending-limit prompt; confirmation in Payna is not a wallet signature.

The successful source transaction burns native USDC and emits a CCTP message. Payna records that burn immediately as `pending_mint`. Once the burn exists, do not restart the bridge: another attempt can burn another amount.

## Attestation and destination mint

Circle's offchain Attestation Service, Iris, observes the message and waits for the required confirmations before signing it. Fast transfer requests attestation at confirmed finality and may charge a route-dependent USDC fee; Standard waits for finalized finality. Availability comes from the route capability map.

The signed message is then submitted to the destination CCTP contract, which prevents nonce reuse and mints native USDC to the recipient. With auto forwarding, Circle's forwarder pays destination gas and submits this step. With manual mint, MetaMask must switch to the destination network and the user pays gas and signs. Attestation ready therefore does not mean mint complete.

## Read the preview

Confirm the amount, source network, destination network, full recipient, recipient mode, mint mode, and Fast or Standard speed. Payna's Bridge Kit estimate shows expected recipient amount, approximate source debit, bridge fee items, and gas items. Estimates can change before inclusion, and a displayed zero protocol fee does not mean gas is free.

External recipient plus manual mint is rejected. Payna also rejects same-chain routes, unsupported route capabilities, invalid addresses, insufficient USDC, or zero source native gas before asking for the burn where possible.

## Transaction history and receipts

After completion, the chat receipt can expose source-burn and destination-mint explorer links, a transfer ID, and an optional Payna proof on Arc Testnet. The proof is an application receipt, not a required CCTP step. Activity stores the route, amount, status, source hash, and mint metadata. Keep both hashes.

## Failure and recovery

First determine the stage. If the source transaction failed, no successful burn occurred and a corrected retry is reasonable. If it succeeded but history says `pending_mint`, preserve the source hash. Circle's [transfer troubleshooting guide](https://developers.circle.com/cctp/howtos/troubleshoot-transfers) recommends checking the burn, querying the CCTP v2 message/attestation by source transaction, then checking the destination mint.

A pending attestation may only be waiting for confirmations. If the attestation is complete, recover the mint rather than burning again; manual mode may need destination gas and a fresh MetaMask signature. An expired V2 attestation can be re-attested while the source burn still exists. Escalate with route, mode, speed, source hash, and any mint hash—never a secret.

## CCTP versus Gateway

CCTP spends MetaMask USDC and creates a source burn for one route. Gateway uses Payna's Circle wallet/Gateway path and can transfer from eligible source-scoped Gateway balance. A Gateway balance is not the MetaMask balance, and a CCTP burn does not fund Gateway. Choose the rail based on where funds currently live, not simply the destination chain.

## Safety checklist

Test with a small amount, verify both networks and the recipient, review allowance scope, keep gas on every manually signed chain, and save explorer links. Never paste a seed phrase or private key into Payna or support. Reject unexpected wallet prompts. Most importantly, after a successful burn, troubleshoot the existing message and mint instead of repeating the source action.
