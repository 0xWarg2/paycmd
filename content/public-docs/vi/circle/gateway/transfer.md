---
slug: "circle/gateway/transfer"
title: "Gateway transfer"
description: "Estimate và execute Gateway transfer bền vững qua Circle Unified Balance Kit."
section: "circle.gateway"
order: 23
lastUpdated: "2026-08-18"
keywords: ["transfer", "ERC-1271", "unified balance", "idempotency", "forwarding"]
tutorial: true
aiSummary:
  - "Lệnh `/transfer 5 from base to arc` và unified Gateway dùng Circle Unified Balance Kit với chữ ký ERC-1271 trực tiếp từ SCA."
  - "Signed quote 60 giây và durable operation ID ngăn stale execution và duplicate spend."
---

## Estimate

`/transfer 10 from gateway to arc` yêu cầu unified allocation từ Circle Kit. Với scoped syntax quen thuộc như `/transfer 5 from base to arc`, preview vẫn làm rõ source trước khi user chọn unified balance. Estimate trả confirmed, pending và funds-in-motion balance; allocation; fee; quote fingerprint cùng expiry; và các mint mode destination thực sự hỗ trợ.

Amount, allocation và fee luôn là decimal string dựa trên phép tính atomic bigint. Chỉ confirmed fund được allocation, tối đa 16 intent.

Estimate tách ready money khỏi pending deposit và fund đang đi qua settlement. Nó cũng trả capability list thật của destination thay vì giả định mọi network đều hỗ trợ forwarding. Signed quote cover authenticated user, amount, normalized recipient, destination, mint mode và funding mode. Đổi bất kỳ field nào đều cần estimate mới.

Preview là read-only. Nó không provision wallet khác, authorize delegate, submit deposit, ký Burn Intent hoặc chuyển USDC. Server dùng HMAC secret riêng và không fallback sang Circle entity credential để ký quote. Quote từ legacy engine đã xóa cố ý không tương thích dù amount và destination nhìn giống nhau.

## Allocation và fee policy

Circle Kit chọn contributing source từ confirmed SCA-owned Gateway balance. Payna verify mọi source trả về thuộc allowlist hỗ trợ SCA đã phê duyệt và plan không vượt tối đa 16 intent của Circle. Pending balance không thể bù shortfall. Nếu confirmed capacity không đủ amount cùng bounded fee, estimate fail mà không tạo operation.

Mọi money value đi qua API dưới dạng decimal string và chuyển thành atomic USDC unit bằng bigint. Cách này tránh binary floating-point rounding trong amount, allocation total và fee. Receipt đổi atomic value về display string nhưng giữ chính xác settled value.

Dung sai 5% là ceiling quanh fee đã review, không phải quyền đổi recipient, amount, destination, allocation identity hoặc mint mode. Fresh quote vượt ceiling trả refresh error trước submission. Actual fee bằng zero được giữ là zero thay vì bị hiểu nhầm là missing data.

## Confirm và execute

Confirmation bắt buộc UUID operation ID và signed quote fingerprint. Server resolve authenticated user cùng Circle SCA; client không được chọn Gateway engine hoặc signer.

Payna tạo operation trước submission, kiểm tra quote 60 giây và dung sai fee 5%, rồi yêu cầu SCA ký ERC-1271 (`contractSigner: true`). Dùng lại operation ID với transfer input khác trả `409 GATEWAY_OPERATION_ID_CONFLICT`.

Durable row tồn tại trước money-moving call đầu tiên có thể quan sát bên ngoài. Request fingerprint và unique operation ID tạo server-side idempotency. Duplicate với cùng fingerprint trả stored state hoặc result; nó không sign và spend lại. Server không bao giờ tin user ID, SCA address hoặc engine value browser gửi lên.

State change có điều kiện. Retry chỉ advance operation từ prior state dự kiến, ngăn hai request cùng claim pending action. Khi source submission đã biết, generic “retry transfer” không còn an toàn. Activity thay vào đó hiện settlement hoặc đúng một destination continuation được phép.

## Forwarding và Manual mint

Mode khả dụng lấy từ Circle Kit destination capability. Auto forwarding yêu cầu Circle gửi destination mint. Manual mode gửi `gatewayMint` bằng SCA của user và dùng Circle Gas Station khi sponsorship policy cho phép.

