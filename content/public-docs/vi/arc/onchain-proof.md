---
slug: "arc/onchain-proof"
title: "Payna onchain proof"
description: "Receipt event trên Arc liên kết command và transaction mà không giữ tiền."
section: "arc"
order: 51
lastUpdated: "2026-08-05"
keywords: ["Arc", "proof", "receipt", "contract", "ArcScan"]
tutorial: true
aiSummary:
  - "Payna proof contract trên Arc chỉ emit receipt event liên kết command, amount và tx hashes; contract không giữ hoặc chuyển tiền."
---

## Mục đích và lifecycle

Payna onchain proof là application receipt tùy chọn trên **Arc Testnet**. Sau `bridge`, Gateway `transfer`, `pay` hoặc Arc `swap`, backend có thể yêu cầu relayer được cấp quyền gọi `recordReceipt`. User không ký proof; nó nằm sau chuyển tiền và Gateway, CCTP hay swap adapter không cần nó.

Việc ghi proof phụ thuộc configuration. Nếu receipt bị tắt, registry address không có hoặc relayer credential không hợp lệ, Payna đánh dấu proof `skipped` hoặc `failed` nhưng giữ nguyên transaction record. Source action đã thành công vẫn thành công dù proof phía sau không tồn tại.

## Payload của receipt event

`ReceiptRecorded` emit command ID đã hash, action type dạng số (`1` bridge, `2` transfer, `3` pay, `4` swap ở V2), user address, recipient address, atomic amount, EVM chain ID nguồn và đích, transaction hash nguồn và đích, cùng metadata hash. Address hoặc hash thiếu hay không hợp lệ lúc ghi được thay bằng giá trị zero, không phải dữ liệu suy đoán.

Command ID được hash từ identifier cụ thể hoặc field ổn định của action/route. Metadata hash commit vào canonical JSON gồm app/version Payna và chi tiết như history ID, transfer ID, mode, label hoặc swap route. Event giữ hash chứ không lưu metadata object.

## Proof chứng minh điều gì

Một proof đã mined chứng minh recorder được cấp quyền đã gửi đúng receipt payload đó vào registry được cấu hình tại một Arc block cụ thể. Bất kỳ ai cũng có thể đối chiếu event với hash, address, chain ID, amount và metadata do Payna cung cấp. Vì contract chỉ emit event bất biến, nó tạo public timestamped linkage giữa Payna action, source transaction, destination hoặc mint transaction và metadata commitment.

Với swap, hai hash thường cùng trỏ tới Arc transaction. Với CCTP, chúng có thể là source burn và destination mint. Với Gateway transfer/pay, source có thể là auto-deposit còn destination chỉ mint hoặc forwarding. Zero hash chỉ nghĩa là phía đó không được truyền vào.

## Proof không chứng minh điều gì

Registry không giữ, approve, burn, mint, swap hoặc transfer token. Nó không verify Circle attestation, Gateway ready balance, recipient delivery, độ công bằng của AMM price, câu command, danh tính contact hay tính đúng của offchain metadata. Nó cũng không chứng minh source hoặc destination transaction thành công chỉ vì hash được ghi. Hãy verify từng business transaction trên đúng chain.

Quyền relayer chỉ chứng minh ai được ghi, không khiến mọi statement tự động đúng. Owner quản lý recorder permission; contract hiện reject recorder không được phép và action type không hợp lệ. Trust boundary vì thế gồm cách backend Payna tạo payload và cách bảo vệ key của authorized relayer.

## Verify trên ArcScan

Mở link “Payna proof” từ chat receipt hoặc Activity record. Kiểm tra explorer là Arc Testnet và proof hash thành công tại registry address Payna hiển thị. Mở log `ReceiptRecorded`, rồi so action type, amount theo atomic precision của token, source/destination chain ID, participant address và transaction hash với receipt gốc. Với swap, atomic precision theo input token; action khác mặc định dùng USDC 6 decimals trừ khi có explicit atomic amount.

Tiếp theo mở riêng source và destination explorer link. Proof link, source hash và mint hash trả lời các câu hỏi khác nhau. Xem [Activity và notifications](/docs/features/activity-and-notifications) để reconcile và [Arc Swap](/docs/arc/overview-and-swap) cho receipt riêng của swap.

## Ranh giới failure và retry

Nếu `proof_status` là `skipped`, feature hoặc configuration cần thiết không sẵn sàng; user action không thể thay thế relayer. Nếu là `failed`, giữ payment/transfer/bridge/swap hash và báo proof error. Operator có thể retry proof do RPC timeout hay thiếu relayer gas vì `recordReceipt` không chuyển tiền, nhưng user không nên chạy lại business command.

Nếu tiền đã chuyển nhưng history write lỗi, reconcile source và destination trước. Thiếu Payna row không chứng minh thất bại. Khi escalate, chỉ gửi public hash, route, thời gian và proof status—không gửi secret hay authentication token.

## Privacy và support

Các field trong onchain event là public và tồn tại lâu dài. User/recipient address, amount, chain ID, action type và transaction hash đã truyền có thể bị liên kết với nhau. Hash command ID và metadata che plaintext nhưng không tạo bí mật tuyệt đối: người đã biết candidate value có thể hash lại để so sánh. Không đặt payroll note nhạy cảm, personal data, credential hoặc secret vào command metadata.

Khi nhờ support, nói rõ lỗi nằm ở source transaction, destination/mint transaction, history record hay Arc proof. Chỉ cung cấp public explorer URL và context đã sanitize. Proof là audit pointer hữu ích, không phải custody guarantee hay vật thay thế chain-specific finality.
