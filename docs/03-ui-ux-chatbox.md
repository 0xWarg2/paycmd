# UI/UX Chatbox

## Nguyên Tắc

Ra là chatbox-first. Chat phải giống một app nhắn tin hơn dashboard. Browser không scroll khi hội thoại dài; chỉ vùng message bên trong chat box scroll.

## Desktop

- Sidebar trái: brand, balance, điều hướng.
- Trung tâm: chat thread duy nhất.
- Composer cố định ở đáy chat container.
- Không có right context panel trong chat route.
- Budgets, Contacts, Schedules, Notifications mở ở route riêng.

## Mobile

- Header gọn ở trên.
- Chat chiếm phần còn lại của viewport.
- Bottom navigation dùng để chuyển Chat, Budgets, Contacts, Schedules, Notifications.
- Composer luôn nằm dưới cùng, phía trên bottom nav.

## Message Loading

- Khi mở app, tải 10 message gần nhất từ Supabase theo user đang đăng nhập.
- Khi scroll lên đầu chat box, query thêm 10 message cũ từ `chat_messages`.
- Vị trí scroll được giữ lại để user không bị nhảy màn hình.
- Khi gửi command mới, chat tự scroll xuống cuối.

## Command UX

- Gõ `/` mở command palette ngay trên composer.
- Preview/confirm payment hiển thị như một card trong message bubble.
- Execution status hiển thị trong chat: `Queued`, `Running`, `Gateway`, `Success`.
- Notification chi tiết nằm ở `/notifications`.

## Auth

- User chưa đăng nhập bị chuyển về `/auth/login`.
- User đã đăng nhập vào thẳng chat page `/`.
- Sidebar hiển thị email và nút logout.
- Logout không xóa lịch sử chat.

## Missing Field Flow

Ví dụ:

- `/pay` hỏi số tiền, token, người nhận.
- `/pay 50 USDC` hỏi người nhận.
- `/schedule 25 USDC to Minh` hỏi frequency.

Không cho confirm nếu thiếu trường bắt buộc.
