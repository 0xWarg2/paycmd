---
slug: "commands/gateway"
title: "Circle Gateway commands"
description: "Reference cho deposit, withdraw, transfer, gas và gateway."
section: "commands"
order: 61
lastUpdated: "2026-08-05"
keywords: ["deposit", "withdraw", "transfer", "gas", "gateway"]
commands: ["deposit", "withdraw", "transfer", "gas", "gateway"]
tutorial: true
aiSummary:
  - "Gateway command gồm /deposit, /withdraw, /transfer, /gas và /gateway; transfer scoped-first và có explicit fallback sang unified BurnIntentSet."
---

## `/deposit`

- **Mục đích:** Chuyển USDC từ Circle SCA vào Gateway depositor balance trên một source domain.
- **Syntax và variants:** `/deposit <amount> [USDC] from <source-chain>`; amount phải dương với tối đa sáu decimals.
- **Ví dụ:** `/deposit 50 from base`; natural language: “Deposit 50 Base USDC vào Gateway.”
- **Điều kiện:** Có SCA, đủ SCA USDC theo chain, native gas cho delegate/approval/deposit và chain được Gateway/Wallet SDK hỗ trợ.
- **Preview:** Kiểm tra amount, token, source, SCA/depositor, rail và gas. Preview không khẳng định funds ready.
- **Ranh giới confirm:** Payna confirmation authorize Circle-wallet contract execution; MetaMask không phải signer. Delegate và approval có thể xảy ra trước deposit call cuối.
- **Kết quả và dữ liệu lưu:** Confirmed hash được lưu ở `pending_gateway_finality`, kèm block data nếu có. Chỉ thành `success` sau webhook hoặc recovery sync evidence đã verify.
- **Lỗi và cách sửa:** **“Insufficient USDC balance”**: `/fund` SCA trước. **“Insufficient gas or gas estimation failed”**: nạp native gas cho SCA được nêu. **`GATEWAY_FINALITY_PENDING`**: chờ/sync hash cũ; không deposit lặp. Xem [deposit và finality](/docs/circle/gateway/deposit-and-finality).

## `/withdraw`

- **Mục đích:** Burn ready Gateway USDC trên source domain và mint requested amount về SCA trên chính domain đó.
- **Syntax và variants:** `/withdraw <amount> [USDC] from <source-chain>`.
- **Ví dụ:** `/withdraw 5 from base`; natural language: “Trả 5 Base Gateway USDC về SCA.”
- **Điều kiện:** Có SCA, authorized signer, source balance đủ amount cộng quoted fee và destination mint gas trong wallet Payna nêu.
- **Preview:** Review amount, source, same-domain SCA recipient và rail. Preview chưa fetch fee; execution quote sau confirm và trả required balance.
- **Ranh giới confirm:** Payna confirmation bắt đầu signer initialization, estimate, checks, burn intent, attestation và manual mint; MetaMask không ký.
- **Kết quả và dữ liệu lưu:** Kết quả gồm transfer ID, fee/source debit, mint hash, wallet và row history `withdraw`.
- **Lỗi và cách sửa:** **`INSUFFICIENT_GATEWAY_BALANCE`**: giảm amount hoặc deposit rồi chờ finality. **`INSUFFICIENT_GAS`**: nạp đúng SCA/signer. **“Gateway attestation missing”**: giữ transfer ID và reconcile trước retry. Xem [withdraw](/docs/circle/gateway/withdraw).

## `/transfer`

- **Mục đích:** Chuyển scoped Gateway USDC hoặc combine ready balance có chủ đích bằng một BurnIntentSet.
- **Syntax và variants:** `/transfer <amount> [USDC] from <source> to <destination> [manual]`; `/transfer <amount> from gateway to <destination> [manual]` vào unified mode ngay.
- **Ví dụ:** `/transfer 10 from base to arc`; nếu Base thiếu, chọn minimum deposit được đề xuất hoặc **Dùng Unified Gateway**.
- **Điều kiện:** Có SCA/depositor, Circle quote hợp lệ, đủ ready capacity sau `maxFee` từng intent và delegate đã confirm riêng trên selected source.
- **Preview:** Scoped preview hiện ready balance, required maximum debit và hai fallback rõ ràng. Unified preview hiện checkbox, allocation, per-source reserve, total fee, maximum debit, mint mode, exclusion và fingerprint.
- **Ranh giới confirm:** Deposit là command riêng và không tự gửi transfer cũ. Persistent delegate cũng confirm riêng. Final transfer confirmation ký một EIP-712 BurnIntent hoặc BurnIntentSet; MetaMask không ký.
- **Kết quả và dữ liệu lưu:** Unified history lưu `source_mode`, allocation JSON, một transfer ID, settled fee khi có, destination hash và optional Arc proof.
- **Lỗi và cách sửa:** **`GATEWAY_INSUFFICIENT_SCOPED_BALANCE`**: chọn deposit hoặc unified. **`GATEWAY_INSUFFICIENT_UNIFIED_BALANCE`**: chọn thêm usable source hoặc giảm amount. **`GATEWAY_DELEGATE_REQUIRED`**: authorize, chờ finality rồi preview lại. **`GATEWAY_QUOTE_CHANGED`**: review fingerprint mới. **`GATEWAY_FORWARDING_FAILED`**: reconcile transfer ID hiện có. Xem [Gateway transfer](/docs/circle/gateway/transfer).

## `/gas`

- **Mục đích:** Đọc native gas của Circle wallet liên quan đến Gateway trên một chain.
- **Syntax và variants:** `/gas check <chain>`; parser yêu cầu cả `check` và chain.
- **Ví dụ:** `/gas check arc`; natural language: “Kiểm tra Arc wallet gas.”
- **Điều kiện:** User đăng nhập, có Circle SCA, chain được hỗ trợ và Wallet SDK coverage.
- **Preview:** Read ngay; kiểm tra wallet ID/address, blockchain, native symbol, raw/formatted balance và `hasGas`.
- **Ranh giới confirm:** Không có; không transaction hay signature.
- **Kết quả và dữ liệu lưu:** Trả gas snapshot và không ghi history.
- **Lỗi và cách sửa:** **“No Circle wallet found”**: chạy `/wallet create`. **“Invalid chain”**: dùng support matrix. **“current Circle wallet SDK cannot check signer gas”**: chọn chain có coverage hoặc xem address trên explorer.

## `/gateway`

- **Mục đích:** Xem public Gateway configuration hoặc chỉ Gateway ledger balance, không cộng SCA funds.
- **Syntax và variants:** `/gateway info`, `/gateway balance` hoặc `/gateway balance <chain>`.
- **Ví dụ:** `/gateway balance base`; natural language: “Hiển thị Base Gateway balance.”
- **Điều kiện:** Đăng nhập; balance cần SCA/depositor address. Read không cần gas.
- **Preview:** Read ngay. `info` hiển thị public domains/contracts; `balance` hiển thị Gateway rows, partial/unavailable flags và scope đã chọn.
- **Ranh giới confirm:** Không có; các variant này không chuyển tiền.
- **Kết quả và dữ liệu lưu:** Trả live configuration hoặc Gateway balance vừa fetch; không tạo transaction-history row.
- **Lỗi và cách sửa:** **“No wallet address found”**: tạo SCA. **“Unsupported chain”**: sửa scope. **Gateway unavailable/partial**: retry sau và không coi missing data là zero. Xem [unified balance](/docs/circle/gateway/unified-balance).
