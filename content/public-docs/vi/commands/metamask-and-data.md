---
slug: "commands/metamask-and-data"
title: "Bridge, swap và history commands"
description: "Reference cho bridge, swap và history."
section: "commands"
order: 63
lastUpdated: "2026-08-05"
keywords: ["bridge", "swap", "history", "MetaMask"]
commands: ["bridge", "swap", "history"]
tutorial: true
aiSummary:
  - "Nhóm MetaMask/data gồm /bridge, /swap và /history; bridge và swap cần chữ ký MetaMask, history chỉ đọc dữ liệu đã lưu."
---

## Chủ động chọn MetaMask rail

`/bridge` dùng MetaMask USDC qua các CCTP testnet domain; `/swap` trade token được hỗ trợ bên trong Arc Testnet; `/history` chỉ đọc Payna record. Hai MetaMask command không dùng SCA hay Gateway balance. So sánh [CCTP bridge](/docs/circle/cctp-bridge), [Arc Swap](/docs/arc/overview-and-swap) và [vai trò wallet](/docs/getting-started/account-and-wallets) trước khi ký.

## `/bridge`

- **Mục đích:** Burn native USDC trong MetaMask qua CCTP v2 trên source testnet và mint trên destination testnet khác.
- **Syntax và variants:** `/bridge <amount> USDC from <source> to <destination> [to <0x-recipient>] [on my metamask] [manual mint] [fast|standard]`. External recipient bắt buộc auto forwarding; source và destination phải khác.
- **Ví dụ:** `/bridge 10 USDC from base to arc on my metamask`; natural language: “Bridge 10 MetaMask USDC từ Base tới Arc address của tôi bằng Fast forwarding.”
- **Điều kiện:** MetaMask connect, CCTP route/capability được hỗ trợ, source USDC đủ amount cộng quoted fee, source native gas và destination gas chỉ cho self/manual mint.
- **Preview:** Verify amount, source/destination, full recipient và self/external mode, Fast/Standard, auto/manual mint, expected receive/source debit, fee items và bên trả từng gas item.
- **Ranh giới confirm:** Payna confirmation đứng trước MetaMask. User ký allowance nếu cần và source burn; manual mint sau đó cần chữ ký MetaMask khác ở destination. Forwarding dùng Circle forwarder.
- **Kết quả và dữ liệu lưu:** Receipt có thể link source burn và destination mint/forwarder explorer, transfer ID, fee/mode và optional Arc proof. History lưu `bridge`; burn được ghi ngay ở `pending_mint`, rồi cùng row được update sau mint.
- **Lỗi và cách sửa:** **“same chain”/“unsupported route”**: chọn hai network tương thích. **“Insufficient USDC”/thiếu native gas**: fund source account được nêu. **“burned ... awaiting mint”**: giữ burn hash và recover attestation/mint—không burn lại. **MetaMask rejected/pending request**: xử lý prompt cũ.

## `/swap`

- **Mục đích:** Đổi USDC, EURC hoặc cirBTC trong MetaMask qua Payna adapter, chỉ trên Arc Testnet.
- **Syntax và variants:** `/swap <amount> <token-in> to <token-out>`; dùng symbol/alias một token (`USDC`, `EURC`/`EUROC`, `cirBTC`/`BTC`). “Euro Coin” hoặc “Circle BTC” có khoảng trắng không parse; hai asset phải khác.
- **Ví dụ:** `/swap 1 USDC to EURC`; natural language: “Đổi một USDC sang EURC trên Arc Testnet.”
- **Điều kiện:** MetaMask connect, adapter đã configure, đủ Arc input balance, native gas khác 0, pair reserves hoạt động và allowance nếu cần.
- **Preview:** Kiểm tra input, estimated output, minimum output, slippage cố định 1%, path trực tiếp hoặc qua USDC, pool count và Payna Swap rail. Quote lỗi sẽ khóa confirm.
- **Ranh giới confirm:** Confirm trong Payna; MetaMask có thể yêu cầu ERC-20 approval riêng trước chữ ký adapter swap. Payna refresh reserves trước khi encode `amountOutMin` và deadline mười phút.
- **Kết quả và dữ liệu lưu:** Trả approval/swap hash, route/pairs, estimate/minimum và `success/failed/pending`; ghi history row `swap` rồi thử ghi V2 Arc proof riêng. Explorer link dùng ArcScan.
- **Lỗi và cách sửa:** **“Choose two different swap tokens”**: đổi output. **“No liquidity pair”/“insufficient liquidity”**: giảm amount hoặc chọn pair khác. **“Could not read ... balances”**: retry preflight. Nếu có swap hash, kiểm tra ArcScan trước mọi retry.

## `/history`

- **Mục đích:** Lấy transaction-history row thuộc account hiện tại để reconcile.
- **Syntax và variants:** `/history` hoặc `/history <fund|deposit|withdraw|transfer|unify|bridge|swap>`.
- **Ví dụ:** `/history bridge`; natural language: “Hiển thị các bridge transaction đã ghi của tôi.”
- **Điều kiện:** Đăng nhập. Không cần wallet, balance, gas hay signature.
- **Preview:** Read ngay; không có transaction preview. Review type filter, status, source/destination, amount, reason, date và explorer reference đúng chain.
- **Ranh giới confirm:** Không có; history không thể ký, settle, retry hay thay đổi transaction.
- **Kết quả và dữ liệu lưu:** Trả các row đã có theo thứ tự mới nhất trong route limit và không tạo history mới. Chat receipt có thể hiển thị nhiều hash hơn Activity table.
- **Lỗi và cách sửa:** **“Unauthorized”**: đăng nhập lại. **“Failed to fetch transaction history”**: retry mà không chạy payment. Kết quả rỗng: bỏ filter. Row `pending` hoặc `pending_gateway_finality` chưa phải final success; hãy reconcile hash.

## Recovery và result link

Gắn nhãn từng hash theo chain và stage: CCTP burn, destination mint, Arc swap, approval hoặc Payna proof. History-write hay proof failure có thể xảy ra sau money movement thành công, nên thiếu record không cho phép duplicate. Nếu có source hash, mở đúng explorer và theo recovery boundary trong guide sâu hơn. Chỉ chia sẻ public hash và error đã sanitize—không gửi seed phrase, private key, session token hoặc API credential.
