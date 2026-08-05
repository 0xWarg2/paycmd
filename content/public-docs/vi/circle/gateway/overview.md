---
slug: "circle/gateway/overview"
title: "Circle Gateway trong Payna"
description: "Mental model và luồng unified USDC của Circle Gateway."
section: "circle.gateway"
order: 20
lastUpdated: "2026-08-05"
keywords: ["Circle Gateway", "SCA", "signer", "depositor", "unified"]
tutorial: true
aiSummary:
  - "Circle Gateway tách SCA wallet, depositor balance và Gateway signer; Payna hiển thị chúng trong một flow nhưng không trộn vai trò."
---

## Mental model

Circle Gateway cung cấp một lớp thanh khoản USDC cross-chain sau khi USDC được deposit. **Circle SCA wallet không phải Gateway balance**: SCA giữ USDC on-chain; Gateway theo dõi USDC đã deposit theo depositor và domain; Gateway signer ký các intent cần thiết.

Xem thêm [Circle Gateway overview](https://developers.circle.com/gateway) và [Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide) để đối chiếu protocol behavior chính thức.

## Luồng chuẩn

1. MetaMask có thể fund USDC vào SCA.
2. SCA deposit USDC vào Gateway trên source domain.
3. Gateway chờ finality và chuyển deposit từ pending sang ready.
4. Transfer dùng ready balance trên source đã chọn, burn intent và mint ở destination.
5. Người dùng có thể withdraw Gateway balance về SCA trên cùng domain.

## “Unified” không có nghĩa là tự động gom source

Gateway cung cấp unified visibility và khả năng mint cross-chain. Implementation hiện tại của `/transfer ... from <chain>` vẫn source-scoped và không tự tiêu balance ở domain khác.
