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
  - "Lệnh /withdraw của Payna burn ready Gateway balance và mint về SCA của người dùng trên same domain, cần amount cộng fee và gas cho SCA mint."
  - "Application path này khác delayed trustless withdrawal mechanism ở protocol level của Gateway."
---

## Payna withdraw làm gì

`/withdraw 5 from base` trả USDC từ ready Gateway balance của SCA depositor trên Base về Circle SCA của chính người dùng cũng trên Base. Source và destination domain giống nhau, recipient cố định là SCA address. Đây không phải bridge sang chain khác và không nhận external recipient.

**Current Payna implementation behavior:** withdraw dùng Gateway transfer API với same-domain burn intent, chờ attestation rồi submit `gatewayMint` qua Circle SCA. Sau success, amount là SCA on-chain USDC thông thường và không còn thuộc ready Gateway balance.

Circle còn mô tả on-chain trustless withdrawal mechanism có initiation transaction và delay khi API không khả dụng. Đó là protocol capability khác trong [Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide#withdrawal). Command `/withdraw` ở đây là application-managed same-domain transfer path, không phải delayed trustless path.

## Command và amount validation

Syntax là `/withdraw <amount> from <source>`, ví dụ `/withdraw 5.25 from base`. Amount phải là positive USDC với tối đa sáu chữ số thập phân. Payna reject missing field, unsupported chain alias, zero/negative value, malformed decimal và value vượt safety ceiling trước execution.

Command không ngầm withdraw “all” và không suy source từ visible total lớn nhất. Hãy chỉ rõ domain đang có ready liquidity trong Gateway row. Vì current Payna selection là source-scoped, thiếu trên Base không được bù bằng Gateway balance trên Arc.

## Prerequisite

Trước khi confirmed withdrawal execution có thể hoàn tất:

- user phải có Circle SCA wallet và address;
- selected chain phải vừa nằm trong Gateway configuration của Payna vừa operable qua current Circle Wallet SDK;
- SCA depositor phải có finalized Gateway ready balance trên domain đó;
- Gateway signer liên quan phải tồn tại và authorized, hoặc SCA phải có gas để authorize;
- SCA phải có native gas trên same domain để execute destination mint;
- estimate và transfer API của Circle phải available.

Pending deposit chưa ready. `/withdraw` không auto-deposit hoặc dùng SCA USDC bù Gateway shortfall vì như vậy fund đi ngược hướng.

Đây là execution prerequisite, không phải check đã được command preview chứng minh. Current preview không gọi withdraw route để inspect signer, quote, balance, authorization hay gas.

## Fee và balance validation

Sau khi user confirm, Payna resolve Circle SCA rồi tìm hoặc tạo Gateway signer. Tiếp theo nó tạo same-domain burn-intent preview cho Circle estimate, tính `requiredGatewayBalance = amount + estimatedGatewayFee`, rồi đọc Gateway balance của SCA depositor trên đúng selected domain.

Nếu row thiếu, Payna trả `INSUFFICIENT_GATEWAY_BALANCE` cùng current balance, amount, fee và total required. Hãy giảm amount hoặc chờ existing deposit finalize. Không chỉ so amount với balance; Gateway fee được collect từ source và cũng phải vừa.

Estimate không phải settled receipt. Circle giải thích burn intent `maxFee` cover protocol gas và transfer fee, forwarding fee chỉ thêm khi dùng forwarding; xem [Gateway fees](https://developers.circle.com/gateway/references/fees). Withdraw path của Payna không enable forwarding nhưng vẫn cần usable quote.

## Preview và confirmation

**Current Payna UI boundary:** withdrawal preview xác nhận amount, selected source và recipient là Circle SCA của user trên same domain. Nó chưa hiển thị runtime fee estimate hoặc required Gateway balance, inspect mint gas, tạo/tìm signer hay check delegate authorization. Các operation này chỉ bắt đầu sau khi user confirm và Payna gọi withdrawal route.

Kiểm tra kỹ amount/source và hiểu recipient role là same-domain SCA, không phải MetaMask hay signer EOA. Confirmation cho phép Payna bắt đầu execution check; nó không chứng minh fee, ready balance, native gas hoặc signer authorization sẽ pass. Execution trả resolved SCA address hoặc specific error sau các check đó.

## Signer authorization và pending state

Payna tìm hoặc tạo Gateway signer trước final burn request. Nó check `isAuthorizedForBalance(token, depositor, signer)` trên selected chain. Nếu authorization rõ ràng false, SCA submit `addDelegate` call không kèm deposit amount, rồi Payna trả `GATEWAY_FINALITY_PENDING` với transaction hash và retry command.

Người dùng nên chờ authorization observable rồi retry cùng withdrawal. Submit lặp delegate call không làm finality nhanh hơn và tốn source gas. Nếu authorization lookup fail, Payna có thể thử burn và chuyển response “signer not authorized” của Circle thành cùng pending guidance.

## Burn và same-domain mint

Khi prerequisite pass, delegated EOA ký burn intent có source/destination domain giống nhau, source depositor và destination recipient đều là SCA, `maxFee` là estimate. Payna submit tới Circle Gateway rồi chờ attestation và signature.

Sau đó Payna yêu cầu Circle SCA execute `gatewayMint(bytes,bytes)` trên same chain. SCA cần native gas. Final mint transaction này giải thích vì sao user có nhiều Gateway USDC vẫn có thể nhận `INSUFFICIENT_GAS`. Nạp đúng SCA address và network trong error; USDC không tự là native gas token trên mọi supported chain.

## Expected receipt và balance change

Successful response gồm `success`, `transferId`, `mintTxHash`, `amount`, `chain`, `recipient` và `estimatedGatewayFee`. Payna ghi history row type `withdraw`, source/destination chain giống nhau, amount, success state và mint transaction hash.

Sau balance refresh, selected Gateway ready row phải giảm theo amount cộng actual fee Gateway áp dụng, còn SCA on-chain USDC tăng bằng minted amount. Hai read có thể update khác thời điểm. Dùng transfer ID và mint hash làm evidence nếu total tạm thời chưa khớp.

Response hiện tại báo pre-execution estimate chứ chưa có settled-fee field riêng. Interface phải label là estimated và tránh hứa đó là exact final charge.

## Error và safe retry

**Invalid amount hoặc chain:** không nên có stateful work; sửa command.

**Quote unavailable:** sau confirmation, Payna có thể đã tạo hoặc lookup signer nhưng chưa submit burn intent. Hãy chờ rồi confirm một execution attempt mới.

**Insufficient ready balance:** chờ đúng pending deposit hoặc giảm amount. Không deposit lại khi chưa check hash.

**Thiếu source/mint gas:** fund native gas vào SCA address trên selected chain.

**Authorization pending:** giữ delegate transaction hash và chỉ retry sau khi confirmed/indexed.

**Error sau khi đã có transfer ID hoặc mint challenge:** inspect identifier trước retry. API timeout không chứng minh burn/mint fail. Blind repetition có thể tạo debit request khác.

Khi cần support, cung cấp public SCA address, domain, transfer ID và transaction hash. Không cung cấp private key, seed phrase, Circle API key hoặc private RPC URL.
