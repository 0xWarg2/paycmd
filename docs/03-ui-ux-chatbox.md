# UI/UX Chatbox

## Nguyên Tắc

PayCMD là chatbox-first. Dashboard chỉ là ngữ cảnh phụ, không phải màn hình chính.

## Desktop

- Sidebar trái: brand, balance, điều hướng.
- Trung tâm: chat thread và composer.
- Panel phải: draft preview, budgets, contacts, schedules, notifications, command detail.

## Mobile

- Chat chiếm toàn màn hình.
- Panel phải nên chuyển thành bottom sheet trong bản hoàn thiện tiếp theo.
- Notification đặt ở đầu màn hình.

## Missing Field Flow

Ví dụ:

- `/pay` hỏi số tiền, token, người nhận.
- `/pay 50 USDC` hỏi người nhận.
- `/schedule 25 USDC to Minh` hỏi frequency.

Không cho confirm nếu thiếu trường bắt buộc.
