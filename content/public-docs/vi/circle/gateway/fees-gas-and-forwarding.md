---
slug: "circle/gateway/fees-gas-and-forwarding"
title: "Gateway fee, gas và forwarding"
description: "Chọn auto forwarding hoặc manual destination gas cho transfer."
section: "circle.gateway"
order: 25
lastUpdated: "2026-08-05"
keywords: ["fee", "gas", "auto forwarding", "manual mint"]
tutorial: true
aiSummary:
  - "`fees.total` là current estimated/settled charge; `maxFee` từng intent là signed cap, và tổng cap là maximum reserve chứ không phải expected fee."
  - "Unified allocation dùng confirmed balance và fee reserve; deposit vẫn là confirmation riêng."
---

## Bốn loại cost cần tách biệt

Một Gateway operation có thể liên quan bốn cost category:

1. **Gateway protocol fee** được charge bằng USDC vào source balance. Circle mô tả nó gồm source burn gas và transfer fee theo amount.
2. **Forwarding fee** là source-side USDC bổ sung khi Circle Forwarding Service relay destination mint. Nó gồm forwarding service và destination gas component.
3. **Source native gas** trả cho explicit SCA on-chain action như approve USDC hoặc deposit khi Gas Station không sponsor. Nó không bị trừ từ Gateway USDC.
4. **Destination native gas** do SCA trả cho Manual mint không được sponsor. Với forwarding, Circle trả destination execution và charge forwarding fee bằng source USDC.

“Fee” trong receipt phải nói rõ category. Cộng USDC fee vào source debit khác với kiểm tra native-token balance của wallet.

## Gateway protocol fee và source debit

