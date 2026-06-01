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

- `contacts`
- `budgets`
- `payment_drafts`
- `payment_schedules`
- `command_executions`
- `notifications`

RLS được bật cho từng bảng và dữ liệu thuộc về `auth.uid()`.
