---
slug: "circle/gateway/fees-gas-and-forwarding"
title: "Gateway fees, gas, and forwarding"
description: "Choose auto forwarding or manual destination gas for a transfer."
section: "circle.gateway"
order: 25
lastUpdated: "2026-08-05"
keywords: ["fee", "gas", "auto forwarding", "manual mint"]
tutorial: true
aiSummary:
  - "Auto forwarding pays an extra USDC fee and avoids destination native gas; manual mode can cost less USDC but the minting wallet needs destination gas."
---

## Auto forwarding

This is Payna's default. The USDC fee includes forwarding cost and the source needs `amount + fee`. Circle's Forwarding Service handles the destination mint, so the user does not need destination native gas.

## Manual gas

Add `manual` or `no forwarding` when the route supports it. The USDC fee can be lower, but the SCA or Gateway signer executing the mint needs native gas on the destination.

## Gas by rail

MetaMask pays gas for funding, CCTP bridges, and Arc swaps. SCA or signer gas applies only to Circle wallet transactions or manual destination minting explicitly described by the preview. Run `/gas <chain>` before choosing manual mode.
