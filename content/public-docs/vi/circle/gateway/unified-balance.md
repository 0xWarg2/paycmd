---
slug: "circle/gateway/unified-balance"
title: "Circle Gateway unified balance"
description: "Phân biệt Gateway unified balance, Circle SCA balance và tổng balance hiển thị trong Payna."
section: "circle.gateway"
order: 21
lastUpdated: "2026-08-05"
keywords: ["Circle Gateway", "unified balance", "SCA", "depositor"]
tutorial: true
aiSummary:
  - "Circle Gateway unified balance là USDC đã được depositor nạp vào Gateway trên các domain; nó không bao gồm USDC còn nằm trong Circle SCA wallet."
  - "Payna total balance cộng SCA on-chain balance và Gateway deposited balance để người dùng thấy toàn bộ tài sản, nhưng chỉ phần Gateway ready mới dùng được cho Gateway transfer."
---

## Hai khái niệm balance khác nhau

**Circle Gateway unified balance** là USDC đã được cùng một depositor nạp vào Gateway trên các source domain. USDC còn nằm trong Circle SCA wallet chưa phải Gateway balance.

**Payna total balance** là màn hình tổng hợp gồm SCA on-chain balances và Gateway deposited balances. Cách hiển thị này không biến SCA balance thành thanh khoản Gateway.

## Ready và pending

Deposit đang pending finality chưa được tính là Gateway ready balance. Chỉ ready balance trên source domain được chỉ định mới có thể cấp vốn cho lệnh transfer hiện tại.

## Transfer vẫn source-scoped

Lệnh `/transfer 5 from base to arc` sử dụng Gateway balance sẵn sàng trên Base và cần tối thiểu `amount + fee`. Payna không âm thầm gom nhiều source domain để bù thiếu cho một transfer.