Nếu forwarding fail sau khi source spend đã submit, Payna lưu recovery payload riêng tư và cung cấp bước tiếp tục Manual mint. Bước này không tạo Burn Intent mới. Nếu mint thành công nhưng ghi receipt thất bại, retry vẫn bị khóa để operator reconciliation.

Private recovery record chỉ chứa material cần để tiếp tục mint hiện có và được link với transaction, authenticated user cùng operation ID. Record có expiry và atomic claim timestamp. Browser client chỉ nhận Boolean recovery state cùng public identifier, không nhận attestation hay signature.

Khi user bắt đầu Manual mint, Payna claim record trước khi gọi Circle Kit. Pre-mint call fail có thể release claim cho controlled attempt sau. Khi destination transaction hash đã trả về, database failure không release claim: operation thành `reconciliation_required`, vì mint attempt khác có thể duplicate settlement.

## Receipt và privacy

Receipt trả actual source allocation, actual fee, Circle transfer ID, transaction hash và settlement state. Receipt không bao giờ trả raw Circle Kit step, signature, attestation hoặc recovery data.

History legacy vẫn đọc được, nhưng mọi operation mới được gắn `circle_kit`. Quote legacy hoặc hết hạn phải estimate lại và không bao giờ được tự chuyển đổi.

Legacy label chỉ được giữ làm historical data. Không còn runtime engine selector, feature flag, canary branch hoặc automatic rollback path. Deposit, withdrawal và balance helper còn dùng lower-level Gateway API nằm riêng khỏi unified transfer engine và không thể chọn multi-source implementation đã xóa.

## Arc safety

Trước khi ký transfer tới Arc, Payna kiểm tra chain ID `5042002` và gọi `isBlacklisted` trên native USDC cho destination. Address bị chặn, check không khả dụng hoặc RPC mismatch đều fail closed. RPC rate limit dùng bounded retry và failover đã cấu hình; gas được estimate động.

Arc dùng `https://rpc.testnet.arc.io` làm canonical testnet endpoint và `https://testnet.arcscan.app` để inspect public transaction. Native gas accounting dùng 18 decimals, ERC-20/display USDC dùng 6. Payna không dùng hard-coded gas price trong estimate hay receipt. Mainnet registry entry giữ disabled cho tới khi official parameter đầy đủ và live chain probe khớp.

## Ví dụ end-to-end

User preview 8 USDC từ unified Gateway balance tới một Arc address. Circle Kit báo hai confirmed source, allocation, fee và hỗ trợ cả forwarding lẫn Manual mint. Payna trước tiên kiểm tra Arc chain identity cùng recipient blocklist, rồi trả fingerprint hết hạn trong 60 giây. UI chỉ cho user 50 giây confirm để normal network latency không vượt server expiry boundary.

Khi confirm, server tạo operation `A`, tính lại fingerprint, validate signed quote cùng fee ceiling rồi yêu cầu direct ERC-1271 signature từ SCA domain của user. Circle trả một transfer ID. Nếu forwarding settle, operation `A` lưu actual allocation, actual fee và destination hash. Post lại `A` trả existing receipt.

Nếu forwarding fail sau khi Circle nhận spend, operation `A` vào `pending_mint` với private recovery material. UI cung cấp Manual mint cho `A`, không tạo transfer mới. Nếu tab khác thử cùng continuation, chỉ một request claim được. Ranh giới này là lý do post-submit failure tuyệt đối không được xử lý bằng cách sinh UUID mới rồi lặp original spend.

## Response thường gặp

- `GATEWAY_QUOTE_EXPIRED`: lấy và review estimate mới.
- `GATEWAY_QUOTE_ENGINE_MISMATCH`: bỏ quote legacy từ tab cũ.
- `GATEWAY_OPERATION_ID_CONFLICT`: UUID đã bind với input khác.
- `ARC_ADDRESS_BLOCKLISTED`: USDC contract trên Arc báo recipient bị chặn.
- `ARC_BLOCKLIST_CHECK_UNAVAILABLE`: Payna không thể hoàn tất pre-sign check an toàn.
- `GATEWAY_MINT_RECONCILIATION_REQUIRED`: mint đã hoàn tất; không retry.
