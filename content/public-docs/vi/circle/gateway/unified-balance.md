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
  - "Payna có thể cộng SCA và Gateway để hiển thị visibility, nhưng transfer hiện tại chỉ debit một Gateway source domain được chọn rõ ràng."
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

## Tại sao transfer vẫn source-scoped

**Current Payna implementation behavior:** command phải chỉ rõ một source và Payna tạo một burn intent cho source domain đó. Nó so sánh ready amount của domain với `amount + estimatedGatewayFee`. Payna không cộng nhiều domain để execution dù balance screen có thể cộng chúng cho visibility và Circle protocol có thể biểu diễn multi-source request.

Ranh giới này làm preview auditable. Người dùng thấy chain nào cung cấp liquidity, nơi nào có thể cần signer authorization, source fee đã estimate, auto-deposit có được đề xuất không và retry command nào áp dụng. Unified total không bao giờ là lời hứa rằng mọi source choice đều tiêu được total đó.

## Ví dụ balance trên hai domain

Giả sử một SCA address có các balance đọc thành công sau:

| Balance category | Base Sepolia | Arc Testnet | Category total |
| --- | ---: | ---: | ---: |
| SCA on-chain | 6 USDC | 14 USDC | 20 USDC |
| Gateway ready | 11 USDC | 3 USDC | 14 USDC |

**Circle Gateway ready total là 14 USDC**. **Payna visible total là 34 USDC**, gồm 20 SCA cộng 14 Gateway. 20 SCA không âm thầm trở thành deposited liquidity.

Xét `/transfer 10 from arc to base`. Nếu quote là 0.03 USDC, Arc cần 10.03 ready. Arc chỉ có 3 nên transfer không thể debit 11 ready trên Base theo behavior hiện tại. Khi auto-deposit bật, Payna có thể xác định Arc SCA đủ để deposit phần thiếu 7.03, submit nó và trả pending-finality response. Người dùng cần chờ đúng deposit đó ready rồi retry. Hoặc chọn Base làm source, tạo route khác và lấy quote mới.

## Scope của depositor và signer

Gateway credit depositor, còn signer authorize việc tiêu. Payna deposit từ SCA và delegate một Circle-managed EOA. Vì thế balance read chính dùng SCA address. Recovery code có thể query cả SCA và historical signer address để deposit cũ vẫn được tìm thấy, nhưng việc này không gộp ownership giữa các address.

Nếu người dùng có nhiều SCA record hoặc deposit cũ từ address khác, support nên so sánh caller của deposit transaction, `walletAddress` trong webhook, domain và depositor được query. Không “sửa” signer balance bằng zero qua việc chuyển tiền hoặc lặp lại deposit.

## Checklist state và safety

- Label từng amount là SCA, Gateway pending hoặc Gateway ready và giữ chain/domain của nó.
- Loại pending deposit khỏi spendable Gateway balance.
- Xem partial read là lower bound; kiểm tra `failedChains` và `gatewayUnavailable`.
- Với transfer, kiểm tra selected source row thay vì cross-domain display total.
- Yêu cầu selected row đủ cả amount và current fee estimate.
- Giữ transaction hash và transfer ID đến khi history và balance view đồng thuận.
- Không dán private key, Circle API key hoặc private RPC URL vào support message.

## Official reference liên quan

[Gateway overview](https://developers.circle.com/gateway) của Circle định nghĩa unified cross-chain value proposition. [Technical guide](https://developers.circle.com/gateway/references/technical-guide) giải thích ledger, balance input, multiple burn intent và delegate. [EVM unified-balance quickstart](https://developers.circle.com/gateway/quickstarts/unified-balance-evm) minh họa finalized deposit và balance query. Dùng [supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains) cho domain/finality và [webhook events](https://developers.circle.com/gateway/references/webhook-events) cho authoritative finalized-deposit payload.
