---
slug: "circle/gateway/overview"
title: "Circle Gateway trong Payna"
description: "Mental model và luồng unified USDC của Circle Gateway."
section: "circle.gateway"
order: 20
lastUpdated: "2026-08-05"
keywords: ["Circle Gateway", "SCA", "signer", "depositor", "unified"]
tutorial: true
aiSummary:
  - "Payna tách ba vai trò: Circle SCA giữ USDC on-chain, depositor sở hữu balance theo domain trong Gateway, còn EOA được delegate ký burn intent."
  - "Gateway có thể biểu diễn unified cross-chain balance, nhưng lệnh transfer hiện tại của Payna chỉ tiêu từ source domain được chọn rõ ràng."
---

Circle Gateway là hệ thống thanh khoản USDC non-custodial gồm Gateway Wallet contract ở source chain, Gateway Minter contract ở destination chain và dịch vụ Gateway off-chain của Circle. Người dùng deposit trước rồi chờ source-chain finality. Sau khi hoàn tất thời gian chờ này, một transfer hợp lệ đã ký có thể nhận attestation và mint USDC ở destination mà không phải chờ source finality giữa luồng transfer. Đây là protocol model trong [Gateway overview](https://developers.circle.com/gateway) và [technical guide](https://developers.circle.com/gateway/references/technical-guide) chính thức của Circle.

Payna bao quanh model đó bằng command, preview, managed wallet, history và recovery. Lớp ứng dụng không xóa các ranh giới protocol. Đặc biệt, **Circle SCA wallet không phải Gateway balance**. Việc thấy USDC trong SCA không có nghĩa số đó có thể cấp vốn ngay cho Gateway transfer.

## Ba vai trò wallet

**Circle SCA wallet** là application wallet của người dùng. Nó giữ USDC on-chain thông thường trước deposit, gửi các contract call approval và `deposit`, trả native gas cho các Circle wallet transaction đó và nhận Payna withdrawal. Trong flow deposit hiện tại, nó cũng là depositor vì SCA gọi `GatewayWallet.deposit`.

**Gateway depositor** là địa chỉ được Gateway ghi nhận balance theo token và domain. Đây là chủ balance, không phải một loại wallet riêng do Payna đặt ra. Circle theo dõi balance theo tổ hợp chain/domain, token và depositor address. Trong deposit hiện tại của Payna, địa chỉ đó là SCA. Deposit do địa chỉ khác gửi sẽ được credit cho caller đó, trừ khi dùng protocol method deposit rõ ràng cho người khác.

**Gateway signer** là Circle-managed EOA được dùng như authorized delegate. Payna tạo hoặc tìm signer cho chain liên quan rồi để SCA authorize nó. Signer ký EIP-712 burn intent; signer không tự động sở hữu USDC đã deposit. Ranh giới này quan trọng khi chẩn đoán balance: chỉ query signer có thể trả về zero dù SCA depositor có ready balance. Circle mô tả delegate và yêu cầu riêng cho SCA trong [technical guide](https://developers.circle.com/gateway/references/technical-guide#delegates).

Không công khai seed phrase, private key, API credential hoặc RPC secret khi xác định các vai trò này. Public address, domain number, transaction hash hoặc transfer ID thường đã đủ cho support.

## Luồng Gateway hoàn chỉnh của Payna

Lifecycle thông thường là:

1. `/fund 10 from metamask on base` chuyển USDC từ MetaMask sang Circle SCA. Lệnh này chưa deposit vào Gateway.
2. `/deposit 10 from base` khởi tạo hoặc tìm signer, authorize Gateway contract tiêu USDC của SCA, gửi deposit từ SCA và ghi transaction hash.
3. Payna đánh dấu transaction `pending_gateway_finality`. On-chain confirmation của deposit đã gửi chưa chứng minh Circle đã credit ready balance.
4. Circle quan sát deposit đã finalized. Completion path chính của Payna là webhook đã ký `gateway.deposit.finalized`; reconciliation sync là recovery path.
5. `/transfer 5 from base to arc` estimate fee, kiểm tra Base Gateway balance đã chọn có đủ `amount + fee`, bảo đảm signer authorization, ký một burn intent rồi request Gateway transfer.
6. Auto forwarding yêu cầu Circle Forwarding Service thực hiện destination mint. Manual mode nhận attestation rồi Payna gửi mint bằng Circle wallet phù hợp.
7. `/withdraw 2 from base` dùng same-domain burn-and-mint để đưa USDC về Base SCA balance của người dùng.

Mỗi transition có retry boundary khác nhau. Draft hoặc quote thất bại chưa chuyển tiền. Deposit, delegate transaction, burn intent hoặc forwarding request đã submit có thể đã đổi state và phải được kiểm tra bằng identifier trước khi retry.

## Unified balance có nghĩa gì

Ở protocol level, finalized deposit của một depositor có thể tạo unified balance dùng cho transfer đến destination được hỗ trợ. Protocol của Circle hỗ trợ nhiều burn intent và intent set có thể lấy từ nhiều source domain. Unified model nghĩa là integration có thể làm deposited liquidity khả dụng cross-chain; nó không biến USDC chưa deposit trong wallet thành một phần Gateway ledger.

Response `/v1/balances` của Gateway là ready balance đã ghi nhận. `/v1/deposits` xác định deposit đã được quan sát nhưng chưa process. Circle chờ số confirmation cần thiết trước khi cập nhật unified balance; yêu cầu khác nhau theo network và được liệt kê trong [Gateway supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains).

## Payna total balance có nghĩa gì

Payna còn trình bày một total phục vụ visibility rộng hơn. Nó cộng các SCA USDC read on-chain thành công với ready Gateway balance. Con số này trả lời “Payna hiện nhìn thấy bao nhiêu USDC ở hai location này?” Nó không phải pool on-chain mới và không cấp cho Gateway quyền tiêu phần SCA.

Nếu RPC hoặc Gateway API thất bại, Payna đánh dấu kết quả partial. Partial total là lower bound, không phải bằng chứng chain bị thiếu có zero. Tương tự, deposit ở giữa on-chain submission và Gateway finality có thể tạm thời vắng ở cả SCA balance đã giảm và Gateway ready response. Hãy dùng transaction state thay vì coi chênh lệch hiển thị tạm thời là mất tiền.

## Tại sao transfer vẫn source-scoped

**Current Payna implementation behavior:** `/transfer <amount> from <source> to <destination>` tạo một burn intent với một `sourceDomain`. Payna query ready balance của depositor trên source đó và yêu cầu đủ `amount + estimated fee`. Nó không âm thầm tạo multi-source intent set hoặc tiêu domain khác.

Phạm vi này hẹp hơn unified capability của Circle protocol. Đây là product behavior có chủ ý hiện tại: preview, signer authorization, gas check, history và retry command đều giữ source rõ ràng. Thiếu trên Base không được tự bù bằng ready balance trên Arc. Hãy chọn Arc làm source hoặc deposit đủ finalized USDC trên Base.

## Ví dụ balance trên hai domain

Giả sử Payna đọc được các giá trị sau cho cùng một SCA depositor:

| Location | Base | Arc | Total riêng |
| --- | ---: | ---: | ---: |
| SCA USDC on-chain | 12 | 7 | 19 USDC |
| Gateway USDC ready | 4 | 9 | 13 USDC |

Circle Gateway visibility của depositor là **13 USDC ready**. Visible total rộng hơn trong Payna là **19 + 13 = 32 USDC**. Payna không gọi 19 USDC trong SCA là deposited Gateway liquidity.

Với `/transfer 5 from base to arc`, quote 0.02 USDC làm yêu cầu trên Base thành 5.02 USDC. Tổng Gateway ready là 13, nhưng Base chỉ có 4, vì vậy behavior hiện tại sẽ reject hoặc đề xuất auto-deposit từ Base SCA. Payna không lấy 1.02 còn thiếu từ 9 USDC trên Arc. Transfer dùng Arc làm source có thể qua balance check, nhưng vẫn cần route quote mới và các prerequisite khác.

## Checklist state và safety

- Xác nhận địa chỉ nào là SCA depositor và địa chỉ nào chỉ là delegated signer.
- Xem `submitted` và `pending_gateway_finality` là waiting state, không phải ready balance.
- Khớp chain sau `from` với domain có đủ ready balance cho `amount + fee`.
- Đọc partial balance là “ít nhất bằng số này”, rồi retry chain lookup đã fail.
- Kiểm tra recipient, source, destination, mint mode, estimated fee và required source debit trước confirm.
- Sau lỗi transfer đã submit, giữ transfer ID và transaction hash; xem status trước retry.
- Không bao giờ gửi USDC bằng ERC-20 `transfer` thông thường vào Gateway Wallet contract. Circle cảnh báo cách này không credit unified balance và có thể làm mất tiền.

## Official reference liên quan

- [Circle Gateway overview](https://developers.circle.com/gateway) — mục đích protocol và unified cross-chain balance.
- [Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide) — contract, balance, deposit, transfer, withdrawal và delegate.
- [Gateway supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains) — domain identifier và required confirmation.
- [Gateway fees](https://developers.circle.com/gateway/references/fees) và [Forwarding Service](https://developers.circle.com/gateway/references/forwarding-service) — thành phần protocol fee và destination forwarding.
- [Gateway webhook events](https://developers.circle.com/gateway/references/webhook-events) — schema finalized deposit và mint event.
