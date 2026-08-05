---
slug: "commands/wallet-and-balance"
title: "Wallet và balance commands"
description: "Reference cho wallet, link, fund và balance."
section: "commands"
order: 60
lastUpdated: "2026-08-05"
keywords: ["wallet", "link", "fund", "balance"]
commands: ["wallet", "link", "fund", "balance"]
tutorial: true
aiSummary:
  - "Nhóm wallet gồm /wallet, /link, /fund và /balance; /fund chỉ nạp SCA còn /balance tổng hợp SCA và Gateway."
---

## Đọc vai trò wallet trước

Các command này hiển thị bốn thứ riêng biệt: Payna account, MetaMask do user kiểm soát, Circle SCA wallet và Circle Gateway balance theo source. Chúng không tự gộp quyền sở hữu hay chuyển tiền. Xem [account và vai trò wallet](/docs/getting-started/account-and-wallets) để hiểu mô hình.

## `/wallet`

- **Mục đích:** Tạo hoặc xem Circle SCA của user đang đăng nhập; balance của nó không phải Gateway balance.
- **Syntax và variants:** `/wallet create`, `/wallet status` hoặc `/wallet balance [chain]`. Chain chỉ optional với `balance`.
- **Ví dụ:** `/wallet balance base`; natural language: “Cho tôi xem USDC trong Circle wallet trên Base.”
- **Điều kiện:** Phải đăng nhập. Balance/status cần SCA đã tồn tại; create là idempotent và trả wallet cũ thay vì tạo bản trùng.
- **Preview:** `create` có action preview; `status` và `balance` chạy read ngay. Kiểm tra action, SCA address, blockchain, type và chain scope nếu có.
- **Ranh giới confirm:** Chỉ `create` có Payna confirmation card. Status và balance không ký hoặc chuyển tiền.
- **Kết quả và dữ liệu lưu:** Create trả wallet-set ID và wallet record lưu trong `wallets`; status trả chi tiết SCA đã lưu; balance trả dữ liệu USDC onchain của SCA.
- **Lỗi và cách sửa:** **“No wallet address found. Run /wallet create first”**: tạo SCA. **“Unsupported chain”**: dùng key trong [Gateway support matrix](/docs/circle/gateway/support-matrix). **“Unauthorized”**: đăng nhập lại.

## `/link`

- **Mục đích:** Liên kết EVM address MetaMask do user kiểm soát và đã verify với Payna account hiện tại; không trao custody.
- **Syntax và variants:** `/link metamask`; wallet type khác chưa được implement.
- **Ví dụ:** `/link metamask`; natural language: “Kết nối MetaMask account này với Payna.”
- **Điều kiện:** Đăng nhập, cài và unlock MetaMask, chọn đúng account, xử lý prompt cũ còn pending.
- **Preview:** Intent nêu wallet type; MetaMask sau đó hiển thị quyền truy cập account và message `personal_sign` đọc được, gồm address và timestamp.
- **Ranh giới confirm:** Không có Payna confirm cho money movement. Chọn account và ký trong MetaMask là hai ranh giới authorization; không có blockchain transaction hay gas.
- **Kết quả và dữ liệu lưu:** Payna verify signature, upsert `user_external_wallets`, đặt primary, rồi cập nhật primary external address và default chain trong profile.
- **Lỗi và cách sửa:** **“MetaMask is not available”**: cài/bật extension. **“MetaMask request was rejected”**: retry và chỉ approve message dự kiến. **“signature verification failed”**: chuyển sang address ghi trong message rồi ký lại.

## `/fund`

- **Mục đích:** Transfer USDC từ MetaMask đã link sang Circle SCA trên một chain được hỗ trợ; không fund Gateway.
- **Syntax và variants:** `/fund <amount> from metamask on <chain>`; amount nhận tối đa sáu chữ số thập phân.
- **Ví dụ:** `/fund 50 from metamask on base`; natural language: “Chuyển 50 USDC từ MetaMask vào Circle wallet của tôi trên Base.”
- **Điều kiện:** Có SCA, MetaMask link và connect phải khớp, đủ source USDC, native gas và chain được hỗ trợ.
- **Preview:** Verify amount/token, source chain, connected source address, SCA destination, Circle-wallet rail và gas do wallet hiển thị.
- **Ranh giới confirm:** Payna confirmation đứng trước execution; MetaMask confirm riêng ERC-20 `transfer`. Cancel một trong hai để không chuyển tiền.
- **Kết quả và dữ liệu lưu:** Kết quả gồm hash và `success`, `failed` hoặc `pending`; Payna lưu row history loại `fund` với address, amount, chain, status và reason. SCA USDC đổi, Gateway không đổi.
- **Lỗi và cách sửa:** **“does not match linked wallet”**: chọn/link lại đúng account. **“Insufficient USDC”**: nạp MetaMask address đó. **“does not have ... native gas”**: thêm gas token của chain, rồi chỉ retry sau khi xác nhận chưa có hash.

## `/balance`

- **Mục đích:** Đọc báo cáo balance tổng hợp nhưng vẫn tách rõ SCA và Gateway.
- **Syntax và variants:** `/balance` cho mọi chain được hỗ trợ, hoặc `/balance <chain>` để scope một chain.
- **Ví dụ:** `/balance arc`; natural language: “Payna đang thấy bao nhiêu USDC trên Arc?”
- **Điều kiện:** Đăng nhập và đã tạo SCA. Không cần MetaMask, signature hay gas.
- **Preview:** Đây là read ngay, không phải transaction preview. Kết quả liệt kê SCA `chainBalances`, Gateway domain balances, totals, failed chains và Gateway availability.
- **Ranh giới confirm:** Không có; command không thể spend funds.
- **Kết quả và dữ liệu lưu:** Chỉ trả balance vừa fetch, không ghi transaction history. `totalUnified` toàn chain cộng SCA và Gateway nhìn thấy để hiển thị, không đại diện khả năng spend.
- **Lỗi và cách sửa:** **“No wallet address found”**: chạy `/wallet create`. **“Unsupported chain”**: sửa scope. Kết quả **partial** hoặc failed chain nghĩa total chỉ là lower bound; retry read thay vì coi dữ liệu unavailable là zero.
