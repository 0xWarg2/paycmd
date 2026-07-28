# Kiến Trúc

## Luồng Chính

```text
Chat input
  -> command registry
  -> parser + validation
  -> payment draft
  -> user confirm
  -> command execution
  -> Circle Gateway / Arc
  -> notification
```

## Command Registry

Mỗi command có:

- `name`
- `aliases`
- `sample`
- `requiredFields`
- `parse`
- `createDraft`
- `execute`

Thiết kế này giúp thêm command mới mà không viết lại chat shell.

## Database

Các bảng chính:

- `chat_threads`
- `chat_messages`
- `contacts`
- `budgets`
- `payment_drafts`
- `payment_schedules`
- `command_executions`
- `notifications`

RLS được bật cho từng bảng và dữ liệu thuộc về `auth.uid()`.

Chat history được lưu theo user trong Supabase. Khi mở app, Ra tải 10 message mới nhất; khi scroll lên đầu chat box, app tải thêm 10 message cũ hơn.
