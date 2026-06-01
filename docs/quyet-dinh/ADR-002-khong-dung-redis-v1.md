# ADR-002: Không Dùng Redis Trong V1

V1 dùng Supabase Postgres để lưu trạng thái command execution. Redis hoặc queue riêng chỉ cần khi có worker nền thật, retry phức tạp hoặc throughput cao.
