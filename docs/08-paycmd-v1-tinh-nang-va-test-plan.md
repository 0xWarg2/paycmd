# Ra V1 - Tính Năng Và Test Plan

Tài liệu này liệt kê các tính năng đang có trong Ra V1 và cách test từng tính năng. Mặc định test qua UI tại `/app` sau khi user đã đăng nhập, trừ khi mục test nói rõ route khác.

## Điều Kiện Test Chung

- Chạy app local: `npm install`, `npm run dev`, mở `http://localhost:3000`.
- Supabase đã apply toàn bộ migration, bao gồm migration mới nhất cho internal contacts: `20260607000000_add_internal_contact_wallet_resolution.sql`.
- Env tối thiểu: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `CIRCLE_WALLET_SET_ID`.
- Nếu test AI natural language hoặc crypto research, cần thêm `DEEPSEEK_API_KEY`. Mặc định dùng `DEEPSEEK_BASE_URL=https://api.deepseek.com`, `DEEPSEEK_RESEARCH_TIMEOUT_MS=240000`.
- Chuẩn bị ít nhất 2 account test: account A là payer, account B là recipient nội bộ.
- Mỗi account cần có Circle SCA wallet. Login xong chạy `/wallet status`; nếu chưa có thì chạy `/wallet create`.
- Test payment thật nên có testnet USDC và native gas trên chain liên quan. External recipient/mint có thể cần gas ở Gateway EOA signer wallet theo thông báo lỗi `INSUFFICIENT_GAS`.
- Chain hỗ trợ: `arcTestnet`, `baseSepolia`, `avalancheFuji`. Alias command: `arc`, `base`, `avalanche`, `avax`, `fuji`.

## 1. Auth Và Account Bootstrap

Tính năng:
- Đăng ký/đăng nhập bằng email.
- Đăng nhập bằng MetaMask qua Supabase Web3 auth.
- Sau login, `/api/user/bootstrap` tạo/cập nhật `user_profiles`.
- Mỗi user được đảm bảo có Circle developer-controlled SCA wallet.
- Nếu login bằng MetaMask, external wallet được lưu vào `user_external_wallets`.

Cách test:
1. Mở `/auth/sign-up`, tạo account email mới, sau đó vào `/app`.
2. Chạy `/wallet status`.
3. Kỳ vọng response có `Wallet active: 0x...` hoặc wallet được bootstrap thành công.
4. Logout, mở `/auth/login`, đăng nhập lại cùng email.
5. Kỳ vọng quay lại `/app`, chat history của user vẫn còn.
6. Nếu test MetaMask: mở `/auth/login`, bấm `Sign in with MetaMask`, ký message trong MetaMask.
7. Kỳ vọng login thành công, profile có auth provider `web3`, external wallet primary được lưu.

## 2. Chat Command Surface

Tính năng:
- Chat-first UI tại `/app`.
- Gõ `/` hiện command palette.
- Command thiếu field sẽ hỏi field còn thiếu.
- Command có đủ field tạo preview nếu là command cần confirm.
- Các command payment/gateway có execution status `queued`, `running`, `waiting_gateway`, `success` hoặc `failed`.
- Chat history lưu theo user và có load older messages.
- Empty state có Ra mascot và các lệnh cơ bản cho user mới.
- UI chặn double-submit khi user nhấn Enter nhiều lần quá nhanh.
- Assistant bubble hiển thị provider badge: `DeepSeek Router`, `DeepSeek Research` hoặc `Ra`.

Cách test:
1. Vào `/app`, gõ `/`.
2. Kỳ vọng thấy command palette gồm wallet, link, fund, balance, deposit, withdraw, transfer, pay, request, payroll, contacts, gas, gateway, history.
3. Gõ `/pay`.
4. Kỳ vọng assistant hỏi field thiếu thay vì execute.
5. Gõ `/balance`.
6. Kỳ vọng command chạy ngay và trả unified balance.
7. Gõ `/transfer 1 from base to arc`.
8. Kỳ vọng hiện preview/confirm, sau confirm có status gateway pipeline.
9. Refresh trang.
10. Kỳ vọng các message vừa test vẫn xuất hiện.
11. Với thread mới, kỳ vọng thấy Ra mascot và các shortcut hướng dẫn lệnh cơ bản.
12. Nhập một command rồi nhấn Enter liên tiếp thật nhanh.
13. Kỳ vọng chỉ có một user message và một execution/preview tương ứng.

