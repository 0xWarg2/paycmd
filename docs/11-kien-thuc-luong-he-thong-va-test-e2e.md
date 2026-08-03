# Payna: Kiến Thức Sản Phẩm, Luồng Hệ Thống Và Test E2E

Tài liệu này là điểm bắt đầu để hiểu và test Payna hiện tại. Mọi thao tác tiền chỉ nên chạy trên testnet và tài khoản test.

## 1. Payna làm gì?

Payna là ứng dụng chat-first để quản lý Circle developer-controlled wallet và USDC testnet. User có thể dùng slash command hoặc câu tự nhiên để xem ví/số dư, nạp USDC vào Gateway, rút tiền, chuyển đa chain, trả contact, tạo payment request và chạy payroll.

Nguyên tắc an toàn: AI chỉ phân tích ý định. AI không ký, không submit và không tự thực thi giao dịch. Các giao dịch cần preview và confirm từ user.

## 2. Khái niệm Circle cần biết

| Khái niệm | Ý nghĩa trong Payna |
| --- | --- |
| Circle SCA wallet | Ví smart-contract do Circle Developer-Controlled Wallets quản lý cho mỗi Payna user. Đây là nơi giữ USDC on-chain. |
| External wallet | Ví MetaMask của user; dùng để link identity và fund USDC vào Circle wallet. |
| Circle Gateway balance | Unified balance đã deposit vào Gateway. Gateway dùng balance này để chuyển USDC giữa các domain/chain. |
| Deposit | Chuyển USDC từ Circle SCA wallet vào Gateway trên source chain. |
| Withdraw | Chuyển USDC từ Gateway về Circle SCA wallet trên cùng chain. V1 dùng instant same-chain transfer, không phải trustless withdrawal 7 ngày. |
| Gateway transfer | Chuyển unified Gateway balance từ source chain đến destination chain; cross-chain có thể qua burn/mint và finality. |
| Native gas | ETH/AVAX testnet để ký transaction. USDC đủ không có nghĩa là transaction chạy được. |
| CCTP BridgeKit | Rail bridge MetaMask riêng; không đồng nhất với Gateway unified balance. |

Testnet Gateway chính: `arcTestnet`, `baseSepolia`, `avalancheFuji`. Alias command tương ứng: `arc`, `base`, `avalanche|avax|fuji`.

### Gateway khác cách chuyển USDC truyền thống thế nào?

#### A. Chuyển cùng chain truyền thống

Ví dụ Alice có 100 USDC trên Base Sepolia và Bob cũng nhận ở Base Sepolia:

```text
Alice Circle SCA wallet -- ERC-20 transfer 10 USDC --> Bob wallet
```

- Chỉ có một chain nên không cần bridge/burn/mint.
- Alice trả native gas ở Base Sepolia.
- Số dư của Alice giảm ngay khi transaction được xác nhận.

#### B. Bridge/liquidity pool truyền thống

Ví dụ chuyển 10 USDC Base → Avalanche bằng một bridge thông thường:

```text
Alice gửi token vào bridge trên Base
  → bridge xác nhận / dùng liquidity pool
  → bridge phát hành hoặc giải phóng token tương ứng ở Avalanche
```

Nhiều bridge truyền thống dùng wrapped token hoặc liquidity pool. Điều này tạo thêm rủi ro bridge/liquidity, có thể bị lệch giá hoặc thiếu thanh khoản. Đây không phải cách CCTP chuyển native USDC.

#### C. CCTP: burn rồi mint theo từng lần chuyển

```text
Alice wallet (Base) -- burn 10 native USDC --> Circle attestation service
  -- sau finality + attestation --> mint 10 native USDC (Avalanche) --> Bob wallet
```

