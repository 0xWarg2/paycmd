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
  - "Gateway ready balance gồm finalized deposit được ghi nhận cho một depositor và domain; SCA USDC và pending deposit là các phần riêng."
  - "Payna giữ named source command strict, nhưng explicit unified fallback có thể allocate ready balance qua tối đa 16 intent trong BurnIntentSet."
---

Cụm từ “unified balance” mô tả deposited-liquidity model của Circle Gateway. Không nên dùng nó như cách gọi tắt mọi lượng USDC nhìn thấy trong Payna. Cách đọc balance screen an toàn nhất là gắn owner, location, domain và settlement state vào từng con số.

## Các location của balance

USDC trong Payna có thể nằm ở nhiều location:

- **SCA on-chain balance** là USDC thông thường do Circle smart contract account giữ trên một chain cụ thể.
- **Gateway pending deposit** là USDC có deposit transaction nhưng Circle chưa credit vào ready balance.
- **Gateway ready balance** là lượng Circle balance API trả về theo depositor và domain, đã có thể dùng cho instant transfer request.
- **External-wallet balance** có thể xuất hiện trong funding hoặc MetaMask operation, nhưng không thuộc SCA hay Gateway ledger.

Di chuyển giữa location là transaction chứ không phải display toggle. `/fund` chuyển external-wallet USDC sang SCA. `/deposit` đưa SCA USDC vào Gateway lifecycle. `/withdraw` trả Gateway liquidity về same-domain SCA. Transfer tiêu ready Gateway balance và mint ở destination.

## Unified balance có nghĩa gì

