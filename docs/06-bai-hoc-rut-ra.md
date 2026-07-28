# Bài Học Rút Ra

## Vì Sao Không Dùng USDCMD

`USDCMD` rất rõ cho demo USDC, nhưng dễ làm người dùng hiểu sản phẩm chỉ hỗ trợ USDC. Ra rộng hơn và phù hợp nếu sau này mở sang EURC, USYC, invoice, payroll và treasury.

## Vì Sao Chatbox-First

Người dùng muốn nói mục tiêu tài chính bằng ngôn ngữ ngắn gọn. Chatbox làm command, preview và notification nằm cùng một workflow.

## Vì Sao Chưa Dùng Redis

V1 chỉ cần demo nhanh. Trạng thái command có thể lưu trong Postgres. Khi có worker thật, có thể thêm queue sau mà không đổi UX.

## Gateway Không Đồng Bộ Ngay Sau Deposit

Bài học từ lỗi thực tế khi chạy `/transfer 5 from base to arc`:

- `addDelegate` và `deposit` có thể đã confirm trên chain, nhưng Gateway API vẫn chưa nhận ngay quyền signer hoặc balance để burn.
- Lúc đó backend có thể báo `Signer is not authorized to spend funds from sourceDepositor`.
- Đây không phải lỗi thiếu gas đơn thuần. Nó là trạng thái chờ finality/index của Gateway, đặc biệt dễ gặp trên Base Sepolia.

Lesson:

- Không burn ngay sau auto-deposit hoặc delegate.
- Nếu Gateway chưa sẵn sàng, backend nên trả trạng thái chờ rõ ràng thay vì treo loading vô hạn hoặc trả lỗi 400 thô.
- User cần đợi rồi chạy lại command `/transfer ...` sau khi Gateway đã sync xong.
- Nếu đã có deposit đang `pending_gateway_finality`, lệnh `/transfer` tiếp theo không được auto-deposit thêm. Backend phải báo rõ đang chờ bao nhiêu USDC finality trên source chain và Gateway ready hiện có bao nhiêu.
- `/deposit` chỉ có nghĩa là on-chain deposit tx đã confirm. Nó chưa đồng nghĩa Gateway balance đã sẵn sàng để burn, nên transaction history nên lưu `pending_gateway_finality` cho tới khi Gateway API index/finality xong.

## Gateway Balance Phải Tính Cả Fee

Bài học từ lỗi thực tế:

```text
Gateway API error: 400 - {"success":false,"message":"Insufficient balance for depositor 0x...: available 10.000000, required 10.01"}
```

Ý nghĩa:

- User có đủ `10 USDC` để chuyển `10 USDC`, nhưng Gateway còn cần thêm fee, ví dụ `0.01 USDC`.
- Source Gateway balance phải đủ `amount + Gateway fee`, không chỉ đủ `amount`.
- Nếu route auto-deposit chỉ deposit đúng amount thiếu, transfer vẫn có thể fail ở burn intent.

Lesson:

- Trước khi burn, gọi Gateway estimate fee hoặc ít nhất cộng buffer fee vào required source balance.
- Nếu estimate API trả `0` hoặc thiếu `fees.total`, vẫn phải giữ buffer tối thiểu, ví dụ `0.1%`.
- Auto-deposit nên nạp phần thiếu theo `amount + estimatedGatewayFee - gatewayBalance`.
- UI/log phải nói rõ `requiredGatewayBalance` để user hiểu vì sao 10 USDC vẫn chưa đủ cho transfer 10 USDC.

## Phân Biệt SCA Wallet Balance Và Gateway Balance

`/fund ... from metamask on base` chỉ chuyển USDC từ MetaMask vào Circle SCA wallet trên Base. Khoản này là on-chain wallet balance, chưa dùng trực tiếp cho Gateway cross-chain nếu chưa deposit.

`/deposit ... from base` hoặc auto-deposit trong `/transfer` mới chuyển USDC từ Circle SCA wallet vào Gateway Wallet contract, làm tăng Gateway balance.

`/balance` trong Ra là unified view, bằng:

