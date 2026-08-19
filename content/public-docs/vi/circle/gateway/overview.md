---
slug: "circle/gateway/overview"
title: "Circle Gateway trong Payna"
description: "Mô hình unified USDC của Circle Gateway và cơ chế SCA ký trực tiếp trong Payna."
section: "circle.gateway"
order: 20
lastUpdated: "2026-08-18"
keywords: ["Circle Gateway", "SCA", "ERC-1271", "unified balance"]
tutorial: true
aiSummary:
  - "Payna dùng Circle SCA vừa làm Gateway depositor vừa làm signer ERC-1271; không tạo hoặc dùng delegate EOA."
  - "Mọi unified operation mới chạy qua Circle Unified Balance Kit và được ràng buộc với signed quote ngắn hạn."
---

Circle Gateway là hệ thống thanh khoản USDC non-custodial của Circle. Deposit đã finalized trở thành balance có thể tiêu qua các Gateway domain được hỗ trợ. USDC trong wallet nhưng chưa deposit không thuộc Gateway balance.

## SCA ký trực tiếp

Payna dùng một Circle smart contract account (SCA) cho mỗi user. SCA sở hữu deposited balance và ký Gateway Burn Intent trực tiếp bằng ERC-1271. Unified Balance Kit gửi `contractSigner: true`; không có delegated EOA, bước authorize delegate hoặc fallback sang EOA.

SCA cũng gửi transaction approve/deposit và, với Manual mint, transaction mint ở destination. Các on-chain action này có thể cần native gas nếu Circle Gas Station không sponsor transaction SCA tương ứng.

## Các trạng thái balance

Payna tách riêng:

- **Confirmed:** Gateway balance đã finalized và có thể allocation.
- **Pending:** deposit đã được quan sát nhưng chưa finalized.
- **Funds in motion:** transfer đã submit nhưng chưa đạt settlement state cuối.

Chỉ confirmed balance được allocation. RPC hoặc Gateway response partial không bao giờ bị hiểu thành balance bằng zero.

Deposit vào trạng thái **pending finality** sau khi source transaction confirmed nhưng trước khi Circle index đủ số confirmation bắt buộc. Payna lưu deposit hash rồi chờ signed Gateway webhook hoặc reconciliation read. App không cho tiêu pending value và không lặp deposit chỉ vì ready balance chưa đổi. Ranh giới này cũng ngăn UI trình bày optimistic total như tiền có thể tiêu.

Wallet screen rộng hơn có thể hiện ordinary SCA USDC cạnh Gateway USDC, nhưng hai giá trị vẫn tách biệt. Chuyển ordinary USDC vào Gateway bắt buộc confirmation `/deposit` rõ ràng. Tương tự, withdrawal chuyển confirmed Gateway value về ordinary SCA USDC bằng same-domain Burn Intent rồi mint. Không hướng nào chỉ là thay đổi bookkeeping.

## Mô hình source và destination

Scoped command nêu một source domain. Payna kiểm tra confirmed balance của source và maximum debit trong quote trước khi bật confirmation. Unified command yêu cầu Circle Kit tự allocation qua eligible source domain. Estimate trả allocation để user review; browser không thể thay bằng unsigned custom source list trong execution.

Gateway destination và funding source có capability khác nhau. Một chain có thể hiện trong balance read nhưng chưa được phê duyệt làm SCA spend source. Payna vì thế lấy giao giữa Circle Gateway support, Circle Wallet SDK support và allowlist nội bộ. Configuration unsupported hoặc mơ hồ fail closed thay vì âm thầm đổi signer, engine hay network.

Mint mode cũng phụ thuộc destination. `auto_forwarding` chỉ xuất hiện khi Unified Balance Kit báo destination forwarding được hỗ trợ. `manual` là recovery-compatible path và cần destination SCA transaction thực thi được. Đổi destination hoặc mint mode làm signed fingerprint thay đổi và bắt buộc quote mới.

## Lifecycle transfer