[Gateway fee reference](https://developers.circle.com/gateway/references/fees) giải thích `maxFee` phải cover source gas, transfer fee và forwarding headroom. Scoped source phải giữ **`amount + maxFee`**; trong BurnIntentSet, mỗi source chỉ đóng góp tối đa **`ready balance - maxFee của intent đó`**.

Nếu user gửi 10 USDC và scoped reserve là 0.02 USDC, maximum source debit là 10.02. Recipient vẫn nhận 10. Unified mode có thể chia 10 qua nhiều source, nhưng tổng allocated value vẫn là 10 và mỗi row giữ cap riêng.

Không copy static fee example thành operational promise. Network cost và route condition có thể đổi, forwarding route có composition khác manual route.

## Quote field trong Payna hiện tại

**Current Payna implementation behavior:** scoped gửi một partial burn intent; unified gửi một partial set có `intents[]`. Cả hai bỏ caller placeholder `maxFee`. Auto forwarding thêm `enableForwarder=true`. Payna đọc `fees.total` làm aggregate estimate và đọc `maxFee`/`maxBlockHeight` của từng returned intent làm execution constraint.

Với scoped non-forwarding quote, positive `maxFee` có thể được label `max_fee_reserve` khi không có total. Forwarding bắt buộc có positive `fees.total`. Set bắt buộc có positive cap cho mọi intent; Payna cộng các cap làm maximum reserve và fail closed nếu quoted total vượt reserve. Nó không tự tạo zero fee.

`fees.total` và `sum(maxFee)` trả lời hai câu hỏi khác nhau: current estimate/settled charge và maximum debit được signature cho phép. UI hiển thị cả hai khi khác nhau. Base/transfer component đến từ `fees.perIntent`; forwarding là aggregate component. Không dùng hard-coded fee table thay `/v1/estimate`.

Behavior này cần phân biệt với general API schema của Circle, nơi `maxFee` là maximum authorization của user và estimate endpoint có thể trả thêm burn-intent constraint. Xem [estimate API reference](https://developers.circle.com/api-reference/gateway/all/estimate-transfer) chính thức.

## Preview timing và quote freshness

Với `/transfer` và `/pay`, Payna estimate trước deposit hoặc Burn Intent signing. Preview là read-only nên quote failure không để lại wallet hay balance mutation.

`/withdraw` có boundary khác. UI preview chỉ xác nhận amount, source và same-domain SCA recipient model. Sau confirmation, withdraw route resolve SCA rồi tìm hoặc tạo signer **trước** fee estimate; balance, mint gas và authorization check chạy sau đó. Vì vậy withdraw quote có thể fail sau signer initialization, dù chưa submit burn intent.

Scoped panel expose ready balance, current fee, maximum reserve/debit, mint mode và explicit deposit/unified choice khi thiếu. Unified panel expose từng allocation/reserve, `fees.total`, `sum(maxFee)`, exclusion và fingerprint. Đổi amount, source, destination hay mint mode cần quote mới; execution mismatch trả `GATEWAY_QUOTE_CHANGED`.

Khi execution, Payna ký quoted atomic fee làm `maxFee` của burn intent. Khi settled response có `fees.total`, receipt dùng value đó làm `actualGatewayFee` và tính `actualSourceDebit = amount + actual fee`. Nếu settled fee vắng, UI phải giữ estimate label thay vì tạo precision giả.

## Source gas

Gateway transfer request được Circle SCA ký trực tiếp bằng ERC-1271. First explicit deposit có thể cần USDC `approve` và Gateway `deposit`. Payna tách riêng các action này và không tự bắt đầu shortfall deposit khi user chưa confirm.

Các operation đó cần native gas trên source SCA và current Circle Wallet SDK support nếu Gas Station không sponsor. Payna không partial burn khi prerequisite chưa khả dụng. Chỉ fund public address/network được error nêu.

## Automatic forwarding

Auto forwarding là default của Payna. Estimate và transfer request dùng `enableForwarder=true`; Circle Forwarding Service mint ở destination nên user không cần destination native gas. Circle mô tả service, fee collection và polling model trong [Forwarding Service](https://developers.circle.com/gateway/references/forwarding-service) cùng [end-to-end how-to](https://developers.circle.com/gateway/howtos/forwarding-service).

Payna chờ transfer status của Circle thành `confirmed` hoặc `finalized`. Sau đó nó yêu cầu valid `forwardingDetails.transactionHash`, trả forwarding detail và settled fee data rồi dùng hash đó làm `destinationTxHash`. Nó không submit separate manual mint nên `mintTxHash` có thể absent.

Với BurnIntentSet, Circle có thể lấy forwarding cost từ `maxFee` headroom theo intent order rồi tiếp tục sang intent sau. Vì thế phải giữ per-intent cap theo order Circle trả; client không được tự giả định dồn toàn fee vào source balance lớn nhất.

Nếu Circle báo `failed`, `expired`, timeout hoặc thiếu destination hash sau settlement, Payna raise forwarding-settlement error. Nó không auto-fallback sang manual vì forwarded request đã submit và có thể settle sau.

## Manual mint

Thêm `manual` hoặc `no forwarding` để chọn Manual mode. Quote loại forwarding service path; SCA thực hiện `gatewayMint` cần destination native gas nếu Gas Station không sponsor. Recipient vẫn nhận USDC.

Manual mode chờ attestation/signature, submit destination contract call và trả `mintTxHash`. Hash đó trở thành `destinationTxHash`; `forwardingDetails` có thể absent. Nếu destination gas không verify được, Payna dừng trước burn bằng `DESTINATION_GAS_CHECK_UNAVAILABLE` thay vì lấy source balance vào path chưa thể execute.

Manual có thể giảm USDC quote nhưng không tự động rẻ hơn. Hãy so destination native gas, operational complexity, SDK support và failure recovery bên cạnh displayed Gateway fee.

## Chọn mode

Chọn auto forwarding khi destination wallet thiếu native gas, route được Circle forwarding support hoặc simpler settlement đáng giá theo USDC quote. Chọn manual khi designated minter đã có destination gas ổn định và preview xác nhận usable route.

Với cả hai transfer mode, kiểm tra source, destination, recipient, source debit và quote type. `/gas check <chain>` giúp inspect balance, còn transfer estimate và confirmed execution response xác định wallet role nào cần gas. Same-chain route không tự bị ép sang manual; Payna giữ selected mint mode.

## Failure và retry checklist

- Quote unavailable: transfer preview chưa làm stateful work; confirmed withdrawal có thể đã initialize signer, nhưng ở thời điểm này cả hai path chưa submit burn intent.
- Scoped source thiếu: confirm rõ proposed minimum deposit hoặc review unified allocation; deposit không auto-send transfer.
- Unified capacity thiếu: inspect ready balance, maximum usable capacity và exclusion; Payna không auto-deposit.
- Source gas thiếu: fund SCA cho named approval/deposit operation.
- Manual destination gas thiếu: fund identified SCA/signer hoặc đổi mode rồi re-estimate.
- Forwarded transfer đã submit: giữ `transferId`; inspect Circle status trước retry.
- Manual attestation đã nhận: kiểm tra destination mint transaction/challenge đã tồn tại chưa.
- Receipt mismatch: ưu tiên settled `fees.total` và destination hash đúng mode.
- Support request: chỉ gửi public identifier, không gửi key, credential hay private RPC configuration.
