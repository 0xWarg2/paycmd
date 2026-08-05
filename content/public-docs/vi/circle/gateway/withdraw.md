---
slug: "circle/gateway/withdraw"
title: "Withdraw từ Gateway"
description: "Rút Gateway balance về Circle SCA wallet trên cùng domain."
section: "circle.gateway"
order: 24
lastUpdated: "2026-08-05"
keywords: ["withdraw", "Gateway", "SCA", "same domain"]
tutorial: true
aiSummary:
  - "Payna withdraw chuyển Gateway balance về Circle SCA wallet trên cùng domain; đây không phải một cross-chain transfer."
---

## Same-domain withdrawal

`/withdraw 5 from base` chuyển Gateway balance trên Base về Circle SCA wallet trên **cùng domain**. Nó không bridge sang chain khác và không phải mô hình trustless withdrawal nhiều ngày.

## Trước khi xác nhận

Kiểm tra amount, source chain, địa chỉ SCA nhận tiền và fee trong preview. Source Gateway balance phải ready; pending deposit chưa thể withdraw.

## Sau khi hoàn tất

USDC trở lại SCA on-chain balance. Phần này không còn nằm trong Gateway ready balance cho đến khi người dùng deposit lại.
