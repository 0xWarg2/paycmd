# Phase 0 UX handoff — truthful growth telemetry

## User and context summary

### Users

- Visitor mới cần biết PayCMD có phải sản phẩm đang hoạt động hay chỉ là mockup.
- Crypto-native user cần thấy network, volume, transaction count và bằng chứng onchain.
- Merchant/treasury lead cần hiểu capability và đường vào demo mà không phải đọc hết docs.

### Product goal

Tăng click `Launch` và tạo wallet bằng social proof có thể kiểm chứng, không thổi phồng số liệu. Homepage vẫn phải hữu dụng khi telemetry chưa cấu hình hoặc database đang lỗi.

### Constraints

- Next.js App Router/server components, Tailwind 4 và semantic CSS variables hiện có.
- Light/dark mode, mobile-first, Vietnamese/English sẽ được hoàn thiện theo i18n phase.
- Dữ liệu hiện tại chủ yếu là testnet; label này phải luôn nhìn thấy.

## Flow: visitor evaluates PayCMD

### Overview

**Goal:** visitor đánh giá usage và độ tin cậy rồi chọn launch hoặc đọc docs.  
**Trigger:** mở `/`.  
**Entry points:** direct URL, social/referral link, docs back-link.

### Steps

1. Hero nêu value proposition và CTA.
2. Visitor thấy `Live product activity` ngay dưới hero.
3. Server render aggregate metrics từ public RPC.
4. Visitor xem label network, timestamp và metric definitions.
5. Visitor chọn `Launch`, `Read docs` hoặc tiếp tục xem capabilities.

### States

| State | UI | Behavior |
|---|---|---|
| Loading | Server-rendered skeleton chỉ khi streaming được bật sau này | Không announce từng counter |
| Success | Bốn metric cards + network badge + timestamp | Số exact, volume format compact nhưng có accessible full value |
| Empty | Hiển thị số `0` vì RPC trả dữ liệu hợp lệ | Copy trung thực: early network activity |
| Unavailable | Không hiển thị `0` giả; hiển thị telemetry temporarily unavailable | CTA vẫn hoạt động, page không fail |
| Partial/malformed | Toàn block dùng unavailable state | Không trộn số thật và số fallback không rõ nguồn |

### Analytics events

| Event | Trigger | Required properties |
|---|---|---|
| `landing_view` | Page visible | locale, referrer class, campaign |
| `metrics_viewed` | Metrics block in viewport | network, data timestamp |
| `launch_clicked` | Click Launch | placement, locale |
| `docs_clicked` | Click Docs | placement, locale |

Không gửi wallet address, raw prompt, email hoặc recipient vào product analytics.

## Component: PublicPlatformMetrics

### Purpose

Hiển thị social proof aggregate có provenance rõ ràng và fail closed khi dữ liệu không đáng tin.

### Data contract

```ts
type PublicPlatformMetrics = {
  registeredUsers: number;
  completedPayments: number;
  usdcMoved: string;
  researchAnswers: number;
  network: "testnet" | "mainnet" | "mixed";
  asOf: string;
};
```

### Variants and states

- `success`: render metric grid.
- `unavailable`: neutral bordered panel, không dùng error red vì visitor không thể khắc phục.
- Future `stale`: warning badge nếu `asOf` cũ hơn 24 giờ.

### Metric cards

| Metric | Label | Definition |
|---|---|---|
| registeredUsers | Users joined | Count của `user_profiles` |
| completedPayments | Verified movements | Successful `transfer`/`bridge` có tx hash |
| usdcMoved | USDC moved | Sum amount của verified movements; testnet label bắt buộc |
| researchAnswers | AskPayna answers | Persisted assistant research responses |

### Responsive behavior

- `<640px`: 2 cột; label wrap tối đa hai dòng.
- `640–1024px`: 4 cột nếu đủ rộng, nếu không 2 cột.
- `>1024px`: 4 cột, metadata trên một hàng riêng.

### Accessibility

- Section có heading thật và `aria-labelledby`.
- Status/network không chỉ thể hiện bằng màu.
- Full numeric value nằm trong accessible text; compact visual format không làm mất nghĩa.
- Không auto-animate counter khi `prefers-reduced-motion`.
- Contrast tối thiểu 4.5:1 cho body text, 3:1 cho large metric text.

### Edge cases

- Negative/NaN/unsafe integer: reject toàn response.
- Decimal lớn: giữ string trong transport, format bằng parser có giới hạn.
- Missing env/RPC/timeout: unavailable state.
- RPC trả nhiều rows: chỉ chấp nhận đúng một normalized record.

## Styling rules

- Tái sử dụng `bg-card`, `border-border`, `text-muted-foreground`, `text-primary` và radius hiện có.
- Không thêm brand palette mới trong phase này.
- Metric number dùng hierarchy tương đương `text-3xl`/`text-4xl`; metadata `text-xs`/`text-sm`.
- Hover chỉ là subtle lift, không làm card trông clickable nếu card không có action.

## Implementation target

Next.js App Router vì homepage cần SEO và server-rendered telemetry có cache/revalidation. Data loader ở `lib/paycmd/public-metrics.ts`, component server-side ở `components/public-platform-metrics.tsx`, aggregate contract ở Supabase migration.

## Acceptance criteria

- [ ] Không có hard-coded user/volume/transaction count.
- [ ] Dữ liệu unavailable không bị hiển thị thành zero.
- [ ] Network và `as of` rõ ràng.
- [ ] RPC không trả PII và chỉ grant aggregate execution.
- [ ] Mobile 320px không overflow.
- [ ] Keyboard/screen reader đọc đúng heading, metric và status.
- [ ] Unit tests cover success, malformed, missing config và compact formatting.
- [ ] Lint, test, build pass.
