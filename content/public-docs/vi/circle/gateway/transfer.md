---
slug: "circle/gateway/transfer"
title: "Gateway transfer"
description: "Chuyển USDC cross-chain từ một source domain được chỉ định."
section: "circle.gateway"
order: 23
lastUpdated: "2026-08-05"
keywords: ["transfer", "burn intent", "mint", "source-scoped", "fee"]
tutorial: true
aiSummary:
  - "Payna estimate trước, rồi yêu cầu amount cộng fee trên named source domain trước khi authorize và ký một burn intent."
  - "Ví dụ `/transfer 5 from base to arc` chỉ tiêu ready balance trên Base; auto forwarding và manual mint tạo destination result khác nhau, và sau submission phải kiểm tra status trước khi retry."
---

## Command syntax và source selection

Dùng `/transfer 10 from base to arc`. Required field gồm positive USDC amount, source chain rõ ràng sau `from` và destination rõ ràng sau `to`. USDC hỗ trợ tối đa sáu chữ số thập phân. Payna mặc định `auto_forwarding`; thêm `manual`, `manual gas`, `no forwarding` hoặc `without forwarding` để yêu cầu manual mint mode.

**Current Payna implementation behavior là source-scoped.** Chain sau `from` trở thành `sourceDomain` duy nhất trong một burn intent. Payna không âm thầm aggregate ready balance từ nhiều domain, dù Circle Gateway protocol có thể nhận multiple burn intent và cung cấp unified cross-chain balance. `/transfer 5 from base to arc` vì thế chỉ tiêu ready Gateway balance của SCA depositor trên Base.

Destination có thể bằng source ở API level, nhưng người dùng muốn đưa USDC về SCA của mình nên dùng `/withdraw`. Lệnh đó có same-domain flow bị giới hạn và receipt rõ hơn.

## Estimate trước mutation

Payna tạo read-only burn-intent preview rồi gọi endpoint `/v1/estimate` của Circle trước khi tạo Gateway signer, authorize delegate, auto-deposit hoặc ký burn intent. Fee calculation không phụ thuộc signer address nên SCA address hiện có có thể làm placeholder trong estimation. Nếu Circle không trả usable quote, Payna dừng với `GATEWAY_FEE_ESTIMATE_UNAVAILABLE`; nó không mutate wallet hay balance state.