1. Preview lấy allocation và fee estimate từ Circle Kit mà không ký hoặc chuyển tiền.
2. Payna ký quote fingerprint ở server. Quote hết hạn sau 60 giây; UI confirmation lease là 50 giây.
3. Confirmation tạo durable operation trước khi submit và bind user, amount, recipient, destination, mint mode cùng funding mode vào fingerprint.
4. SCA ký Burn Intent trực tiếp bằng ERC-1271. Circle Kit hỗ trợ tối đa 16 source intent.
5. Circle forward destination mint nếu capability của destination cho phép, hoặc Payna thực hiện Manual mint.
6. History lưu actual allocation, actual fee, transfer ID, transaction hash và settlement state. Signature, attestation và recovery payload chỉ nằm ở server.

Nếu forwarding fail sau khi source đã submit, Payna không bao giờ chạy lại spend. App lưu resumable state và chỉ cho tiếp tục destination Manual mint.

## Arc Testnet

Arc Testnet dùng chain ID `5042002`, RPC `https://rpc.testnet.arc.io` và explorer `https://testnet.arcscan.app`. Native USDC gas unit có 18 decimals; ERC-20/display USDC có 6 decimals. Payna kiểm tra chain ID và gọi `USDC.isBlacklisted(recipient)` trước khi ký Gateway transfer tới Arc. Không kiểm tra được cũng phải dừng.

Arc forwarding lấy theo capability, không bị hard-code tắt. Manual mint dùng Circle Gas Station khi sponsorship policy khả dụng; nếu không, Payna báo đúng native-gas requirement.

## Retry an toàn

Client gửi UUID operation ID. Dùng lại ID với cùng fingerprint trả kết quả cũ; dùng cùng ID với input khác trả `GATEWAY_OPERATION_ID_CONFLICT`. Quote legacy trả `GATEWAY_QUOTE_ENGINE_MISMATCH` và phải estimate lại.

Sau khi đã có transfer ID hoặc source transaction, lỗi mơ hồ được reconcile theo identifier thay vì retry mù. Nếu destination mint thành công nhưng ghi receipt thất bại, operation chuyển sang `reconciliation_required` và không thể mint lại.

Durable operation đi qua state rõ ràng như created, submitted, pending mint, success, failure và reconciliation required. State transition được lưu cùng authenticated user và transaction row. Raw Circle recovery material nằm trong bảng RLS-protected riêng mà browser session không select được. Manual-mint retry atomically claim row này để hai tab không thể cùng execute một recovery.

Quote freshness và operation idempotency giải quyết hai vấn đề khác nhau. Quote ngăn execution dưới price, allocation hoặc capability đã cũ. UUID ngăn request hợp lệ bị submit hai lần do browser retry network timeout. Cả hai check xảy ra trước signing. Dung sai fee 5% cho phép Circle fee dịch chuyển có giới hạn mà không chấp nhận economic payload khác; quote vượt policy phải được review lại.

## Ví dụ hoàn chỉnh

Giả sử SCA có 20 ordinary USDC trên Base, 4 confirmed Gateway USDC trên Base, 7 confirmed Gateway USDC ở một domain được hỗ trợ khác và deposit 3 USDC vẫn pending. Ordinary 20 và pending 3 nhìn thấy được nhưng không dùng cho Gateway transfer. Unified request 10 USDC chỉ dùng confirmed 11, sau khi trừ fee reserve Circle Kit trả về.

Preview hiện contributing domain đề xuất, destination, recipient, estimated fee, maximum debit, mint mode hỗ trợ, expiry và fingerprint. Confirm tạo operation trước rồi mới yêu cầu direct SCA signature. Nếu Circle nhận source spend nhưng forwarding fail sau đó, Activity hiện `pending_mint`; user có thể tiếp tục Manual mint mà không burn thêm 10 USDC. Nếu UUID cũ được gửi lại với recipient khác, Payna trả conflict thay vì đoán payment nào đúng.

Với Arc recipient, cùng preview còn thực hiện chain và blocklist check. Primary RPC bị rate limit có thể dùng configured fallback với bounded retry. Wrong chain ID, blocklist read không khả dụng hoặc address bị blacklisted đều ngăn signing. Việc thiếu safety signal vì thế là điều kiện chặn, không phải quyền tiếp tục.

## Official reference

- [Circle Gateway](https://developers.circle.com/gateway)
- [Gateway ERC-1271](https://developers.circle.com/gateway/references/erc-1271)
- [Gateway supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains)
- [Gateway fees](https://developers.circle.com/gateway/references/fees)