CCTP là protocol permissionless để burn native USDC ở source và mint native USDC 1:1 ở destination; không cần wrapped token/liquidity pool. Nhưng trong flow thường, user/app vẫn cần xử lý một transfer theo chuỗi: burn → chờ finality/attestation → mint. CCTP phù hợp khi ứng dụng cần kiểm soát sát protocol, custom smart-contract flow hoặc hooks. [Circle CCTP overview](https://developers.circle.com/cctp)

#### D. Circle Gateway: nạp trước, dùng unified balance sau

Gateway tách **thời gian finality của deposit** khỏi **trải nghiệm chi tiêu/chuyển tiền**.

```text
1. Deposit trước: SCA wallet → Gateway Wallet contract
2. Chờ deposit finality một lần
3. Gateway ghi nhận unified USDC balance
4. Khi cần trả/chuyển: dùng balance unified trên chain đích được hỗ trợ
```

Ví dụ cụ thể:

```text
Ban đầu
  Circle SCA Base: 100 USDC
  Circle SCA Arc:    0 USDC
  Gateway unified:   0 USDC

/deposit 60 from base
  Sau transaction deposit + finality:
  Circle SCA Base:  40 USDC
  Gateway unified:  60 USDC

/deposit 20 from arc (sau khi user có 20 USDC ở Arc)
  Sau finality:
  Circle SCA Base:  40 USDC
  Circle SCA Arc:   0 USDC
  Gateway unified: 80 USDC

/transfer 50 from base to arc
  Payna dùng 50 trong unified balance 80 USDC.
  Recipient nhận/được mint ở Arc theo Gateway flow.
  Gateway unified còn lại xấp xỉ 30 USDC, trừ fee nếu có.
```

Điểm quan trọng: Gateway balance **không phải** USDC ERC-20 còn nằm tự do trong Circle SCA wallet. Nó là balance đã credit trong Gateway Wallet system sau khi deposit đạt finality. Không được ERC-20 `transfer` trực tiếp USDC vào Gateway Wallet contract, vì sẽ không credit unified balance và Circle cảnh báo có thể mất USDC. Phải gọi phương thức Gateway deposit. [Circle Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide)

Gateway có Gateway Wallet contracts, Gateway Minter contracts và off-chain system. Với cross-chain transfer, app ký các burn intent, hệ thống Circle quan sát/finalize và mint ở destination theo transfer spec. Theo Circle, lợi ích UX chính là “front-load” finalization wait vào bước deposit, thay vì để user chờ finality giữa lúc transfer. [Circle Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide)

### Deposit, transfer và withdraw trong Payna

| Payna command | Dòng tiền thực tế | Điều cần test |
| --- | --- | --- |
| `/deposit 10 from base` | Circle SCA Base → Gateway Wallet Base → chờ finality → +10 unified balance | USDC SCA, native gas Base, finality. |
| `/transfer 10 from base to arc` | Unified Gateway balance → Gateway cross-chain transfer/mint ở Arc | Gateway balance đủ amount + fee, gas/finality, destination config. |
| `/withdraw 10 from base` | Gateway balance Base → Circle SCA Base | Gateway balance Base đủ, native gas. V1 dùng instant same-chain withdraw. |
| `/pay 10 to Minh on arc from base` | Resolve contact → Gateway transfer đến recipient address/chain | Contact đúng, source unified balance/gas, confirm preview. |

Payna có `autoDeposit: true` cho chat Gateway transfer: nếu unified source balance thiếu nhưng Circle SCA source còn USDC, backend có thể deposit phần thiếu rồi tiếp tục. Đây là tiện ích app-level; không thay đổi quy tắc finality của Gateway.

### Vì sao có `waiting_gateway`?

`waiting_gateway` không đồng nghĩa transaction thất bại. Nó biểu thị request đã được tạo nhưng app còn chờ trạng thái Gateway/finality/mint. Một số chain có thể cần nhiều block confirmations trước khi deposit có thể dùng được; Circle ghi chú một số mạng có thể mất đến khoảng 20 phút. Khi gặp trạng thái này, không submit lại ngay; kiểm tra tx hash, Gateway balance và retry sau khi finality hoàn tất. [Circle unified-balance quickstart](https://developers.circle.com/gateway/quickstarts/unified-balance-evm)

## 3. Kiến trúc và luồng xử lý

```text
Browser /app
  ├─ Slash command
  │  → PayCmd parser/rules
  │  → validation → preview → user confirm → API execution → Circle/Supabase
  │
  └─ Natural language
     ├─ Payna mode → DeepSeek command router
     │  → command | clarify | answer | crypto_research
     └─ Research mode → DeepSeek research backend

Command router lỗi / trả JSON sai
  → deterministic rules fallback (contact, payment, bridge, swap, clarify)
```

### AI hiện tại

| Bề mặt | Model hiện dùng | Reasoning | Vai trò |
| --- | --- | --- | --- |
| Payna command router | `deepseek-v4-flash` | tắt | Chuyển ngôn ngữ tự nhiên thành command/clarify/answer/research intent. |
| Research Instant | `deepseek-v4-flash` | tắt | Câu trả lời research nhanh. |
| Research Standard | `deepseek-v4-flash` | bật | Câu trả lời research có chain-of-thought. |
| Research Deep | `deepseek-v4-pro` | bật | Câu trả lời research dài và sâu hơn. |

Reasoning của DeepSeek bật sẵn trên cả hai model và token reasoning **rút từ chính `max_tokens`**. Command router vì vậy phải tắt thinking: nếu bật, chain-of-thought có thể ăn hết budget làm JSON bị cắt và route âm thầm rơi về rules fallback với HTTP 200. Reasoning trả về ở `choices[0].message.reasoning_content`, được cắt còn 4.000 ký tự ở transport và persist trong `chat_messages.metadata.reasoning`.

Locale UI quyết định ngôn ngữ `assistantText`: English UI trả English, Vietnamese UI trả Vietnamese. Backend research là DeepSeek; không có live web/on-chain search hay citation đã xác minh.

## 4. Chuẩn bị test

1. Apply Supabase migrations; cấu hình `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Cấu hình Circle: `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `CIRCLE_WALLET_SET_ID`.
3. Để test AI, set `DEEPSEEK_API_KEY` (và các `DEEPSEEK_*_MODEL` nếu muốn override) trong `.env.local`.
4. Chạy `npm install` rồi `npm run dev`; mở `http://localhost:3000`.
5. Chuẩn bị account A (payer) và B (recipient). Login mỗi account một lần để bootstrap Circle SCA wallet; kiểm tra bằng `/wallet status`.
6. Nạp testnet USDC và native gas vào các ví/chain cần test. Khi test MetaMask fund, account MetaMask phải có USDC testnet và native gas.

## 5. Luồng test cơ bản theo thứ tự

### A. Auth và wallet bootstrap

1. Sign up/login account A, mở `/app`.
2. Chạy `/wallet status`; nếu chưa có ví, chạy `/wallet create`.
3. Logout/login lại; kiểm tra chat history vẫn còn.
4. Tuỳ chọn: login MetaMask, sau đó `/link metamask` và ký message.

Kỳ vọng: một Circle SCA wallet ổn định cho mỗi user; link MetaMask được lưu là external wallet.

### B. Command surface và AI

1. Gõ `/` để mở command palette.
2. Gõ `/pay` để xác nhận app hỏi field thiếu, không thực thi.
3. Gõ `/balance` để kiểm tra command không cần confirm.
4. Ở Payna mode, nhập `pay 1 USDC to Minh on arc from base`; kiểm tra router tạo preview hoặc clarify.
5. Trong English UI, nhập `hello`; kiểm tra answer bằng English. Đổi Vietnamese UI và lặp lại; kiểm tra answer bằng Vietnamese.
6. Chọn Research, hỏi một câu research; kiểm tra research bubble, loading, disclosure reasoning và actions copy/download/print.
7. Khi Research mode, gõ `/balance`; kiểm tra slash command vẫn đi parser, không đi research.

### C. Contacts và trả tiền

1. Login B, copy Circle SCA address từ `/wallet status`.
2. Login A, chạy `/contacts add Minh <wallet-B> on arc` rồi `/contacts list`.
3. Chạy `/pay 1 to Minh on arc from base` → xem preview → confirm.
4. Kiểm tra execution status `queued` → `running` → có thể `waiting_gateway` → `success|failed`.
5. Test recipient direct: `/pay 1 to 0x... on arc from base`.
6. Test lỗi: `/pay 1 to UnknownName on arc from base`; kỳ vọng hướng dẫn add contact.

### D. Fund, balances và Gateway

1. `/fund 1 from metamask on base` sau khi đã link MetaMask; hoàn tất transfer nếu UI yêu cầu.
2. `/wallet balance base`, `/gateway balance base`, `/balance base`; ghi lại các số dư ban đầu.
3. `/deposit 1 from base` → preview → confirm; Gateway balance tăng, history có `deposit`.
4. `/withdraw 1 from base` → preview → confirm; Gateway balance giảm, Circle wallet balance tăng, history có `withdraw`.
5. `/transfer 1 from base to arc` → confirm; kiểm tra lifecycle Gateway và history `transfer`.
6. `/gateway info` và `/gas check arc|base|avalanche`.

Ghi nhớ: nếu Gateway source balance thiếu, transfer chat có thể auto-deposit phần thiếu khi Circle wallet còn USDC. Nếu thiếu gas, xử lý `INSUFFICIENT_GAS` bằng cách nạp native gas cho đúng wallet/chain được báo. Nếu Gateway balance thiếu fee, nạp thêm USDC/deposit trước khi retry.

### E. Payment request, payroll và history

1. A chạy `/request 1 from Minh on arc`, copy link `/pay/request/:id`.
2. B mở link ở session khác, login, confirm payment; kiểm tra request `paid` và tx hash.
3. A tạo ít nhất hai contacts, chạy `/payroll run team 1 from base`, confirm và kiểm tra batch/items trong Supabase.
4. Chạy `/history`, `/history fund`, `/history deposit`, `/history withdraw`, `/history transfer`.
5. Mở `/notifications`, `/contacts`, `/profile` để xác nhận dữ liệu theo user/RLS.

### F. Các bề mặt demo

- `/profile`: sửa avatar, display name, handle, bio, website, default receiving chain; refresh để kiểm tra persistence.
- `/budgets`: dữ liệu demo/static, chưa có CRUD backend.
- `/schedules`: demo/manual runner, chưa có cron thực. Test API: `POST /api/schedules/demo-schedule/run-demo`.

## 6. Ma trận kiểm tra lỗi quan trọng

| Tình huống | Kỳ vọng |
| --- | --- |
| Thiếu field command | Hỏi đúng field, không execute. |
| Double submit Enter | Chỉ có một message/execution. |
| Chưa link MetaMask nhưng fund | Lỗi hướng dẫn `/link metamask`. |
| Deposit vượt Circle wallet balance | Không ghi success. |
| Withdraw vượt Gateway balance | `INSUFFICIENT_GATEWAY_BALANCE`. |
| Thiếu native gas | `INSUFFICIENT_GAS` với wallet/chain cần nạp. |
| DeepSeek lỗi/JSON không hợp lệ | Command router rơi về PayCmd rules fallback; slash command vẫn chạy. Fallback trả HTTP 200 nên phải soi `modelProfile` để biết. |
| DeepSeek hết số dư | Cả command router và research lỗi; kiểm tra message lỗi và nạp thêm credit. |
| Gateway finality chưa hoàn tất | Có thể `waiting_gateway` hoặc lỗi authorization tạm thời; đợi index/finality rồi retry. |

## 7. Giới hạn hiện tại

- Không auto-execute payment khi chưa confirm.
- Payroll chạy tuần tự trong request, chưa có queue/worker riêng.
- Schedule chưa có cron thật; budget là demo static.
- Research DeepSeek không có live web/on-chain search; câu trả lời dựa trên kiến thức model, không có citation đã xác minh.
- Không có retry ở transport. Một request lỗi là lỗi luôn, user phải hỏi lại.
- Giá DeepSeek nhân đôi giờ cao điểm Bắc Kinh 09:00–12:00 và 14:00–18:00 (UTC+8).

## 8. Smoke test trước demo

```text
/wallet status
/balance
/gateway info
/gas check arc
/contacts add Minh <wallet-B> on arc
/pay 1 to Minh on arc from base
/deposit 1 from base
/transfer 1 from base to arc
/history
```

Chỉ thực hiện các lệnh có tiền khi đã kiểm tra testnet balance/gas và đọc kỹ preview.