## 3. AI Command Router Và Crypto Research

Tính năng:
- User có thể nhập natural language không bắt đầu bằng `/`.
- `/api/ai/command` dùng app context hiện tại để convert thành slash command.
- Composer có mode switch `Ra` / `Research`.
- Mode `Research` có selector `Instant` / `Research` và effort `Standard` / `Deep`.
- AI trả suggestions để user bấm lại nhanh.
- Command router là router cấp 1: nếu câu là hành động Ra thì tạo command/clarify; nếu là research crypto thì trả intent `crypto_research`.
- Khi đang ở mode `Research`, câu hỏi không bắt đầu bằng `/` bỏ qua command router và gọi thẳng `/api/ai/crypto`.
- Slash command luôn chạy Ra dù composer đang ở mode nào.
- `/api/ai/crypto` gọi DeepSeek server-side để trả lời crypto, market, stablecoin, chain, protocol, news hoặc conceptual questions.
- Khi command router chạy, UI hiện loading `DeepSeek đang phân tích lệnh...`; khi research chạy, UI đổi sang `Research đang tìm thông tin crypto...`.
- Research không được ký, submit hoặc execute transaction. Nó chỉ trả lời research hoặc gợi ý slash command nếu user muốn hành động.
- Effort map tới model DeepSeek: `Instant` và `Standard` dùng `deepseek-v4-flash`, `Deep` dùng `deepseek-v4-pro`. Cả hai tier research bật reasoning; `Instant` và command router tắt.
- Message cũ lưu effort `extended` hoặc `maximum` (3 tier trước khi gộp) được map về `Deep` ở cả server và client hydrate.
- Research có thể mất vài chục giây. Timeout xếp theo thứ tự 240 giây (server) < 270 giây (client abort) < 300 giây (`maxDuration`). Sau khoảng 12 giây, UI hiện thanh báo nhỏ có nút tắt để user biết request vẫn đang chạy nhưng không bị che màn hình.
- Answer research render dạng research bubble rộng hơn, có `Sections of Research`, table controls, footer actions và `Related Questions` nếu model trả về.
- Message có reasoning hiện disclosure `Xem reasoning` (đóng mặc định) ngay dưới provider badge. Reasoning được persist trong `chat_messages.metadata` nên còn nguyên sau reload và sau khi confirm/cancel draft.

Cách test:
1. Đảm bảo `DEEPSEEK_API_KEY` đã set trong `.env.local`.
2. Vào `/app`, chọn mode `Ra`.
3. Nhập `pay 2 USDC to Minh on arc from base`.
4. Kỳ vọng AI trả preview command `/pay 2 to Minh on arc from base` hoặc hỏi thêm nếu thiếu contact. `modelProfile` phải khác `paycmd-rules-fallback`; nếu bằng thì đường model đã fail im lặng, soi console server.
5. Nhập câu thiếu thông tin, ví dụ `pay Minh`.
6. Kỳ vọng AI hỏi một câu ngắn về thông tin còn thiếu, không execute.
7. Command router không được hiện disclosure reasoning (thinking tắt).
8. Trong mode `Ra`, nhập `USDC Gateway khác bridge thường ở điểm nào?`.
9. Kỳ vọng UI hiện DeepSeek Router trước, sau đó DeepSeek Research, cuối cùng trả answer research và không hiện transaction preview.
10. Chọn mode `Research`, effort `Standard`, nhập `Monad là gì?`.
11. Kỳ vọng câu hỏi gọi thẳng research, trả research bubble có `Sections of Research`, footer copy/download/print, `Related Questions` nếu model trả về, và disclosure reasoning mở ra được.
12. Reload trang; kỳ vọng disclosure reasoning còn nguyên.
13. Confirm hoặc cancel một draft trên message có reasoning; kỳ vọng reasoning còn nguyên.
14. Mở một message research cũ trước migration trong history; kỳ vọng vẫn render research bubble, không phải markdown thô.
15. Nếu answer có bảng, test copy table, download CSV, download PNG và fullscreen.
16. Bấm một nút `Related Questions`; kỳ vọng câu hỏi mới submit tiếp bằng mode `Research`.
17. Gõ `/balance` khi composer vẫn ở mode `Research`; kỳ vọng slash command vẫn chạy Ra.
18. Tắt hoặc bỏ `DEEPSEEK_API_KEY`, hỏi lại câu research.
19. Kỳ vọng lỗi rõ `DEEPSEEK_API_KEY is not configured`; các slash command khác vẫn hoạt động.

