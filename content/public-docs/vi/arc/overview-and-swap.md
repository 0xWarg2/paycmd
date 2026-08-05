---
slug: "arc/overview-and-swap"
title: "Arc Testnet và swap"
description: "Swap USDC, EURC và cirBTC trên Arc bằng MetaMask."
section: "arc"
order: 50
lastUpdated: "2026-08-05"
keywords: ["Arc", "swap", "USDC", "EURC", "cirBTC"]
tutorial: true
aiSummary:
  - "Payna swap trên Arc Testnet dùng MetaMask, hỗ trợ USDC/EURC/cirBTC, direct route cho USDC pair và route qua USDC cho cặp còn lại."
---

## Tài sản hỗ trợ

Payna Swap hiện là flow MetaMask **chỉ dành cho Arc Testnet**. Flow hỗ trợ USDC và EURC với 6 decimals, cùng cirBTC (Circle BTC) với 8 decimals. Precision này quyết định cách parse amount và hiển thị balance; nó không có nghĩa các token ngang giá. Chỉ dùng testnet asset và kiểm tra MetaMask hiển thị Arc Testnet, chain ID `5042002`, trước khi ký.

Flow này dùng token trong MetaMask account đang chọn. Nó không dùng Circle SCA wallet hay Circle Gateway balance, cũng không deposit, burn, mint hoặc transfer qua Gateway. Hãy đọc [account và vai trò wallet](/docs/getting-started/account-and-wallets) trước khi chọn rail.

## Command và route hỗ trợ

Dùng `/swap <amount> <token-in> to <token-out>`, ví dụ `/swap 1 USDC to EURC`. Input và output phải khác nhau, amount phải dương, và parser nhận tối đa sáu chữ số thập phân dù balance cirBTC dùng tám.

Pair có USDC đi trực tiếp: USDC ↔ EURC hoặc USDC ↔ cirBTC. EURC ↔ cirBTC dùng hai pool qua USDC. Preview liệt kê route trước confirm. Thiếu pair hoặc reserves rỗng làm quote dừng; Payna không tự đổi asset.

## Quote, slippage và minimum output

Payna đọc pool reserves hiện tại và áp dụng constant-product AMM math với giả định fee 0,3% cho mỗi hop. Preview hiển thị amount nhập vào, estimated output, route, direct hoặc số hop, cùng minimum output. Slippage guard hiện cố định 1%, nên `amountOutMin` bằng 99% estimate mới nhất, được làm tròn theo atomic unit của output token.

Estimate không phải cam kết. Reserves có thể đổi giữa preview và thời điểm block nhận transaction. Khi confirm, Payna bỏ qua quote cache ngắn và đọc reserves mới; minimum mới đó được encode vào transaction. Adapter có thể revert thay vì settle thấp hơn mức này. Hãy cancel nếu route hoặc minimum không chấp nhận được.

## Preflight, gas và approval

Sau khi chuyển MetaMask sang Arc Testnet, Payna chạy server-side preflight cho account đang connect. Preflight kiểm tra input-token balance, allowance dành cho adapter và account có native-gas balance khác 0 trên Arc hay không. Swap vẫn là testnet transaction dù Payna ghi native currency của Arc là USDC.

Nếu allowance thấp hơn input amount, MetaMask yêu cầu ERC-20 approval riêng và tốn gas. Sau đó Payna yêu cầu chữ ký swap. Đọc account, token contract, spender, amount, network và gas; nút confirm Payna không phải wallet signature.

## Thực thi

Nút confirm bị khóa cho tới khi có quote không lỗi. Sau khi ký, adapter gọi `swapExactTokensForTokens` với input/output token, amount, minimum output, địa chỉ MetaMask của bạn làm recipient và deadline mười phút. Payna poll receipt trên Arc. Revert quan sát được thành `failed`; nếu hết lượt kiểm tra mà chưa có bằng chứng hai chiều, kết quả giữ `pending`, không bị gọi sai là failed.

Kết quả có thể gồm approval hash, swap hash, route, pool addresses, estimated/minimum output và status. Payna ghi một row `swap` vào transaction history với Arc ở cả source và destination, kèm chi tiết route. Sau đó hệ thống thử ghi [Payna onchain proof](/docs/arc/onchain-proof) riêng. Thiếu proof không hoàn tác hoặc vô hiệu hóa swap.

## Lỗi và retry an toàn

**“Choose two different swap tokens”** nghĩa là hai asset sau normalize giống nhau; chọn output khác. **“No liquidity pair”** hoặc **“insufficient liquidity”** nghĩa là pool trực tiếp hoặc pool trong route qua USDC không quote được; giảm amount hoặc chọn pair được hỗ trợ khác. **“Insufficient USDC/EURC/cirBTC”** nghĩa là input balance trong MetaMask thấp hơn yêu cầu mới; nạp đúng account đó trên Arc Testnet. **“Could not read your Arc Testnet balances”** là lỗi RPC/preflight; retry phép đọc mà chưa ký thêm transaction.

Với **“MetaMask request was rejected”** hoặc wallet còn request pending, mở MetaMask rồi hoàn tất hoặc cancel. Nếu approval thành công nhưng swap chưa chạy, không approval lặp không cần thiết; quote lại và kiểm tra allowance. Nếu đã có swap hash, xem ArcScan và history trước khi retry, vì receipt hay history ghi chậm không chứng minh swap thất bại.

## Arc Swap khác Circle Gateway

Arc Swap đổi các testnet token được hỗ trợ trong một MetaMask account trên một chain. Circle Gateway hợp nhất USDC đã deposit trên các domain được hỗ trợ và dùng vai trò SCA/depositor/signer cho `/deposit`, `/withdraw`, `/transfer` và `/pay`. Gateway transfer không trade USDC sang EURC hoặc cirBTC, còn swap không tạo ready Gateway balance. Dùng [Gateway overview](/docs/circle/gateway/overview) khi mục tiêu là cross-chain USDC liquidity thay vì trade token trên Arc.
