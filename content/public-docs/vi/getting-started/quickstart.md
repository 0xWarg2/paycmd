---
slug: "getting-started/quickstart"
title: "Bắt đầu nhanh"
description: "Đăng nhập, tạo ví, nạp testnet USDC và chạy giao dịch Payna đầu tiên."
section: "getting-started"
order: 10
lastUpdated: "2026-08-05"
keywords: ["quickstart", "MetaMask", "Circle wallet", "USDC"]
tutorial: true
aiSummary:
  - "Đăng nhập bằng MetaMask, link ví ngoài, tạo Circle wallet, nạp testnet USDC rồi chạy command có preview và confirm."
---

## Chuẩn bị phiên testnet

Dùng một tài khoản MetaMask dành cho thử nghiệm và chọn testnet chain bạn định sử dụng. Giữ một lượng nhỏ native token để trả transaction gas; chỉ có USDC thì chưa trả được phí mạng MetaMask. Payna hiện hướng tới testnet, vì vậy hãy dùng faucet fund và không nhập seed phrase hoặc private key ở bất kỳ đâu trong app. Có thể đọc tài liệu công khai khi chưa có tài khoản, nhưng command và thông tin ví cần phiên Payna đã xác thực.

## Đăng nhập bằng MetaMask

Chọn **Sign in with MetaMask** rồi xác nhận login signature trong extension. Login signature chứng minh bạn kiểm soát account đang chọn; nó không phải token transfer. Kiểm tra địa chỉ MetaMask hiển thị trước khi ký, nhất là khi extension có nhiều account hoặc network. Nếu account đang active không đúng, chuyển account trong MetaMask rồi refresh hoặc đăng nhập lại để session và extension khớp nhau.

## Liên kết ví MetaMask bằng `/link metamask`

Sau khi đăng nhập, chạy `/link metamask`. Command này liên kết external address đang connect với Payna account hiện tại; nó không trao quyền custody ví cho Payna. MetaMask account phải trùng với login session. Liên kết này giúp Payna chuẩn bị fund, CCTP bridge và swap flow cần chữ ký người dùng. Kiểm tra MetaMask đã liên kết bằng địa chỉ và status badge trong **Profile**; `/wallet status` chỉ báo Circle SCA, Gateway signer và các Circle wallet.

## Tạo Circle wallet bằng `/wallet create`

Chạy `/wallet create` để tạo hoặc trả về Circle SCA wallet. Command này idempotent: nếu SCA đã có, nó trả current status thay vì tạo trùng. Thông tin Gateway signer có thể chưa xuất hiện cho đến khi một Gateway flow khởi tạo signer. Chờ status response trước khi thử command chuyển tiền. Tạo ví thành công không đưa USDC vào SCA và cũng không tạo Gateway balance.

## Lấy faucet USDC và native gas

Lấy testnet USDC từ [Circle Faucet](https://faucet.circle.com/) trên chain bạn muốn fund. Xác nhận faucet deposit đến linked MetaMask address, không phải SCA hoặc Gateway address đã copy từ màn hình khác. MetaMask cần cả USDC và native gas cho `/fund`, CCTP bridge và Arc swap. Gas cho Circle SCA hoặc Gateway signer chỉ liên quan Circle-wallet transaction hay manual branch được UI nêu rõ; dùng `/gas check <chain>` khi Gateway flow yêu cầu kiểm tra.

## Fund Circle wallet bằng `/fund`

Chuyển một amount test nhỏ từ MetaMask vào Circle SCA wallet:

```text
/fund 10 from metamask on base
```

Preview phải hiển thị MetaMask source, SCA destination, amount và chain. Chỉ approve MetaMask transaction khi các chi tiết này đúng. `/fund` tăng SCA balance; nó không deposit USDC vào Circle Gateway. Muốn dùng Gateway transfer sau đó, hãy chạy `/deposit` sau khi fund và chờ finality được hiển thị.

## Kiểm tra balance bằng `/balance`

Tiếp theo, yêu cầu Payna hiển thị balance:

```text
/balance
```

Kết quả tách thông tin SCA và Gateway có thể dùng khi phù hợp. Bạn cũng có thể kiểm tra theo chain, ví dụ:

```text
/balance on base
```

Không diễn giải một total hiển thị như quyền dùng toàn bộ amount cho Gateway transfer. USDC trong SCA vẫn là SCA USDC cho đến khi được deposit và ready trong Gateway.

## Xem preview đầu tiên và confirm

Dùng một payment nhỏ hoặc lệnh fund ở trên làm bài tập confirmation đầu tiên. Đọc action name, rail, amount, token, source, destination, chain, recipient, fee và gas warning. Preview chỉ chuẩn bị action, không thực thi. Chỉ confirm khi nó khớp intent; reject hoặc sửa nếu Payna chọn sai chain, wallet hoặc recipient. Natural-language input không bao giờ bỏ qua bước confirmation.

## Xác minh kết quả trong history

Sau khi confirm, chờ result state rồi mở activity hoặc history entry. Ghi nhận transaction reference, status và rail hiển thị. Gateway flow có thể hiển thị thêm source/destination transaction reference hoặc proof metadata; deposit hoặc transfer pending không được xem là final chỉ vì transaction đầu tiên đã submit. Chạy lại `/balance` để xác nhận balance nào thay đổi, và dùng đúng activity entry khi cần hỗ trợ.

## Xử lý lỗi đầu phiên

Nếu `/link metamask` thất bại, kiểm tra extension đang connect và selected account trùng login session. Nếu `/fund` không chạy được, kiểm tra MetaMask có faucet USDC, native gas nguồn và đúng network. Nếu `/balance` cho thấy SCA USDC nhưng Gateway trống, đó là bình thường cho đến khi `/deposit` finality. Với trạng thái pending không chắc chắn, kiểm tra history và troubleshooting guide thay vì chạy lệnh lại vì có thể tạo request thứ hai.

## Checklist phiên đầu tiên

- MetaMask đã đăng nhập bằng testnet account mong muốn.
- `/link metamask` và `/wallet create` đã hoàn tất.
- Linked MetaMask address có testnet USDC và native gas.
- `/fund 10 from metamask on base` đã được review trước khi approve.
- `/balance` và history cho thấy kết quả trên rail mong muốn.
- Không seed phrase hoặc private key nào được chia sẻ với Payna.