```text
Circle SCA wallet USDC trên các chain
+ Gateway balance trên các chain
```

Vì vậy cần có lệnh tách nguồn:

- `/wallet balance [chain]`: xem USDC còn ở Circle SCA wallet.
- `/gateway balance [chain]`: xem USDC đã nằm trong Gateway balance.

## Gateway Unified Balance Có Theo Chain Không?

Có. Cần hiểu theo 2 lớp:

```text
Gateway balance theo domain/source chain:
- baseSepolia: 100 USDC
- avalancheFuji: 50 USDC

Unified balance:
- tổng khả dụng sau finality = 150 USDC
```

Circle gọi đây là unified/crosschain balance vì app có thể dùng tổng USDC đã deposit ở nhiều source chain để mint sang bất kỳ destination chain được hỗ trợ. Nhưng tiền không “chuyển sẵn sang Arc” chỉ vì destination là Arc. Nếu user có 100 USDC Gateway balance ở Base và 50 USDC ở Avalanche, thì:

- Muốn chuyển 120 USDC sang Arc, burn intent có thể lấy 100 từ Base và 20 từ Avalanche, rồi mint 120 USDC ở Arc.
- Muốn chuyển 40 USDC từ Base sang Arc, chỉ cần burn từ sourceDomain Base nếu Base Gateway balance đủ `amount + fee`.
- Muốn chuyển từ Arc sang Base, cần Gateway balance ở Arc, hoặc app phải chọn source domain khác nếu UX cho phép dùng unified total từ source khác.

Trong Ra V1, command `/transfer 10 from base to arc` đang cố tình chọn **source chain cụ thể** là Base. Vì vậy nó chỉ dùng Gateway balance trên Base, không tự rút từ Avalanche trừ khi sau này thêm lệnh kiểu `/transfer 10 to arc using unified`.

Docs Circle cũng nhấn mạnh:

- USDC phải được deposit bằng Gateway `deposit`/`depositFor`/permit flow; không được ERC-20 transfer thẳng vào Gateway contract.
- Deposit phải đạt finality trước khi được Gateway API tính vào unified balance.
- Cross-chain transfer tạo burn intent từ source domain, Gateway API trả attestation, rồi mint ở destination domain.
- Fee cross-chain được trừ bằng USDC từ unified/Gateway balance tại thời điểm burn.

Lesson:

- UI phải hiển thị cả `Gateway balance theo chain` và `Unified total`.
- Khi user chọn source chain rõ ràng, backend không nên âm thầm lấy tiền từ chain khác.
- Nếu muốn UX “dùng unified total thông minh”, cần preview rõ các source chain sẽ bị burn, ví dụ `Base 100 + Avalanche 20 -> Arc 120`.
- Auto-deposit chỉ nên nạp vào source chain mà command đang dùng, không nạp vào destination chain.

## Withdraw Gateway Balance Về SCA Wallet

Nếu user deposit dư vào Gateway balance, V1 nên rút về Circle SCA wallet bằng lệnh riêng:

```text
/withdraw 5 from base
```

Luồng này không phải trustless withdrawal `initiateWithdrawal` rồi chờ `withdrawalDelay`. Với UX thường dùng, Ra rút bằng Gateway transfer cùng chain:

```text
Gateway balance trên Base
-> burn intent sourceDomain = Base, destinationDomain = Base
-> Gateway attestation
-> mint/release USDC về Circle SCA wallet trên Base
```

Lesson:

- `/withdraw` chỉ rút phần USDC đã nằm trong Gateway balance, không auto-deposit thêm từ SCA wallet.
- Sau withdraw, `/gateway balance base` giảm và `/wallet balance base` tăng.
- Same-chain withdraw không phải bridge qua chain khác, nhưng vẫn cần native gas trên chain đó để execute mint về SCA wallet.
- Nếu Gateway signer chưa được authorize, backend phải gửi tx authorize trước rồi báo user đợi Gateway sync và chạy lại `/withdraw ...`.
- Trustless withdrawal 7 ngày chỉ nên để làm fallback/future command, chưa expose trong V1.
