# Bài Học Rút Ra

## Vì Sao Không Dùng USDCMD

`USDCMD` rất rõ cho demo USDC, nhưng dễ làm người dùng hiểu sản phẩm chỉ hỗ trợ USDC. PayCMD rộng hơn và phù hợp nếu sau này mở sang EURC, USYC, invoice, payroll và treasury.

## Vì Sao Chatbox-First

Người dùng muốn nói mục tiêu tài chính bằng ngôn ngữ ngắn gọn. Chatbox làm command, preview và notification nằm cùng một workflow.

## Vì Sao Chưa Dùng Redis

V1 chỉ cần demo nhanh. Trạng thái command có thể lưu trong Postgres. Khi có worker thật, có thể thêm queue sau mà không đổi UX.