## 4. Wallet Management

Tính năng:
- `/wallet status`: xem Circle SCA wallet và gateway signer nếu có.
- `/wallet create`: idempotent, tạo Circle wallet nếu chưa có; nếu user đã có ví thì hiển thị ví hiện có, không tạo duplicate.

Cách test:
1. Vào `/app`, chạy `/wallet status`.
2. Nếu chưa có wallet, chạy `/wallet create`, confirm.
3. Chạy lại `/wallet create` lần nữa.
4. Kỳ vọng command trả `Wallet đã tồn tại: 0x...` hoặc hiển thị đúng địa chỉ ví hiện có, không tạo ví duplicate.
5. Chạy lại `/wallet status`.
6. Kỳ vọng có SCA wallet address dạng `0x...`.

## 5. Profile Identity

Tính năng:
- `/profile`: trang chỉnh sửa identity của user trong Ra.
- User có thể edit avatar, display name, handle, bio, website và default receiving chain.
- Avatar upload vào Supabase Storage bucket `profile-avatars`; app chỉ lưu `avatar_url` trong `user_profiles`.
- Profile dùng cho contact discovery sau này qua display name/handle.

Cách test:
1. Vào `/profile`.
2. Kỳ vọng thấy identity pass, contact preview, Circle SCA wallet và external wallet nếu có.
3. Upload avatar PNG/JPEG/WEBP/GIF nhỏ hơn 2MB.
4. Chỉnh display name, handle, bio, website, default chain.
5. Bấm `Save profile`.
6. Kỳ vọng response `Profile đã lưu`, refresh trang vẫn giữ dữ liệu.
7. Test handle trùng hoặc sai format.
8. Kỳ vọng lỗi rõ và không ghi đè profile.

## 6. Link MetaMask Và Fund Circle Wallet

Tính năng:
- `/link metamask`: link MetaMask vào account hiện tại bằng signature verification.
- `/fund 50 from metamask on base`: lấy source MetaMask và destination Circle wallet, yêu cầu user gửi USDC testnet, sau đó record transaction history.
- API fund validate tx hash, source wallet, destination wallet, amount và chain.

Cách test:
1. Cài MetaMask và đăng ở account test có USDC testnet.
2. Trong `/app`, chạy `/link metamask`.
3. Ký message trong MetaMask.
4. Kỳ vọng response `Đã link MetaMask 0x...`.
5. Chạy `/fund 1 from metamask on base`.
6. UI sẽ lấy fund context: source là MetaMask, destination là Circle wallet.
7. Thực hiện transfer USDC trên MetaMask nếu UI yêu cầu.
8. Kỳ vọng command ghi nhận tx hash và `/history fund` hiện transaction vừa record.
9. Test lỗi: chạy `/fund 1 from metamask on base` khi chưa link MetaMask.
10. Kỳ vọng lỗi `No linked MetaMask wallet. Run /link metamask first.`

## 7. Unified Balance

Tính năng:
- `/balance`: xem tổng Gateway balance + on-chain USDC trong Circle SCA wallet trên các chain.
- `/balance arc`, `/balance base`, `/balance avalanche`: lọc theo chain.
- `/wallet balance`: chỉ xem USDC còn nằm trong Circle SCA wallet.
- `/gateway balance`: chỉ xem USDC đã deposit vào Circle Gateway.
- `/withdraw 5 from base`: rút USDC từ Gateway balance về Circle SCA wallet cùng chain.

