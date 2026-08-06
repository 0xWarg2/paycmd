---
slug: "circle/gateway/transfer"
title: "Gateway transfer"
description: "Ưu tiên scoped source, sau đó chọn rõ deposit hoặc phân bổ BurnIntentSet qua nhiều Gateway source."
section: "circle.gateway"
order: 23
lastUpdated: "2026-08-05"
keywords: ["transfer", "burn intent set", "unified gateway", "source allocation", "fee"]
tutorial: true
aiSummary:
  - "`/transfer 5 from base to arc` vẫn source-scoped. Nếu ready balance thiếu, Payna cho chọn minimum deposit hoặc unified BurnIntentSet; không auto-deposit."
  - "Unified preview hiện từng allocation, maximum fee reserve và maximum debit, rồi bind confirmation với fingerprint của quote mới nhất."
---

## Mô hình scoped-first

Dùng `/transfer 10 from base to arc` để chỉ tiêu Gateway balance trên Base. Lệnh này ký một `BurnIntent` và không âm thầm lấy domain khác. Dùng `/transfer 10 from gateway to arc` để yêu cầu unified allocation ngay. `/pay 10 to Minh on arc from gateway` dùng cùng transfer engine sau khi Payna resolve recipient.

Con số 16 không có nghĩa Circle chỉ hỗ trợ đúng 16 chain. `BurnIntentSet` EVM của Circle nhận **tối đa 16 intent trong một transfer**. Payna tìm eligible source trong testnet Gateway matrix hiện hỗ trợ; sản phẩm chạy trên Arc Testnet nhưng source intent có thể thuộc Gateway testnet domain khác.

## Khi scoped source không đủ

Preview so ready Gateway balance của source với `amount + maximum fee reserve`. Nếu thiếu, nút transfer thường bị khóa và Payna đưa hai lựa chọn:

1. **Deposit vào source này.** Payna đề xuất đúng minimum shortfall. User được sửa amount nhưng không được thấp hơn minimum. Confirm chỉ tạo action `/deposit`. Sau Gateway finality phải preview transfer lại; Payna không tự gửi payment.
2. **Dùng Unified Gateway.** Payna lấy multi-source quote và mở bảng chọn source. Path này chỉ dùng ready Gateway balance, tuyệt đối không auto-deposit từ SCA.

Deposit panel nêu source, minimum amount, yêu cầu SCA USDC, source gas và finality boundary. Trong thời gian **pending finality**, deposit phải được reconcile, không submit lặp.

## Bảng unified allocation

Mỗi row hiển thị source chain, ready balance, amount đề xuất, maximum fee reserve theo intent, maximum debit, delegate status và lý do ưu tiên. Đổi checkbox sẽ lấy quote mới.

Payna xếp source theo dữ liệu quote hiện tại:

1. quoted cost theo source thấp hơn;
2. nếu bằng nhau, usable capacity (`ready balance - maxFee`) lớn hơn để giảm số intent;
3. deterministic source order để kết quả ổn định.

Sau sorting, allocator greedy fill. Một intent chỉ đóng góp tối đa `balance - maxFee`; fee reserve không được tính là transferable value. Payna không tạo quá 16 intent. Nếu set vẫn thiếu, `GATEWAY_INSUFFICIENT_UNIFIED_BALANCE` trả ready balance, maximum usable capacity, shortfall và exclusions. Nó không tạo deposit.

## Estimate, fee và fingerprint

Preview là read-only. Payna dùng Gateway signer multichain hiện có hoặc SCA address làm placeholder chỉ để quote fee. Preview không tạo wallet, add delegate, deposit, sign hay submit transfer.

