# MVP V1

## Command Chính

```text
/pay 50 USDC to Minh
/createbudget Marketing 500
/schedule 25 USDC monthly to Minh
```

## Success Criteria

- Gõ `/` hiện command palette.
- Command thiếu dữ liệu sẽ hỏi lại trường còn thiếu.
- Command đủ dữ liệu tạo draft preview.
- Người dùng confirm trước khi execute.
- Execution chuyển qua các trạng thái `queued`, `running`, `waiting_gateway`, `success`.
- Khi xong có notification.
- Bấm notification xem được command execution liên quan.

## Ngoài Phạm Vi V1

- Không auto execute payment khi chưa confirm.
- Không cron thật cho recurring payment.
- Không queue/worker riêng.
- Không unit test bắt buộc cho demo.
