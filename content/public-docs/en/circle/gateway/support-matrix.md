---
slug: "circle/gateway/support-matrix"
title: "Gateway network support"
description: "Gateway domains and the operational coverage of the current Circle Wallet SDK."
section: "circle.gateway"
order: 26
lastUpdated: "2026-08-05"
keywords: ["network", "domain", "Circle SDK", "testnet"]
tutorial: false
aiSummary: []
---

## Two support layers

A network can be listed by Circle Gateway while Payna's current Circle Wallet SDK cannot perform the SCA or EOA signing operations required by a command. The generated table below keeps those two questions separate.

**Gateway listed** means Payna has a public Gateway configuration entry containing the chain label, Circle domain, native USDC address, and viem chain definition. It does not by itself promise that every Payna workflow can create Circle wallet transactions.

**Wallet SDK operations** means Circle SCA contract execution is available for that chain. A “No” can still allow public reads such as balances through configured RPCs, but deposit, direct ERC-1271 signing, Manual mint, or other managed-wallet actions are unavailable through the current SDK path.

## What a domain means

A `domain` is Circle's numeric identifier for a blockchain in Gateway and CCTP messages. It is not the EVM chain ID and should never be substituted into wallet network configuration. Circle maintains the official mapping in [Gateway supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains).

Payna uses the domain when querying depositor balances, building burn intents, matching webhooks, and reconciling processed block heights. A balance on domain 6 and a balance on domain 26 are separate source entries even when their values are summed for unified visibility.

## Configuration-driven table

The rows are not hand-written Markdown. The documentation page projects them at render time from `GATEWAY_CHAIN_CONFIGS`, the same configuration used by Payna's Gateway SDK. Adding, removing, or remapping a supported chain therefore updates the public labels, domains, and Wallet SDK indicator without maintaining a second table.

The projection intentionally exposes only `key`, `label`, `domain`, and the computed Wallet SDK boolean. The “Gateway listed” column is true for each rendered row because the row exists in that configuration.

## How to interpret unsupported operations

A Wallet SDK “No” means “not operable through Payna's current Circle managed-wallet flow,” not “Circle Gateway protocol does not know this domain.” Do not work around it by selecting a similar chain name or manually changing a domain. Use a row marked Wallet SDK “Yes,” or wait for the application and SDK configuration to add the missing mapping.

Support is also operation-specific. Auto forwarding, manual mint, deposit, withdrawal, and public balance reads have different dependencies. The appropriate runtime checkpoint—a transfer estimate panel or a confirmed execution response/error—is the final check. A table row is not a guarantee that a recipient, gas balance, quote, webhook, or RPC is healthy at this moment.

## Testnet scope

This Payna chapter describes its current **testnet** Gateway integration. Chain labels such as Base Sepolia, Avalanche Fuji, Polygon Amoy, and Arc Testnet must not be interpreted as mainnet destinations. Test tokens have no cash redemption value, and testnet availability can change.

Circle's official support page lists both testnet and mainnet networks and required confirmation behavior. Use it for protocol coverage, then use this generated table for the narrower Payna runtime coverage. Solana Devnet may appear in Circle's broader list but is not in Payna's current EVM configuration projection.

## Public data and private configuration

The table deliberately does not expose RPC URLs, RPC keys, Circle API credentials, wallet IDs, database identifiers, private keys, or environment-variable overrides. Those values are operational secrets or deployment details and are unnecessary for deciding whether a public command is supported.

For troubleshooting, share the public chain label, domain, wallet address, transaction hash, transfer ID, and exact error code. Never paste a credential to prove that a row is configured. A missing private detail in this table is a safety property, not incomplete documentation.

## Verification checklist

1. Match the command's chain alias to the intended generated row.
2. Confirm the Circle domain against the official [supported-blockchains reference](https://developers.circle.com/gateway/references/supported-blockchains).
3. Require Wallet SDK “Yes” for Payna SCA or managed-signer transactions.
4. Confirm that both source and destination meet the operation's needs.
5. For transfer, obtain a fresh estimate panel; for withdrawal, expect fee, balance, gas, and signer checks only after confirmation.
6. Treat unsupported as a hard stop; never patch a domain or RPC value in a client request.