Cách test:
1. Chạy `/balance`.
2. Kỳ vọng response `Unified balance: ... USDC`, là tổng của SCA wallet balance và Gateway balance.
3. Chạy `/balance arc`, `/balance base`, `/balance avalanche`.
4. Kỳ vọng mỗi response hiện tổng USDC của chain tương ứng.
5. Chạy `/wallet balance base`.
6. Kỳ vọng chỉ thấy USDC on-chain trong Circle SCA wallet trên Base Sepolia.
7. Chạy `/gateway balance base`.
8. Kỳ vọng chỉ thấy USDC đã deposit vào Gateway balance trên Base Sepolia.

## 8. Gateway Info Và Gas Check

Tính năng:
- `/gateway info`: lấy Circle Gateway domains/contracts.
- `/gas check arc|base|avalanche`: check native gas của Circle SCA wallet trên chain.
- Transfer/payment preflight cũng check gas cho minter wallet.

Cách test:
1. Chạy `/gateway info`.
2. Kỳ vọng response `Gateway online. Domains: N`.
3. Chạy `/gas check arc`.
4. Kỳ vọng response báo có gas hoặc chưa có native gas, kèm wallet address.
5. Chạy `/gas check invalid`.
6. Kỳ vọng parser/API báo invalid chain.

## 9. Gateway Deposit

Tính năng:
- `/deposit 50 from arc`: deposit USDC từ Circle SCA wallet vào Circle Gateway trên source chain.
- Lưu transaction history `tx_type = deposit`.

Cách test:
1. Đảm bảo Circle wallet có USDC trên source chain và có native gas.
2. Chạy `/deposit 1 from arc`.
3. Confirm preview.
4. Kỳ vọng command success với tx hash.
5. Chạy `/history deposit`.
6. Kỳ vọng row mới có `chain = arcTestnet`, `tx_type = deposit`, amount vừa deposit.
7. Test lỗi: deposit amount lớn hơn wallet balance.
8. Kỳ vọng lỗi từ Circle/Gateway và transaction không được ghi success.

## 10. Gateway Withdraw

Tính năng:
- `/withdraw 5 from base`: rút USDC đã nằm trong Gateway balance về Circle SCA wallet trên cùng chain.
- V1 dùng instant same-chain Gateway transfer, không dùng trustless withdrawal chờ 7 ngày.
- Không auto-deposit từ SCA wallet; nếu Gateway balance thiếu thì báo user deposit trước.
- Lưu transaction history `tx_type = withdraw`.

Cách test:
1. Đảm bảo Gateway balance trên source chain có đủ USDC và Circle SCA wallet có native gas trên chain đó.
2. Chạy `/gateway balance base` để ghi nhận số dư Gateway ban đầu.
3. Chạy `/wallet balance base` để ghi nhận số dư SCA wallet ban đầu.
4. Chạy `/withdraw 1 from base`.
5. Confirm preview.
6. Kỳ vọng command success với tx hash.
7. Chạy lại `/gateway balance base` và `/wallet balance base`.
8. Kỳ vọng Gateway balance giảm, SCA wallet balance tăng.
9. Chạy `/history withdraw`.
10. Kỳ vọng có row `tx_type = withdraw`, `chain = baseSepolia`.
11. Test lỗi: withdraw amount lớn hơn Gateway balance.
12. Kỳ vọng lỗi `INSUFFICIENT_GATEWAY_BALANCE` và không ghi success.
13. Test lỗi gas: Circle SCA wallet không có native gas trên chain đó.
14. Kỳ vọng lỗi `INSUFFICIENT_GAS` kèm wallet address cần nạp gas.

## 11. Gateway Transfer

Tính năng:
- `/transfer 10 from base to arc`: transfer unified Gateway balance giữa chain.
- Route có `autoDeposit: true` trong chat flow; nếu Gateway source balance thiếu nhưng wallet USDC đủ, backend auto deposit phần thiếu.
- Hỗ trợ cross-chain burn/mint qua Circle Gateway. Cross-chain mặc định dùng `mintGasMode = auto_forwarding` để Circle/relayer mint hộ ở destination.
- Lưu transaction history `tx_type = transfer`.

