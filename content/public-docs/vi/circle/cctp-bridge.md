---
slug: "circle/cctp-bridge"
title: "CCTP v2 bridge bằng MetaMask"
description: "Bridge USDC bằng source burn và destination mint do MetaMask ký."
section: "circle.cctp"
order: 30
lastUpdated: "2026-08-05"
keywords: ["CCTP v2", "bridge", "burn", "mint", "MetaMask"]
tutorial: true
aiSummary:
  - "Dùng /bridge cho USDC trong MetaMask: kiểm tra route và fee, ký CCTP v2 source burn, chờ attestation rồi hoàn tất destination mint."
  - "Không lặp lại một source burn đã được ghi nhận; dùng hash của nó để chẩn đoán hoặc khôi phục mint đang chờ."
---

## Khi nào CCTP là rail phù hợp

Dùng `/bridge 5 USDC from base to arc on my metamask` khi USDC nằm trong MetaMask và cần di chuyển native giữa các CCTP testnet domain được hỗ trợ. Khác với `/transfer`, lệnh này không chi tiêu source-scoped Circle Gateway balance.

CCTP là protocol burn-and-mint, không tạo wrapped token. Xem [CCTP technical guide](https://developers.circle.com/cctp/references/technical-guide) chính thức. Payna kiểm tra route và Fast capability của Bridge Kit lúc chạy.

## Điều kiện trước khi bridge

Kết nối đúng MetaMask. Source và destination phải khác nhau và có trong selector CCTP. Source cần native USDC cho amount cộng fee được báo giá và native token để trả gas. Manual mint còn cần destination gas. Chỉ dùng [Circle Faucet](https://faucet.circle.com/) cho testnet.

Với external recipient, nhập địa chỉ EVM đầy đủ. Payna bắt buộc auto forwarding để người nhận không phải submit destination mint; destination phải hỗ trợ mode này.

## Source burn và message

Preview đứng trước hành động không thể đảo ngược. Khi confirm, Payna chuyển MetaMask sang source, kiểm tra gas và USDC. Ví có thể yêu cầu approve ERC-20 nếu allowance chưa đủ, rồi yêu cầu ký source burn. Đọc network, contract, amount và spending limit; confirm trong Payna không phải chữ ký ví.

Source transaction thành công burn native USDC, phát CCTP message và được Payna ghi `pending_mint`. Đừng bridge lại sau burn: lần thử khác có thể burn thêm tiền.

## Attestation và destination mint

Iris, Attestation Service của Circle, chờ đủ confirmation rồi ký message. Fast dùng confirmed finality và có thể tính fee USDC theo route; Standard chờ finalized finality. Khả năng hỗ trợ đến từ route capability map.

Signed message được gửi đến destination contract để chống dùng lại nonce và mint native USDC. Auto forwarding dùng Circle forwarder trả gas; manual mint yêu cầu MetaMask chuyển network, người dùng trả gas và ký. Attestation sẵn sàng chưa có nghĩa mint hoàn tất.

## Đọc preview

Xác nhận amount, hai network, địa chỉ đầy đủ, recipient mode, mint mode và Fast hoặc Standard. Estimate hiện recipient amount, source debit xấp xỉ, fee và gas item. Giá có thể đổi trước khi vào block; protocol fee bằng 0 không nghĩa gas miễn phí.

Payna từ chối external recipient đi cùng manual mint. App cũng chặn same-chain route, capability không hỗ trợ, địa chỉ sai, thiếu USDC hoặc source native gas bằng 0 trước burn khi có thể.

## History và receipt

Receipt có thể hiện explorer link cho source burn, destination mint, transfer ID và Payna proof tùy chọn trên Arc Testnet. Proof là application receipt, không phải bước CCTP. Activity lưu route, amount, status, source hash và mint metadata. Giữ cả hai hash.

## Lỗi và khôi phục

Nếu source transaction thất bại thì burn chưa thành công và có thể retry sau khi sửa lỗi. Nếu source thành công nhưng history ghi `pending_mint`, giữ hash. [Hướng dẫn xử lý CCTP transfer](https://developers.circle.com/cctp/howtos/troubleshoot-transfers) của Circle khuyên kiểm tra burn, truy vấn message/attestation bằng hash, rồi kiểm tra mint.

Attestation pending có thể đang chờ confirmation. Nếu đã complete, khôi phục mint thay vì burn lại; manual mode có thể cần gas và chữ ký mới. Attestation V2 hết hạn có thể re-attest khi burn còn tồn tại. Chỉ cung cấp route, mode, speed và hash khi escalation—không cung cấp secret.

## CCTP so với Gateway

CCTP chi tiêu MetaMask USDC và tạo source burn. Gateway dùng Circle wallet/Gateway path và source-scoped balance. Hai balance khác nhau; CCTP burn không nạp Gateway. Chọn rail theo nơi funds đang nằm.

## Checklist an toàn

Thử amount nhỏ; xác minh network, người nhận và allowance; giữ gas ở chain cần ký; lưu explorer link. Không dán seed phrase hoặc private key vào Payna. Từ chối prompt ví bất ngờ. Sau burn, xử lý message và mint hiện có thay vì lặp source action.