Với set, Payna gửi một partial object có `intents[]` tới [`/v1/estimate`](https://developers.circle.com/api-reference/gateway/all/estimate-transfer). Circle trả `burnIntentSet.intents[]`, mỗi intent có `maxBlockHeight` và `maxFee`. Payna hiển thị:

- `fees.total` là estimated total fee tại thời điểm quote nếu Circle cung cấp;
- `maxFee` từng intent là signed maximum reserve;
- tổng `maxFee` là maximum fee reserve, không phải expected charge;
- `amount + sum(maxFee)` là maximum debit.

Không hard-code bảng phí. Base fee, transfer fee, forwarding fee và destination execution condition có thể đổi. Fingerprint cover amount, destination, mint mode, source allocation, value và maximum fee. Execution quote lại; economic allocation thay đổi sẽ trả `GATEWAY_QUOTE_CHANGED`. Execution dùng `maxBlockHeight` mới mà không false mismatch chỉ vì block đã tăng.

## Consent delegate persistent

Mọi intent dùng cùng một multichain EOA `sourceSigner` và một chữ ký EIP-712 chung. Signer phải được authorize cho USDC balance của SCA depositor trên từng selected source.

`addDelegate` là permission persistent nên lần đầu Payna hỏi riêng. Action **Ủy quyền các source đã chọn** chỉ tạo signer sau valid quote, check source gas, submit zero-value delegate theo deterministic order và trả `pending_gateway_finality`. Nó không burn một phần set. Khi authorization visible, preview lại.

Source đã authorize vẫn có thể dùng dù Circle Wallet SDK hiện tại không submit được delegate mới trên chain đó. Source chưa authorize và SDK hiện tại không authorize được sẽ bị exclude kèm lý do; Payna không âm thầm tính balance đó.

## EIP-712 BurnIntentSet và một transfer ID

Sau final confirmation, Payna tạo salt mới, ký một EIP-712 `BurnIntentSet` và submit:

```json
[{ "burnIntentSet": { "intents": ["..."] }, "signature": "0x..." }]
```

Mỗi intent constrain source domain, depositor, token, value, destination, recipient, signer, `maxBlockHeight` và `maxFee`. Chữ ký chung chứng minh signer approve toàn set dưới dạng structured message; đổi bất kỳ signed field nào làm signature invalid.

Circle trả một `transferId`. Cùng attestation bytes dùng được cho manual `gatewayMint` hoặc Forwarding Service. Settlement/poll vẫn theo một ID dù nhiều source domain cùng fund transfer.

## Manual mint và forwarding

Mint capability nằm ở destination. Auto forwarding dùng `enableForwarder=true`; Circle lấy forwarding cost từ `maxFee` headroom theo thứ tự intent và có thể tiếp tục sang intent sau. Payna poll một transfer ID và yêu cầu forwarded destination transaction hash hợp lệ.

Manual mode dùng attestation/signature để gọi `gatewayMint` và cần destination native gas từ SCA hoặc signer được chỉ định. Nếu Circle Wallet SDK hiện tại không support manual mint ở destination, Payna chỉ cho forwarding. Manual limitation của source chain không tự làm invalid ready balance đã authorize vì mint diễn ra ở destination.

## Receipt, history và retry safety

Unified result gồm `sourceMode: unified`, `sourceAllocations`, total estimated fee, maximum fee reserve, actual fee khi Circle settle, một transfer ID và destination hash theo mode. History lưu `chain: gateway`, `source_mode: unified` và allocation JSON; Activity UI mở rộng các source đóng góp.

Trước khi có transfer ID, refresh quote thay đổi hoặc hoàn tất deposit/delegate được yêu cầu. Sau khi có transfer ID, inspect Circle status trước retry. Timeout sau submission không chứng minh chưa burn, và Payna không tự fallback forwarding sang manual mint.

Các response thường gặp:

- `GATEWAY_INSUFFICIENT_SCOPED_BALANCE`: chọn deposit hoặc unified allocation.
- `GATEWAY_INSUFFICIENT_UNIFIED_BALANCE`: giảm amount hoặc chọn thêm usable source; không có deposit nào được tạo.
- `GATEWAY_DELEGATE_REQUIRED`: authorize rõ các persistent delegate; chưa submit partial burn.
- `GATEWAY_QUOTE_CHANGED`: review allocation/fingerprint mới.
- `GATEWAY_FEE_ESTIMATE_UNAVAILABLE`: Circle không trả safe quote; preview không mutate wallet/balance.
- `GATEWAY_FORWARDING_FAILED`: giữ transfer ID và reconcile settlement trước retry.