Cách test:
1. Đảm bảo source chain có Gateway balance hoặc Circle wallet có USDC để auto-deposit.
2. Chạy `/transfer 1 from base to arc`.
3. Confirm preview.
4. Kỳ vọng status qua `queued`, `running`, `waiting_gateway`, rồi `success`.
5. Chạy `/history transfer`.
6. Kỳ vọng có transaction mới với source/destination chain đúng.
7. Test lỗi gas: rút hết native gas của minter wallet rồi transfer.
8. Với Auto forwarding, kỳ vọng không lỗi gas ở destination và response có `forwarding: true`.
9. Test manual mode bằng command `/transfer 1 from base to arc manual` hoặc request trực tiếp `mintGasMode: "manual"` rồi rút hết native gas của minter wallet.
10. Kỳ vọng lỗi `INSUFFICIENT_GAS` kèm wallet address cần nạp gas.
11. Nếu thấy lỗi `available 10.000000, required 10.01`, nghĩa là Gateway balance thiếu phần fee. Route cần auto-deposit theo `amount + estimatedGatewayFee`, hoặc user cần nạp thêm USDC vào source Gateway balance rồi chạy lại.
12. Nếu thấy lỗi `Signer is not authorized to spend funds from sourceDepositor`, đợi Gateway finality/index xong rồi chạy lại `/transfer ...`.

Chi tiết về nơi trừ Gateway fee, ví trả native gas và so sánh với CCTP V2 nằm
trong [`09-gateway-vs-cctp-v2-phi-va-gas.md`](./09-gateway-vs-cctp-v2-phi-va-gas.md).

## 12. Contacts Address Book

Tính năng:
- `/contacts add Minh 0x... on arc`: lưu contact theo `display_name`, `wallet_address`, `preferred_chain`.
- Nếu wallet address thuộc `wallets` của Ra user khác, contact được gán `contact_user_id` và resolution là `internal`.
- Nếu address không thuộc Ra user, contact là `external`.
- Add lại cùng tên sẽ update contact cũ, không tạo duplicate.
- `/contacts list` và trang `/contacts` hiện danh bạ hiện tại.

Cách test external contact:
1. Chọn một EVM address ngoài hệ thống.
2. Chạy `/contacts add Minh 0x1111111111111111111111111111111111111111 on arc` với address test hợp lệ của bạn.
3. Kỳ vọng response `Đã lưu contact Minh (external wallet).`
4. Chạy `/contacts list` hoặc vào `/contacts`.
5. Kỳ vọng chỉ có một contact Minh với preferred chain `arcTestnet`.

Cách test internal contact:
1. Login account B, chạy `/wallet status`, copy Circle SCA wallet address của B.
2. Logout B, login account A.
3. Chạy `/contacts add Minh <địa-chỉ-wallet-B> on arc`.
4. Kỳ vọng response `Đã lưu contact Minh (internal Ra user).`
5. Trong Supabase, row contact của A có `contact_user_id` bằng user id của B.

Cách test update contact:
1. Account A chạy lại `/contacts add Minh <địa-chỉ-mới> on base`.
2. Vào `/contacts`.
3. Kỳ vọng chỉ có một row `Minh`, address và preferred chain được update.

## 13. Pay Contact Hoặc Wallet

Tính năng:
- `/pay 25 to Minh on arc from base`: resolve recipient theo contact của current user.
- Nếu contact là internal Ra user, backend lấy Circle SCA wallet mới nhất của user đó lúc pay.
- Nếu contact là external, backend dùng `contacts.wallet_address`.
- Direct `0x...` recipient vẫn được hỗ trợ.
- Missing contact trả lời rõ cách add contact.

