---
slug: "circle/cctp-bridge"
title: "CCTP v2 bridge bằng MetaMask"
description: "Bridge USDC bằng source burn và destination mint do MetaMask ký."
section: "circle.cctp"
order: 30
lastUpdated: "2026-08-05"
keywords: ["CCTP v2", "bridge", "burn", "mint", "MetaMask"]
tutorial: true
aiSummary:
  - "Lệnh /bridge là MetaMask CCTP v2 flow, tách khỏi Circle Gateway transfer và cần source gas cùng chữ ký người dùng."
---

## Khi nào dùng CCTP

Dùng `/bridge 5 usdc from base to arc on my metamask` khi USDC nằm trong MetaMask và người dùng muốn bridge bằng CCTP v2. Đây là rail khác với `/transfer`, vốn dùng Circle wallet và Gateway balance.

Tham khảo [CCTP technical guide](https://developers.circle.com/cctp/references/technical-guide) của Circle để hiểu protocol flow chính thức.

## Burn và mint

MetaMask ký source transaction để burn/lock USDC và phát message. Sau attestation, destination transaction mint/receive USDC. Payna lưu cả source tx và mint tx để người dùng kiểm tra trên explorer.

## Điều kiện

MetaMask cần đúng network, đủ USDC và native source gas. Destination behavior phụ thuộc route/mint mode được preview; không đưa seed phrase hay private key cho Payna.
