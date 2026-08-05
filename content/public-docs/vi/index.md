---
slug: ""
title: "Tài liệu Hey Payna"
description: "Bắt đầu với stablecoin copilot dành cho thanh toán USDC, Circle Gateway, CCTP và Arc."
section: "overview"
order: 0
lastUpdated: "2026-08-05"
keywords: ["Payna", "USDC", "Circle", "Arc"]
tutorial: true
aiSummary:
  - "Hey Payna là stablecoin copilot dạng chat dành cho thao tác USDC testnet, thanh toán, chuyển tiền cross-chain, swap và nghiên cứu Web3 có nguồn."
---

## Payna là command center cho stablecoin

Payna là workspace dạng chat để tìm hiểu và chuẩn bị thao tác USDC trên testnet. Trong Payna mode, một yêu cầu ngôn ngữ tự nhiên hoặc slash command trở thành thao tác có cấu trúc: thiết lập ví, nạp tiền, thanh toán, bridge, Gateway transfer hoặc swap. AskPayna là bề mặt nghiên cứu công khai cho câu hỏi về Web3, Circle, Arc, crypto và khái niệm L1/L2; nó không chuyển tiền. Đăng nhập mở workspace đã xác thực để Payna liên kết ví và hiển thị activity. Tài liệu công khai vẫn đọc được khi chưa có tài khoản.

## Chọn đúng payment rail

Từ “transfer” có thể chỉ nhiều quy trình on-chain khác nhau. Hãy bắt đầu từ nơi USDC đang nằm và nơi nó cần đến. Payna nêu tên rail trong preview để bạn có thể dừng lại khi route được đề xuất không khớp với intent.

### Circle wallet và Gateway

Dùng Circle SCA wallet cho wallet flow và payment flow do Payna điều phối. `/fund` chuyển USDC từ MetaMask vào SCA đó. Circle Gateway là lớp thanh khoản riêng: `/deposit` chuyển USDC từ SCA vào Gateway, và deposit phải đạt finality trước khi sẵn sàng cho Gateway transfer. Gateway balance không phải SCA balance, dù cả hai cùng thuộc một tài khoản.

### MetaMask và CCTP

Dùng MetaMask khi USDC bắt đầu ở ví ngoài của bạn. Nó ký login, fund và CCTP v2 bridge. Ví dụ, `/bridge 5 usdc from base to arc on my metamask` là MetaMask CCTP flow, không phải Gateway transfer. Flow này cần đúng account, USDC nguồn và native gas trên chain nguồn.

### Arc swap và proof

Dùng Arc swap flow khi muốn đổi token theo route và cặp token Payna hiển thị. Preview xác định input, expected output, route và ví sẽ ký. Với Gateway operation, receipt có thể gồm tham chiếu transaction nguồn/đích và proof metadata khi có. Receipt hữu ích để kiểm chứng nhưng không thay đổi quy tắc balance hoặc finality của rail đã chọn.

## Command luôn bắt đầu bằng intent

Nêu amount, source, destination và chain khi bạn biết chúng. Parser có thể chuẩn hóa yêu cầu nhưng không nên âm thầm chọn ví hoặc rail khác. Dùng `/balance` để xem SCA và Gateway, `/wallet status` để nhận diện địa chỉ, và `/gateway info` khi dùng Gateway. Nếu command được đề xuất không phải ý bạn, hãy sửa hoặc hủy trước khi tiếp tục.

## Preview trước, confirm sau

Mọi thao tác chuyển tiền đều được chuẩn bị thành preview. Đọc amount, token, chain, source address hoặc balance, destination, fee và yêu cầu manual gas nếu có. Confirmation là quyết định rõ ràng ở bước riêng; việc hiểu yêu cầu ngôn ngữ tự nhiên không cấp quyền thực thi. MetaMask chỉ xin chữ ký qua extension. Payna không bao giờ cần seed phrase hoặc private key.

## Giới hạn testnet

Payna hiện hướng tới testnet. Hãy xem faucet USDC, network availability, estimate, supported route và receipt như hành vi testnet, không phải cam kết thanh toán production. Giữ một lượng nhỏ native token trong source wallet phù hợp cho flow cần gas. Nếu deposit pending, balance unavailable hoặc signer cần authorization, hãy kiểm tra trạng thái hiển thị và hướng dẫn troubleshooting thay vì thử lại liên tục.

## Lộ trình học được khuyến nghị

Hãy bắt đầu từ Getting Started: đăng nhập, link MetaMask, tạo Circle wallet, fund và kiểm tra balance. Sau đó đọc tổng quan Circle Gateway và deposit/finality trước khi dùng `/transfer`. Đọc command reference cho wallet, payment và Gateway để có cú pháp chính xác, rồi đến hướng dẫn CCTP và Arc cho từng rail. Kết thúc bằng activity, proof, safety và troubleshooting để biết cách kiểm chứng thao tác hoàn tất và xử lý lỗi đầu phiên.