Cách test pay internal:
1. Làm xong test internal contact ở mục 10.
2. Account A chạy `/pay 1 to Minh on arc from base`.
3. Confirm preview.
4. Kỳ vọng payment success, metadata recipient có `resolution = internal`.
5. Nếu account B có wallet mới hơn, cập nhật DB/wallet theo flow tạo wallet mới rồi pay lại.
6. Kỳ vọng recipient address khi pay là Circle wallet mới nhất của B, không nhất thiết là address ban đầu trong contact.

Cách test pay external contact:
1. Tạo contact external `Minh` bằng address ngoài.
2. Chạy `/pay 1 to Minh on arc from base`.
3. Kỳ vọng metadata recipient có `resolution = external` và transfer dùng address đã lưu.

Cách test direct address:
1. Chạy `/pay 1 to 0x1111111111111111111111111111111111111111 on arc from base` với address test hợp lệ.
2. Kỳ vọng metadata recipient có `resolution = direct`.

Cách test missing contact:
1. Chạy `/pay 1 to UnknownName on arc from base`.
2. Kỳ vọng lỗi `Contact not found: UnknownName. Add contact first with \`/contacts add UnknownName 0x... on arc\`.`

Lưu ý hiện tại:
- Chat parser yêu cầu destination chain cho `/pay`, nên nên test qua chat bằng command có `on arc|base|avalanche`.

## 14. Payment Request

Tính năng:
- `/request 25 from Minh on arc`: tạo payment request link `/pay/request/:id`.
- Response có payment URL và QR image URL.
- Payer mở link, login, chọn source chain nếu cần, confirm payment.
- Route pay request gọi Gateway transfer đến `recipient_address` của requester.

Cách test:
1. Account A chạy `/request 1 from Minh on arc`.
2. Kỳ vọng response có `Payment request đã tạo: http://.../pay/request/<id>`.
3. Copy link, mở trong browser khác hoặc incognito, login account B.
4. Trang request hiện amount, chain, recipient address, memo, status.
5. Bấm `Confirm and pay`.
6. Kỳ vọng status request chuyển `paid`, response có tx hash.
7. Account B vào `/notifications`.
8. Kỳ vọng có notification `Payment request paid`.

Lưu ý hiện tại:
- Notification cho requester A khi B pay request chưa đầy đủ trong V1; route hiện ghi notification cho payer.

## 15. Payroll Batch

Tính năng:
- `/payroll run team 25 from base`: tạo payroll batch từ tối đa 25 active contacts của user.
- Mỗi contact thành một payroll item.
- Confirm route chạy từng item tuần tự qua Gateway transfer.
- Batch status: `draft`, `running`, `success`, `partial_failed`, `failed`, `cancelled`.

Cách test:
1. Tạo ít nhất 2 active contacts.
2. Chạy `/payroll run team 1 from base`.
3. Confirm preview.
4. Kỳ vọng batch được tạo, sau đó confirm route chạy từng payment.
5. Kết quả cuối hiện `Payroll success: 2/2 payment thành công` nếu tất cả item pass.
6. Trong Supabase, kiểm tra `payroll_batches` và `payroll_items`.
7. Test partial failure bằng cách dùng một external address hợp lệ nhưng thiếu gas/balance.
8. Kỳ vọng item lỗi có `status = failed`, batch thành `partial_failed`.

## 16. Transaction History

Tính năng:
- `/history`: xem transaction history của user.
- `/history fund`, `/history deposit`, `/history withdraw`, `/history transfer`: lọc theo type.

Cách test:
1. Sau khi test fund/deposit/withdraw/transfer/pay, chạy `/history`.
2. Kỳ vọng response báo số transaction và transaction gần nhất.
3. Chạy `/history deposit`, `/history withdraw`, `/history transfer`, `/history fund`.
4. Kỳ vọng mỗi command chỉ trả row đúng type.

## 17. Notifications

Tính năng:
- Command success/failed trong chat tạo notification local trong UI.
- Backend ghi `notifications` cho payment success, payment request paid, payroll completed.
- Trang `/notifications` lấy tối đa 50 notification mới nhất của user.