Với auto forwarding, request gồm `enableForwarder=true`. Trong cả hai mint mode, shared response parser của Payna ưu tiên decimal `fees.total` từ Circle làm quoted total. Nếu field đó unusable và first returned burn intent có positive atomic `maxFee`, parser nhận nó làm reserve. Bản thân parser không enforce mode cho fallback này. Preview expose `feeEstimateKind` là `quoted_total` hoặc `max_fee_reserve` để caller không gọi reserve là settled charge. Circle mô tả estimate request trong [Gateway API reference](https://developers.circle.com/api-reference/gateway/all/estimate-transfer).

## Preview và confirmation

Trước confirm, hãy review:

- `amount`, `sourceChain` và `destinationChain`;
- destination `recipient`, nhất là khi khác SCA của người dùng;
- `estimatedGatewayFee` và `requiredGatewayBalance`;
- `feeEstimateKind`, `mintGasMode` và trạng thái `forwarding`;
- proposed auto-deposit amount và wallet phải trả source gas;
- yêu cầu destination gas của manual mode.

Source cần **`amount + estimated fee`**, không chỉ displayed transfer amount. Preview là point-in-time estimate, không hứa fee cố định vĩnh viễn. Execution không được tiếp tục khi quote missing hoặc malformed.

Confirmation authorize các stateful step tiếp theo. Kiểm tra đầy đủ external address từng ký tự hoặc dùng trusted contact. Address đúng EVM shape vẫn có thể là recipient sai, và destination mint không thể được Payna đảo ngược.

## Balance, signer và gas preflight

Sau valid estimate, Payna tìm hoặc tạo source-chain Gateway signer. Nó đọc Gateway entry của SCA depositor cho đúng selected source domain và so sánh với `amount + fee`.

Khi auto-deposit bật, shortfall có thể được bù từ same-chain SCA USDC. Payna trước hết tìm existing deposit trong finality để không submit deposit khác. Nếu không có pending deposit, nó check SCA USDC và source native gas, submit đúng missing amount, lưu hash thành `pending_gateway_finality`, rồi thường trả retry instruction. Transfer không thể burn amount mới đến khi ready.

Manual mode thực hiện destination gas preflight trước khi burn. Khi gửi cho wallet của người dùng, SCA sẽ mint; với external recipient, destination Gateway signer của Payna thực hiện mint. Wallet liên quan phải có native gas và current Circle Wallet SDK phải support destination. Auto forwarding tránh user-supplied destination gas, nhưng source-side delegate hoặc auto-deposit vẫn có thể cần native gas.

## Burn intent và Gateway acceptance

Payna kiểm tra EOA signer có được authorize cho token balance của SCA depositor không. Nếu chưa, SCA submit `addDelegate` transaction với zero deposit amount và Payna trả `pending_gateway_finality`; chỉ retry sau khi authorization visible. Nếu authorization read fail, Payna có thể thử burn rồi xử lý not-authorized result rõ ràng từ Circle.

Signer ký EIP-712 data chứa source/destination domain, source depositor, signer, recipient, token contract, transfer amount, maximum fee, salt và constraint khác. Payna đặt quote làm `maxFee`, submit signed request tới `/v1/transfer`, rồi nhận transfer ID cùng attestation data hoặc forwarding state. [Technical guide](https://developers.circle.com/gateway/references/technical-guide#instant-transfer) của Circle giải thích burn-intent và attestation protocol.

Gateway acceptance là state-change boundary. Khi đã có transfer ID, không coi network error sau đó là bằng chứng chưa có gì xảy ra.

## Destination mint và forwarding result

Trong default `auto_forwarding`, Circle Forwarding Service xử lý destination mint. Payna poll `/v1/transfer/{transferId}` đến khi status là `confirmed` hoặc `finalized`; `failed` và `expired` là terminal error. Settled response thành công phải có valid destination transaction hash ở `forwardingDetails.transactionHash`. Payna trả forwarding details, settled fee khi có và normalize hash thành `destinationTxHash`. [Forwarding Service how-to](https://developers.circle.com/gateway/howtos/forwarding-service) chính thức mô tả poll-to-settlement flow.

Trong `manual`, Payna chờ attestation và signature rồi gọi `gatewayMint` ở destination. Circle transaction kết quả cung cấp `mintTxHash`, cũng trở thành normalized `destinationTxHash`. Với recipient của người dùng, SCA submit mint; với external recipient, Gateway signer wallet của user submit. Transaction submitter này không phải recipient và không sở hữu USDC được mint.

## Receipt và history field

Successful API result có thể gồm `transferId`, `fees`, `actualGatewayFee`, `actualSourceDebit`, `estimatedGatewayFee`, `requiredGatewayBalance`, `feeEstimateKind`, `forwarding`, `mintGasMode`, `forwardingDetails`, `mintTxHash`, `destinationTxHash`, auto-deposit field, source, destination, amount, recipient và source SCA address.

Khi Circle trả settled `fees.total`, Payna báo actual Gateway fee và tính `actualSourceDebit = amount + actual fee`. Initial estimate vẫn hữu ích để so sánh nhưng không được trình bày như actual. Trong history, Payna ghi source chain, destination chain, amount, success state và normalized destination hash. Nó có thể ghi RA proof metadata; proof failure được báo riêng và không đảo ngược Gateway transfer đã hoàn tất.

Auto forwarding thường không có Payna-submitted `mintTxHash`; destination evidence là forwarded hash. Manual mint có `mintTxHash` và có thể không có forwarding details. UI không được bắt buộc cả hai.

## Kiểm tra external recipient

Trước transfer đến external address:

1. Xác nhận destination chain hỗ trợ operation dự kiến của Payna, không chỉ được Gateway listed.
2. Xác minh recipient là address cho destination, không phải source-chain contract copy nhầm.
3. Quyết định ai execute mint. Manual external mint dùng Gateway signer và cần destination native gas; auto forwarding thì không.
4. Xác nhận recipient dùng được USDC trên network đó.
5. Chạy test amount nhỏ nếu operational risk cần, nhớ rằng mỗi attempt có fee riêng.

Payna hiện target EVM chain trong generated matrix. Không suy Solana recipient setup behavior từ protocol documentation rộng hơn của Circle.

## Các failure thường gặp

**Insufficient Gateway balance:** selected source entry không đủ `amount + fee`. Chờ existing deposit, cho phép same-source auto-deposit, giảm amount hoặc chọn rõ source khác đã funded.

**Quote failure:** Circle trả error hoặc không có usable `fees.total`/reserve. Signer creation hay balance mutation chưa nên xảy ra. Chờ rồi request fresh preview.

**Source gas failure:** SCA không authorize signer hoặc auto-deposit được. Fund native gas trên source wallet được nêu trong response.

**Destination gas failure:** manual mint không thể attempt an toàn. Fund SCA/Gateway signer được preflight chỉ ra, hoặc lấy auto-forwarding preview mới.

**Pending finality:** deposit hay delegate transaction đã submit nhưng chưa usable. Giữ hash và chỉ chạy provided retry command sau readiness.

**Forwarding settlement failure:** Circle đã accept forwarded request nhưng Payna chưa quan sát destination result thành công. Đây không phải điểm an toàn để blind resubmit.

## Retry safety

Trước quote hoặc trước khi có transaction hash/transfer ID, sửa input rồi retry thường an toàn. Sau khi có auto-deposit/delegate hash, reconcile transaction đó và chờ finality thay vì lặp. Sau khi có transfer ID, kiểm tra `/v1/transfer/{id}`, `forwardingDetails.failureReason` và destination hash.

Payna cố ý không auto-fallback từ failed forwarding sang manual mint và không auto-retry submitted transfer. Cả hai có thể duplicate delivery nếu request đầu settle muộn. Khi escalate, giữ original source, destination, recipient, amount, mint mode, quote, transfer ID và hash. Không gửi private key hoặc API secret.
