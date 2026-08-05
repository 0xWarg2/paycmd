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
  - "Gateway fee debit source USDC, source-side wallet operation dùng native gas, còn manual destination mint cần native gas từ minting wallet."
  - "Transfer flow quote trước state change; withdraw chỉ initialize signer sau confirmation rồi mới quote và check execution requirement."
---

## Bốn loại cost cần tách biệt

Một Gateway operation có thể liên quan bốn cost category:

1. **Gateway protocol fee** được charge bằng USDC vào source balance. Circle mô tả nó gồm source burn gas và transfer fee theo amount.
2. **Forwarding fee** là source-side USDC bổ sung khi Circle Forwarding Service relay destination mint. Nó gồm forwarding service và destination gas component.
3. **Source native gas** trả cho SCA on-chain action như thêm delegate, approve USDC hoặc auto-deposit. Nó nằm trong transaction-sending SCA, không bị trừ từ Gateway USDC.
4. **Destination native gas** do SCA hoặc Gateway signer trả khi Payna manual mint. Với forwarding, Circle trả destination execution và charge forwarding fee bằng source USDC.

“Fee” trong receipt phải nói rõ category. Cộng USDC fee vào source debit khác với kiểm tra native-token balance của wallet.

## Gateway protocol fee và source debit

[Gateway fee reference](https://developers.circle.com/gateway/references/fees) của Circle giải thích `maxFee` của burn intent phải cover source gas component, transfer fee và forwarding fee nếu có. Gateway collect fee khi fund bị burn trên source. Vì thế Payna yêu cầu selected source Gateway row giữ **`amount + estimated fee`**.

Nếu user gửi 10 USDC và current quote là 0.02 USDC, previewed source requirement là 10.02. Recipient amount vẫn 10; 0.02 thêm vào không thuộc destination mint. Cross-domain visible total trên 10.02 không giúp khi explicitly selected source row thấp hơn.

Không copy static fee example thành operational promise. Network cost và route condition có thể đổi, forwarding route có composition khác manual route.

## Quote field trong Payna hiện tại

**Current Payna implementation behavior:** Payna gửi partial burn intent tới `/v1/estimate` của Circle và bỏ placeholder `maxFee`. Với auto forwarding, nó thêm `enableForwarder=true`. Payna ưu tiên decimal `fees.total` từ top-level response hoặc response item đầu rồi convert sang six-decimal USDC atomic unit.

Nếu `fees.total` unusable và first returned burn intent có positive atomic `maxFee`, current shared parser dùng value đó làm reserve. Fallback này mode-agnostic; parser không yêu cầu manual mode. Response label hai successful case là `quoted_total` và `max_fee_reserve`. Nó chỉ fail khi không có cả usable positive total lẫn positive reserve, và không tự tạo zero fee.

Behavior này cần phân biệt với general API schema của Circle, nơi `maxFee` là maximum authorization của user và estimate endpoint có thể trả thêm burn-intent constraint. Xem [estimate API reference](https://developers.circle.com/api-reference/gateway/all/estimate-transfer) chính thức.

## Preview timing và quote freshness

Với `/transfer`, Payna estimate trước signer creation, delegate authorization, auto-deposit hoặc burn signing. Ordering này khiến transfer quote failure là read-only failure và ngăn unavailable transfer preview để lại wallet hay balance mutation.

`/withdraw` có boundary khác. UI preview chỉ xác nhận amount, source và same-domain SCA recipient model. Sau confirmation, withdraw route resolve SCA rồi tìm hoặc tạo signer **trước** fee estimate; balance, mint gas và authorization check chạy sau đó. Vì vậy withdraw quote có thể fail sau signer initialization, dù chưa submit burn intent.

Transfer estimate panel phải expose `estimatedGatewayFee`, `requiredGatewayBalance`, `feeEstimateKind`, mint mode và forwarding state. Nó không được hiển thị hard-coded fixed fee trước khi estimate trả về và không được gọi estimate là “actual”. Khi user đổi amount, source, destination, recipient hoặc mint mode, cần quote mới. Withdrawal chỉ hiển thị estimate và requirement trong confirmed execution response hoặc error, không phải current preview.

Khi execution, Payna ký quoted atomic fee làm `maxFee` của burn intent. Khi settled response có `fees.total`, receipt dùng value đó làm `actualGatewayFee` và tính `actualSourceDebit = amount + actual fee`. Nếu settled fee vắng, UI phải giữ estimate label thay vì tạo precision giả.

## Source gas

Gateway transfer request được Circle-managed EOA ký dạng typed data, nhưng surrounding Payna operation có thể submit source-chain transaction. First deposit có thể cần `addDelegate`, USDC `approve` và Gateway `deposit`. Existing depositor có signer chưa authorized có thể cần delegate call khác. Auto-deposit cũng yêu cầu SCA approve và deposit shortfall.

Các operation đó cần native gas trên source SCA và current Circle Wallet SDK support cho chain. SCA có thể đủ USDC nhưng vẫn fail `INSUFFICIENT_GAS`. Chỉ fund public address và network được error nêu, sau đó lấy fresh transfer estimate hoặc retry confirmed withdrawal execution tùy operation. Không gửi native gas tới depositor contract hoặc signer trừ khi response xác định nó là transaction sender.

## Automatic forwarding

Auto forwarding là default của Payna. Estimate và transfer request dùng `enableForwarder=true`; Circle Forwarding Service mint ở destination nên user không cần destination native gas. Circle mô tả service, fee collection và polling model trong [Forwarding Service](https://developers.circle.com/gateway/references/forwarding-service) cùng [end-to-end how-to](https://developers.circle.com/gateway/howtos/forwarding-service).

Payna chờ transfer status của Circle thành `confirmed` hoặc `finalized`. Sau đó nó yêu cầu valid `forwardingDetails.transactionHash`, trả forwarding detail và settled fee data rồi dùng hash đó làm `destinationTxHash`. Nó không submit separate manual mint nên `mintTxHash` có thể absent.

Nếu Circle báo `failed`, `expired`, timeout hoặc thiếu destination hash sau settlement, Payna raise forwarding-settlement error. Nó không auto-fallback sang manual vì forwarded request đã submit và có thể settle sau.

## Manual mint

Thêm `manual` hoặc `no forwarding` để chọn manual mode. Quote loại forwarding service path, nhưng wallet thực hiện `gatewayMint` phải có destination native gas. Payna check điều này trước burn. Với transfer về address của user, SCA là minter wallet; với external recipient, Gateway signer là transaction submitter. Recipient vẫn nhận USDC.

Manual mode chờ attestation/signature, submit destination contract call và trả `mintTxHash`. Hash đó trở thành `destinationTxHash`; `forwardingDetails` có thể absent. Nếu destination gas không verify được, Payna dừng trước burn bằng `DESTINATION_GAS_CHECK_UNAVAILABLE` thay vì lấy source balance vào path chưa thể execute.

Manual có thể giảm USDC quote nhưng không tự động rẻ hơn. Hãy so destination native gas, operational complexity, SDK support và failure recovery bên cạnh displayed Gateway fee.

## Chọn mode

Chọn auto forwarding khi destination wallet thiếu native gas, route được Circle forwarding support hoặc simpler settlement đáng giá theo USDC quote. Chọn manual khi designated minter đã có destination gas ổn định và preview xác nhận usable route.

Với cả hai transfer mode, kiểm tra source, destination, recipient, source debit và quote type. `/gas check <chain>` giúp inspect balance, còn transfer estimate và confirmed execution response xác định wallet role nào cần gas. Same-chain route không tự bị ép sang manual; Payna giữ selected mint mode.

## Failure và retry checklist

- Quote unavailable: transfer preview chưa làm stateful work; confirmed withdrawal có thể đã initialize signer, nhưng ở thời điểm này cả hai path chưa submit burn intent.
- Source balance thiếu: tính cả fee rồi chờ hoặc tạo same-source deposit.
- Source gas thiếu: fund SCA cho named delegate/deposit operation.
- Manual destination gas thiếu: fund identified SCA/signer hoặc đổi mode rồi re-estimate.
- Forwarded transfer đã submit: giữ `transferId`; inspect Circle status trước retry.
- Manual attestation đã nhận: kiểm tra destination mint transaction/challenge đã tồn tại chưa.
- Receipt mismatch: ưu tiên settled `fees.total` và destination hash đúng mode.
- Support request: chỉ gửi public identifier, không gửi key, credential hay private RPC configuration.
