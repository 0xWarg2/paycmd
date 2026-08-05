---
slug: "circle/gateway/deposit-and-finality"
title: "Deposit và Gateway finality"
description: "Từ SCA deposit đến Gateway ready balance, webhook và recovery sync."
section: "circle.gateway"
order: 22
lastUpdated: "2026-08-05"
keywords: ["deposit", "finality", "pending", "webhook", "sync"]
tutorial: true
aiSummary:
  - "Lệnh /deposit của Payna approve USDC rồi gọi Gateway từ SCA; transaction đã confirm vẫn pending đến khi Circle finalize và process."
  - "Signed webhook là finality signal chính, còn idempotent sync reconcile processed height với pending-deposit list của Circle."
---

## `/fund` khác `/deposit`

`/fund 10 from metamask on base` gửi USDC từ MetaMask đến Circle SCA của người dùng trên Base. Kết quả là SCA on-chain balance thông thường. Nó có thể dùng cho payment hoặc làm input của deposit sau đó, nhưng **SCA wallet không phải Gateway balance**.

`/deposit 10 from base` bắt đầu flow khác. Payna dùng Circle SCA để authorize Gateway Wallet contract rồi gọi deposit function trên Base. Chỉ sau khi Circle quan sát event đã finalized và cập nhật ledger, amount mới trở thành Gateway ready balance.

Dùng `/balance` giữa các operation. Xác nhận funding xuất hiện trong phần SCA trước khi deposit, rồi xác nhận deposited amount cuối cùng xuất hiện trong phần Gateway ready. Không mong `/fund` bỏ qua deposit finality.

## Allowance, delegate và deposit transaction