Cách test:
1. Chạy một command thành công, ví dụ `/balance`.
2. Kỳ vọng chat có status message.
3. Chạy payment/payroll/payment request paid.
4. Vào `/notifications`.
5. Kỳ vọng thấy notification backend từ command đã ghi DB.
6. Refresh trang.
7. Kỳ vọng notification DB vẫn còn.

## 18. Budgets

Tính năng:
- Trang `/budgets` hiện demo budget cards từ `lib/paycmd/demo-data`.
- Hiện used/limit/available theo nhóm.
- V1 chưa có CRUD budget backend và command budget trong registry hiện tại.

Cách test:
1. Vào `/budgets`.
2. Kỳ vọng thấy các budget demo như Marketing, Contributors, Ops.
3. Kiểm tra progress bar và available amount hiện đúng theo demo data.
4. Refresh trang.
5. Kỳ vọng data không đổi vì là static demo.

## 19. Schedules

Tính năng:
- Trang `/schedules` hiện recurring payment demo cards từ `lib/paycmd/demo-data`.
- V1 dùng manual demo runner, chưa có cron thật.
- API `POST /api/schedules/[id]/run-demo` trả về execution queued demo.

Cách test:
1. Vào `/schedules`.
2. Kỳ vọng thấy các schedule demo và nút `Run demo`.
3. Test API runner bằng command:

```bash
curl -X POST http://localhost:3000/api/schedules/demo-schedule/run-demo
```

4. Kỳ vọng JSON trả về `execution.status = queued`.
5. Lưu ý nút `Run demo` trên UI hiện tại là display control, chưa wire onClick đến API.

## 20. Contacts, Budgets, Schedules Section Pages

Tính năng:
- `/contacts`: đọc contacts của user hiện tại từ Supabase.
- `/budgets`: static demo.
- `/schedules`: static demo.
- Các page dùng chung `PayCmdSectionPage` trong shell Ra.

Cách test:
1. Tạo contact qua `/contacts add`.
2. Vào `/contacts`.
3. Kỳ vọng contact hiện đúng display name, chain/status và wallet address.
4. Logout, login user khác, vào `/contacts`.
5. Kỳ vọng không thấy contacts của user trước đó do RLS/user filter.

## 21. API Parse Và Draft Preview

Tính năng:
- `GET /api/commands/parse`: trả command registry.
- `POST /api/commands/parse`: parse input thành `ParsedCommand`.
- `POST /api/payment-drafts`: tạo draft preview từ input nếu đủ field.

Cách test:
1. Gọi:

```bash
curl http://localhost:3000/api/commands/parse
```

2. Kỳ vọng JSON có danh sách command registry.
3. Gọi:

```bash
curl -X POST http://localhost:3000/api/commands/parse \
  -H 'Content-Type: application/json' \
  -d '{"input":"/pay 1 to Minh on arc from base"}'
```

4. Kỳ vọng `parsed.command = pay`, `missingFields = []`.
5. Gọi `/api/payment-drafts` với input thiếu field.
6. Kỳ vọng HTTP 422 và body `error = missing_fields`.

## Smoke Test Trước Demo

1. Login account A.
2. `/wallet status`
3. `/balance`
4. `/gateway info`
5. `/gas check arc`
6. Mở `/profile`, update display name và handle.
7. `/contacts add Minh <wallet-B> on arc`
8. `/contacts list`
9. `/pay 1 to Minh on arc from base`
10. `/request 1 from Minh on arc`
11. `/payroll run team 1 from base`
12. `/history`
13. Mở `/contacts`, `/notifications`, `/profile`.

## Giới Hạn V1 Cần Nhớ Khi Test

- Không auto execute payment khi chưa confirm.
- Payroll chạy tuần tự trong request, chưa có worker/queue riêng.
- Schedule chưa có cron thật.
- Budgets là static demo, chưa có CRUD/backend.
- Payment request notification cho requester còn hạn chế.
- Chat parser hiện yêu cầu chain cho `/pay` và `/request`; nếu muốn test default chain của resolver, gọi API trực tiếp.
- AI command router phụ thuộc `OPENAI_API_KEY`; không có key thì natural language sẽ fail nhưng slash command vẫn chạy.