Circle mô tả Gateway như off-chain ledger theo dõi finalized deposited balance cho từng tổ hợp chain, token và address. Sau khi được thiết lập, liquidity đó có thể hỗ trợ mint nhanh ở destination. Hệ thống quan sát finalized deposit, giảm balance khi phát transfer attestation và phối hợp source burn với destination mint. Xem [Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide#balances) chính thức.

Protocol có thể nhận nhiều burn intent, gồm source từ hơn một domain, để tạo attestation set. Đây là ý nghĩa rộng của cross-chain unification: ứng dụng có thể thiết kế transfer dùng deposited liquidity mà không buộc người dùng đặt sẵn đúng destination balance. Nó không merge wallet ownership, bỏ qua token hoặc tính unfinalized deposit.

Balance vẫn có attribution. Một depositor có 4 USDC ready ở domain 6 và 9 USDC ready ở domain 26 có tổng 13 USDC Gateway liquidity qua các entry. API vẫn trả từng entry để integration chọn source đúng.

## Payna total balance có nghĩa gì

Balance route của Payna đọc hai hệ thống độc lập: ERC-20 `balanceOf` cho SCA trên supported chain và Circle Gateway `/v1/balances` cho depositor. Nó trả per-chain row, SCA wallet total, Gateway total và giá trị visibility kết hợp `totalUnified`.

Combined label đó là product view, không phải protocol balance. **SCA wallet không phải Gateway balance.** Nếu SCA giữ 20 USDC và Gateway báo 8 USDC ready, Payna có thể hiển thị 28 USDC visible, nhưng chỉ 8 USDC có thể dùng ngay cho Gateway burn intent. 20 USDC còn lại cần deposit thành công và qua finality.

Payna cũng giữ thông tin uncertainty. Nếu chain RPC fail, SCA value là `unknown`, không phải zero. Nếu Gateway request fail, Gateway được đánh dấu unavailable. Combined number khi đó là partial và phải được đọc như lower bound. Refresh partial result an toàn vì balance read không chuyển tiền.

## Pending, ready và đã được tiêu

Endpoint `/v1/deposits` của Circle liệt kê deposit đã submit nhưng chưa process; documented status là pending. `/v1/balances` là lượng mới nhất dùng được cho instant transfer. Vì vậy Payna không suy finality chỉ vì deposit transaction đã có block confirmation hoặc vì total tình cờ tăng.

Primary settlement signal của Payna là signed webhook `gateway.deposit.finalized`. Recovery sync yêu cầu hai bằng chứng cho record hiện tại: Circle đã process ít nhất block chứa deposit, và đúng transaction hash không còn trong pending deposit list. Database transition chỉ chạy khi row vẫn là `pending_gateway_finality`, nên các refresh chồng nhau vẫn idempotent.

Sau khi Gateway nhận transfer request, ledger có thể giảm trước khi mọi local display refresh. Không coi source row cũ là fund còn dùng lại được. Hãy dùng transfer ID, forwarding state và destination transaction hash để reconcile submitted work.

## Transfer scoped-first và unified execution

**Current Payna implementation behavior:** named command vẫn source-scoped. `/transfer 5 from base to arc` tạo một burn intent, so Base ready balance với `amount + maxFee` và không âm thầm tiêu domain khác. `/transfer 5 from gateway to arc`, hoặc explicit fallback **Dùng Unified Gateway**, tạo BurnIntentSet từ selected ready source.

Unified execution vẫn không tiêu mù displayed total. Preview trừ `maxFee` từng intent, exclude source unusable/chưa authorize, hiện mọi allocation và bind confirmation với quote fingerprint. SCA balance và pending deposit vẫn bị loại. Vì thế unified total là visibility; `maximumUsableCapacity` mới gần execution capacity hơn.

## Ví dụ balance trên hai domain

Giả sử một SCA address có các balance đọc thành công sau:

| Balance category | Base Sepolia | Arc Testnet | Category total |
| --- | ---: | ---: | ---: |
| SCA on-chain | 6 USDC | 14 USDC | 20 USDC |
| Gateway ready | 11 USDC | 3 USDC | 14 USDC |

**Circle Gateway ready total là 14 USDC**. **Payna visible total là 34 USDC**, gồm 20 SCA cộng 14 Gateway. 20 SCA không âm thầm trở thành deposited liquidity.

Xét `/transfer 10 from arc to base`. Nếu maximum reserve là 0.03 USDC, Arc cần 10.03 ready. Arc chỉ có 3 nên scoped confirmation bị khóa. Payna cho chọn explicit minimum deposit 7.03 hoặc unified preview. Unified có thể đề xuất Base cộng Arc sau khi reserve fee từng intent; nó không auto-deposit 20 SCA USDC. Đổi selected source sẽ tạo quote và fingerprint mới.

## Scope của depositor và signer

Gateway credit depositor và Payna dùng chính Circle SCA đó để authorize việc tiêu trực tiếp bằng ERC-1271. Balance read và transfer mới vì thế dùng SCA address. Historical record vẫn có thể nhận diện signer legacy, nhưng operation mới không dùng chúng.

Nếu người dùng có nhiều SCA record hoặc deposit cũ từ address khác, support nên so sánh caller của deposit transaction, `walletAddress` trong webhook, domain và depositor được query. Không “sửa” signer balance bằng zero qua việc chuyển tiền hoặc lặp lại deposit.

## Checklist state và safety

- Label từng amount là SCA, Gateway pending hoặc Gateway ready và giữ chain/domain của nó.
- Loại pending deposit khỏi spendable Gateway balance.
- Xem partial read là lower bound; kiểm tra `failedChains` và `gatewayUnavailable`.
- Với scoped transfer, kiểm tra selected source row thay vì cross-domain display total.
- Với unified transfer, kiểm tra từng allocation, maximum fee reserve, exclusion và `maximumUsableCapacity`.
- Giữ transaction hash và transfer ID đến khi history và balance view đồng thuận.
- Không dán private key, Circle API key hoặc private RPC URL vào support message.

## Official reference liên quan

[Gateway overview](https://developers.circle.com/gateway) của Circle định nghĩa unified cross-chain value proposition. [ERC-1271 reference](https://developers.circle.com/gateway/references/erc-1271) giải thích direct smart-account signing. Dùng [supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains) cho domain/finality và [webhook events](https://developers.circle.com/gateway/references/webhook-events) cho authoritative finalized-deposit payload.