Circle hỗ trợ nhiều protocol deposit method: allowance rồi `deposit`, EIP-2612 permit và ERC-3009 authorization, cùng variant credit cho depositor khác. Các cách này được mô tả trong [Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide#deposit).

**Current Payna implementation behavior:** `/deposit` dùng allowance path. Trước khi chuyển fund, nó tạo hoặc tìm Gateway signer EOA cho người dùng. SCA trước tiên submit `addDelegate` để EOA có thể ký burn intent về sau. Sau đó SCA submit `approve(GatewayWallet, amount)` đến USDC và cuối cùng gọi `deposit(token, amount)` từ SCA. Đây là Circle developer-controlled wallet contract-execution transaction; route chờ state confirmed hoặc complete.

SCA gọi contract là depositor được Gateway credit. Delegated EOA ký future transfer request nhưng không nhận balance này. Delegate initialization hoặc approval có thể tiêu source native gas dù hai action đó chưa chuyển requested USDC vào Gateway.

## Không gửi USDC trực tiếp vào Gateway

**Cảnh báo:** không dùng ERC-20 `transfer` thông thường để gửi USDC tới Gateway Wallet contract address. Circle cảnh báo rõ plain transfer không được credit vào unified balance và có thể gây mất tiền vĩnh viễn. Phải dùng một trong các Gateway deposit contract method. Xem [EVM unified-balance quickstart](https://developers.circle.com/gateway/quickstarts/unified-balance-evm#step-3-deposit-into-a-unified-crosschain-balance-circle-wallets) của Circle.

Command `/deposit` của Payna tạo supported call. Không copy Gateway address từ history rồi tự gửi token đến đó. Contract address đúng không làm một call sai trở nên an toàn.

## Submitted chưa phải ready

Khi Payna nhận confirmed deposit transaction hash, nó ghi chain, amount, hash, deposit block number nếu đọc được và status `pending_gateway_finality`. Submitted on-chain transaction có thể đã thấy trong explorer, nhưng amount chưa được transfer dùng đến khi Circle process.

Endpoint `/v1/deposits` của Circle xác định deposit đã quan sát nhưng còn pending. `/v1/balances` báo liquidity dùng được cho instant transfer. Protocol chờ network-specific confirmation trước khi đổi balance; thông tin hiện tại nằm trong [Gateway supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains#required-block-confirmations).

Không submit lặp cùng deposit chỉ vì balance chưa xuất hiện. Deposit hợp lệ thứ hai sẽ chuyển thêm một amount. Giữ transaction hash đầu tiên rồi chờ hoặc reconcile nó.

## Webhook finality

Primary completion path của Payna là webhook `gateway.deposit.finalized` từ Circle. Circle cho biết event này phát sau khi token được deposit, on-chain transaction đã finalized và Gateway đã process deposit. Payload gồm depositor wallet address, domain, decimal amount và transaction hash; xem [Gateway webhook events](https://developers.circle.com/gateway/references/webhook-events#gatewaydepositfinalized).

Payna validate notification type và deployment environment, verify ECDSA signature của Circle bằng published notification key, rồi match transaction hash với pending record. Settlement conditionally đổi record sang `success`, lưu finality source và notification ID, cập nhật waiting chat/execution state và tạo availability notification. Webhook gửi lặp không settle cùng pending row hai lần vì update yêu cầu prior pending status.

Webhook finality khác browser polling timer. Đóng page không hủy deposit đã submit, và mở lại page không tạo finality; thao tác đó chỉ refresh recorded state.

## Recovery sync và idempotent refresh

`/api/gateway/deposit/sync` là recovery path khi webhook delivery, browser event hoặc Realtime propagation bị trễ. Với current row có deposit block, sync request pending deposit và Gateway domain processing height từ Circle. Nó chỉ settle khi đúng hash vắng khỏi pending list **và** processed height của Circle đã đến hoặc vượt deposit block.

Record tạo trước khi lưu block number có thể dùng legacy grace rule, nhưng timeout đó không phải standard finality model. Webhook vẫn authoritative và record mới cần positive Circle reconciliation evidence.

Refresh là idempotent. Nhiều sync call có thể chồng nhau nhưng mỗi settlement update đều conditional, remaining pending row được đọc lại và duplicate completion snapshot được deduplicate theo normalized transaction hash. Refresh hoặc chạy recovery lại là an toàn; submit deposit khác chỉ để ép display đổi là không an toàn.

## Failure trước submission

Validation, wallet lookup, signer creation, allowance, gas hoặc approval có thể fail trước khi deposit call được submit. Signal thường gặp là không có deposit transaction hash, user reject rõ ràng, SCA USDC thiếu, native gas thiếu, Wallet SDK chain unsupported hoặc network/RPC error.

Xác nhận step đã fail. Approval hash không phải deposit. Nạp đúng wallet được nêu trong error, sửa amount/chain và chỉ retry command sau khi chắc chắn không có deposit transaction. Amount phải positive; route hiện tại cũng có safety ceiling lớn.

## Failure sau khi fund đã di chuyển

Timeout, lỗi đọc block number, database problem, browser đóng hoặc response thất lạc có thể xảy ra sau khi deposit transaction submit hoặc confirm. Khi đó command có thể trông thất bại dù on-chain USDC đã rời SCA. Không giả định “error” nghĩa là “không có state change.”

Tìm deposit hash trong history và chain explorer. Nếu transaction success, giữ hash và dùng recovery sync. So sánh caller với SCA depositor, domain với selected chain, membership trong Circle pending-deposit list và processed height. Escalate bằng các public identifier này nếu còn unresolved. Không chia sẻ wallet credential.

## Diagnostic checklist

1. Kiểm tra command: `/deposit <positive amount> from <supported source>`.
2. Xác nhận Circle SCA tồn tại, đủ USDC và có native gas cho delegate, approval, deposit.
3. Phân biệt signer EOA với SCA depositor; query balance theo depositor.
4. Xác định on-chain step cuối: delegate, approval hay deposit. Chỉ deposit hash theo dõi USDC đã chuyển.
5. Nếu có deposit hash, kiểm tra chain success và block number; không resubmit.
6. Khi status là `pending_gateway_finality`, kiểm tra Circle pending list và chờ required confirmation.
7. Refresh hoặc gọi recovery sync. Duplicate refresh an toàn; duplicate deposit không an toàn.
8. Khi ready, xác nhận Gateway row trên cùng domain trước transfer hoặc withdraw.
