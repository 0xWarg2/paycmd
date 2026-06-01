# ADR-009: Auth-First Chat History

PayCMD chuyển sang auth-first để biết user nào tạo command và lưu chat history theo từng user.

Lịch sử chat được lưu trong `chat_threads` và `chat_messages` trên Supabase. Ví/Circle Wallet chưa bắt buộc ở bước này; phần đó sẽ nối sau khi flow auth và command history ổn định.
