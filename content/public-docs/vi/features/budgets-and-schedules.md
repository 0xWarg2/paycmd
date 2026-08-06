---
slug: "features/budgets-and-schedules"
title: "Budgets và schedules"
description: "Audit spend context hiện tại và hiểu schedule demo theo nguyên tắc manual-first của Payna."
section: "features"
order: 43
lastUpdated: "2026-08-05"
keywords: ["budget", "schedule", "automation", "limit"]
tutorial: true
aiSummary:
  - "Budgets hiện là dashboard read-only cho spending trong 30 ngày; enforcement và editing control chưa hoạt động."
  - "Schedules hiển thị recurring-payment row đã lưu trong demo scope manual-first và không tự ký hoặc di chuyển funds."
---

## Phạm vi product hiện tại

Budgets và Schedules là operational dashboard cần đăng nhập, nhưng automation được giới hạn có chủ ý trong release này. Trang Budgets đọc budget row thật và recent transaction context; nó chưa tạo hoặc enforce budget policy. Trang Schedules đọc row thật từ `payment_schedules`; nó chưa có production cron runner hay control để create, pause, resume hoặc delete schedule.

Hãy coi cả hai trang là bề mặt audit và planning. Một con số hiển thị ở đó không phải approval, onchain balance, khoản funds được giữ trước hoặc bằng chứng future payment sẽ chạy.

## Budget record

Mỗi budget row có name, token, limit amount, used amount và `active`, `paused` hoặc `archived`. Payna hiển thị tỷ lệ used so với limit đã lưu và giới hạn progress bar ở 100%. “Available” là phép trừ giữa limit và used đã lưu, không bao giờ thấp hơn 0 trong UI.

Available figure đó không phải USDC có thể chi. Trước payment, hãy kiểm tra riêng source Circle wallet hoặc Gateway balance, route eligibility, fee, gas và confirmation bắt buộc. Pause một budget label đã lưu hiện chưa khóa onchain wallet.

## Cửa sổ activity 30 ngày

“Tracked spend” của dashboard được tính từ các transaction-history row `pay`, `transfer`, `bridge`, `swap` và `withdraw` có status thành công, được tạo trong rolling 30 days trước lúc load trang. Query lấy tối đa 100 row mới nhất trong cửa sổ đó. Row failed không cộng vào spend; row pending vào pending counter và row failed vào failed counter.

“Top chain” là chain value xuất hiện thường xuyên nhất trong recent rows đã load, không nhất thiết là chain có volume USDC lớn nhất. Vì activity calculation này và `used_amount` lưu trong từng budget đến từ hai field khác nhau, chúng có thể lệch. Hãy đối soát với Activity thay vì ép chúng khớp.

## Schedule record và thời gian

Stored schedule liên kết amount và token với frequency như daily, weekly, monthly hoặc quarterly, cùng status và `next_run_at`. Trang đếm row active và paused, sort scheduled time tăng dần, rồi hiện giá trị active sắp tới đầu tiên là “Next planned run.” Thiếu thời gian sẽ hiện “Not scheduled.” Thời gian được format theo locale người xem.

Row hiện chưa hiển thị contact hoặc budget detail trong UI, dù data model có thể liên kết chúng. Hãy xác minh intended recipient và budget trong hệ thống đã tạo record; không suy ra chúng chỉ từ amount và cadence.

## Confirmation theo manual-first

Trang hiện ghi rõ approval mode “Manual first.” Một schedule tương lai được kỳ vọng tạo payment command trong approval window, nhưng không được bỏ qua quy tắc preview, balance, identity, fee và signature như command tương tác. MetaMask operation luôn cần connected-wallet context phù hợp và schedule không thể ký thay.

Trong version này, hãy chạy `/pay`, `/transfer` hoặc `/payroll` thủ công từ chat và review confirmation card. Stored schedule `active` chỉ biểu thị planning state, không authorize chuyển tiền tại `next_run_at`.

## Demo runner và run state

Payna có schedule demo endpoint giới hạn, có thể trả synthetic command execution với status `queued`. Nó minh họa boundary giữa schedule và run; đây không phải production cron và không chạy payment. Command execution thật dùng các lifecycle state riêng: `queued`, `running`, `waiting_gateway`, `success` hoặc `failed`.

Không ghi nhận queued hoặc waiting run là đã trả. `waiting_gateway` nghĩa Gateway finality stage liên quan chưa hoàn tất. Failed run có thể xảy ra trước khi funds di chuyển hoặc sau submission, nên kiểm tra receipt và Activity trước khi quyết định retry có an toàn không.

## Schedule và transaction tách biệt

Một schedule có thể tạo nhiều run theo thời gian, và mỗi successful run có thể tạo một hoặc nhiều transaction record. Schedule ID trả lời “đã lên kế hoạch gì”; command execution trả lời “đã chạy gì”; transaction hash trả lời “đã submit gì onchain.” Pause hoặc cancel schedule không thể đảo ngược transaction đã submit, và đổi budget display không sửa được immutable receipt.

Khi đối soát, ghi schedule, expected run time, execution status, transaction route và hash, cùng finality notification nếu có. Thiếu transaction hash là tín hiệu cần điều tra, không chứng minh funds chưa di chuyển.

## Checklist vận hành

Dùng timezone rõ ràng khi phối hợp team, so `next_run_at` với cadence dự kiến và confirm recipient cùng aggregate exposure cho mọi manual run. Review Activity sau execution và giải quyết pending state trước khi bắt đầu lệnh thay thế. Không bao giờ lưu private key, seed phrase, API credential hoặc password trong budget name hay schedule metadata. Cho đến khi enforcement và production automation được phát hành, hãy giữ external approval và accounting control.
