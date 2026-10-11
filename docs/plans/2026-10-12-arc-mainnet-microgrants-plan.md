# HeyPayna: Arc mainnet và Microgrants

Ngày lập: 12/10/2026 (giờ Việt Nam)
Repo: /Users/xuanhaj/Dev/Web3Project/paycmd
Website: https://heypayna.xyz

## Mục tiêu

Đưa một luồng thanh toán USDC hoàn chỉnh của HeyPayna lên Arc mainnet, kiểm chứng bằng giao dịch thật, triển khai production và chuẩn bị hồ sơ Arc Microgrants.

Deadline chương trình tại thời điểm tra cứu: 14/10/2026 23:59 ET, tương ứng 15/10/2026 10:59 giờ Việt Nam. Phải kiểm tra lại deadline và thể lệ trước khi nộp.
Nguồn: https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq

Chương trình công bố pool 10.000 USDC, gồm 20 suất × 500 USDC. Không liệt kê doanh thu là điều kiện bắt buộc; không yêu cầu traction, công ty, deck hoặc roadmap. Dự án testnet-only và dự án đã được Circle/Arc tài trợ không đủ điều kiện theo trang chương trình đã đọc. Nhận grant không được bảo đảm.

## Hiện trạng đã kiểm tra

- Website và code vẫn phục vụ Arc Testnet.
- Chain ID testnet: 5042002; RPC mặc định: https://rpc.testnet.arc.io.
- lib/paycmd/arc-rpc.ts chủ động chặn mainnet, kể cả khi điền biến cấu hình.
- Transfer, Gateway, bridge, swap và receipt registry có các tham chiếu testnet.
- Các thay đổi chưa commit hiện có trong phần Gateway phải được giữ nguyên; kiểm tra lại git status trước khi sửa.
- Số liệu website là hoạt động testnet, không phải doanh thu hoặc hoạt động mainnet.

## Phạm vi phiên bản đầu

Luồng: kết nối ví → nhập /pay → preview → xác nhận → ký → chờ receipt → lưu lịch sử → mở explorer.

Ưu tiên chuyển USDC cùng mạng Arc bằng MetaMask để giảm phụ thuộc Circle. Nếu xác minh Circle Wallets hỗ trợ Arc mainnet và tài khoản có đủ quyền, có thể chọn rail Circle. Chốt rail sau bước kiểm tra nền tảng.

Bridge, Gateway, swap và lịch thanh toán chỉ được bật mainnet sau khi kiểm tra riêng. Nếu giữ testnet, phải ghi rõ mạng và chặn sử dụng chúng trong phiên mainnet ở cả UI và API.

## 1. Kiểm tra nền tảng và trạng thái repo (2–3 giờ)

- [ ] Ghi nhận git status, bảo toàn thay đổi hiện có và tạo nhánh triển khai.
- [ ] Xác minh tài liệu chính thức về chain ID, RPC, explorer, USDC native/ERC-20, decimals và gas.
- [ ] Xác minh cách nạp USDC mainnet cho ví thử nghiệm.
- [ ] Kiểm tra hỗ trợ Circle Wallets/Gateway/CCTP và quyền tài khoản nếu sử dụng.
- [ ] Chọn rail thanh toán khả thi.
- [ ] Kiểm tra repo public và rà secrets/dữ liệu riêng trong các file tracked và lịch sử liên quan trước khi công khai.

Đầu ra: cấu hình có nguồn xác minh, rail đã chọn và phụ thuộc còn thiếu. Không đoán địa chỉ contract hoặc tái sử dụng địa chỉ testnet.

## 2. Tách mainnet/testnet (nửa ngày)

- [ ] Thêm Arc mainnet thành cấu hình riêng, giữ testnet.
- [ ] Rà lib/paycmd/chains.ts, web3-chains.ts, rpc-endpoints.ts, arc-rpc.ts và các consumer.
- [ ] Ví/số dư đọc đúng chain và yêu cầu chuyển mạng trước ký.
- [ ] Preview hiển thị mạng, token, số tiền, người nhận và phí.
- [ ] Database lưu network/chain ID; truy vấn lịch sử đúng mạng.
- [ ] Explorer link lấy theo mạng của giao dịch.
- [ ] Chặn tính năng chưa hỗ trợ mainnet ở UI và API.
- [ ] Metrics phân biệt testnet/mainnet.
- [ ] Xử lý đúng đơn vị gas và token theo tài liệu đã xác minh.

Điều kiện hoàn thành: mainnet không thể sử dụng nhầm RPC, token, contract, số dư hay lịch sử testnet. Không thay toàn bộ chuỗi arcTestnet bằng arcMainnet.

## 3. Hoàn thiện payment (nửa ngày)

- [ ] Dùng parser/preview hiện có cho /pay.
- [ ] Kiểm tra địa chỉ, số tiền, đúng chain, số dư và gas.
- [ ] Chỉ thực thi sau xác nhận cụ thể.
- [ ] Khóa thao tác khi đang xử lý, ngăn gửi trùng.
- [ ] Phân biệt chờ ký, đã gửi, pending, thành công, thất bại và từ chối ký.
- [ ] Chỉ ghi thành công sau receipt; có thể tiếp tục kiểm tra sau reload.
- [ ] Lưu transaction hash và explorer link.
- [ ] Kiểm tra receipt registry có bắt buộc cho /pay không. Nếu không, dùng transaction receipt; nếu có, triển khai và kiểm tra contract mainnet.

Điều kiện hoàn thành: không báo thành công giả, không gửi trùng; lịch sử đối chiếu được với chain.

## 4. Kiểm thử và preview (3–4 giờ)

- [ ] Lint/build và các test liên quan đến network, đơn vị tiền, payment, trạng thái giao dịch.
- [ ] Thanh toán hợp lệ.
- [ ] Sai mạng, địa chỉ sai, số tiền 0/vượt số dư, thiếu gas.
- [ ] Người dùng từ chối ký.
- [ ] RPC lỗi và giao dịch pending.
- [ ] Bấm gửi nhiều lần.
- [ ] Reload sau khi có transaction hash.
- [ ] Không lẫn testnet/mainnet.
- [ ] Deploy preview và kiểm tra luồng gần production.

Điều kiện hoàn thành: các kiểm tra liên quan qua, không có lỗi nghiêm trọng còn mở trong luồng payment.

## 5. Giao dịch thật và production (2–3 giờ)

- [ ] Chốt ví gửi/nhận do người dùng kiểm soát và ngân sách USDC tối đa gồm gas.
- [ ] Người dùng xác nhận/ký giao dịch thử mainnet với số tiền nhỏ.
- [ ] Đối chiếu số tiền, người nhận, receipt và trạng thái Payna.
- [ ] Lưu transaction hash, explorer link và video luồng thực tế.
- [ ] Deploy bản đã kiểm tra lên heypayna.xyz.
- [ ] Kiểm tra production, công bố đúng tính năng hỗ trợ mainnet.
- [ ] Chuẩn bị rollback deployment và cơ chế tắt payment mainnet khi có lỗi.

Rollback website không hoàn tác giao dịch blockchain.
Điều kiện hoàn thành: production chạy payment mainnet và có giao dịch xác minh trên explorer.

## 6. Hồ sơ Microgrants (2 giờ)

- [ ] Live deployment: https://heypayna.xyz.
- [ ] Repo public và README hướng dẫn chạy, kiến trúc, cấu hình mẫu, cách reviewer kiểm tra.
- [ ] Mô tả ngắn sản phẩm, vấn đề giải quyết và vai trò của Arc.
- [ ] Profile GitHub/X/Farcaster công khai.
- [ ] Xác nhận chưa nhận tài trợ Circle/Arc cho dự án.
- [ ] Bổ sung video 60–90 giây và explorer link (đề xuất tăng khả năng kiểm chứng).
- [ ] Số liệu cũ ghi rõ testnet; không gọi USDC moved là doanh thu.
- [ ] Kiểm tra form hiện hành và deadline qua link Register trên trang chính thức.

Mô tả dự kiến, chỉ dùng khi đúng với bản mainnet thực tế:

> HeyPayna turns payment instructions into a clear preview and a user-confirmed USDC transaction on Arc. Users can track payment status and verify settlement through explorer-linked transaction history.

## Gate xác nhận sẵn sàng submit

- [ ] Mainnet hoạt động tại thời điểm nộp, có live app và giao dịch xác nhận.
- [ ] Repo public đủ hướng dẫn để reviewer kiểm tra.
- [ ] Thông tin đúng thực tế, tách rõ testnet/mainnet.
- [ ] Đủ điều kiện theo thể lệ/form hiện hành.
- [ ] Hồ sơ có app, repo, mô tả và profile.
- [ ] Người dùng kiểm tra bản production và hồ sơ cụ thể trước bước nộp.

## Thứ tự và ngân sách thời gian

1. Ngày đầu: kiểm tra nền tảng → tách network → hoàn thiện payment.
2. Ngày thứ hai: kiểm thử → preview → giao dịch thật → production → hồ sơ.
3. Để thời gian dự phòng trước deadline cho lỗi RPC, ví, deployment hoặc form.

Ưu tiên payment mainnet → kiểm chứng → hồ sơ → submit. Nếu các rail Circle làm chậm tiến độ, tập trung chuyển USDC cùng mạng qua ví người dùng. Thời lượng là ước tính, sẽ cập nhật sau khi xác minh phụ thuộc.

## Cập nhật triển khai 12/10/2026

Code đã được triển khai trên nhánh `codex/arc-mainnet-microgrants`. Luồng MetaMask tại `/pay` tách riêng mainnet/testnet, tái sử dụng parser /pay, có preview/phí, xác nhận có chữ ký, khóa gửi trùng, lưu hash và chỉ xác minh thành công từ transaction/receipt/USDC Transfer. Lịch sử nằm trong ledger riêng có network/chain ID và RLS. Các rail Circle/Gateway/bridge/swap/schedule của `/app` giữ testnet và chặn mainnet ở parser/API.

Kiểm tra nền tảng đã xác nhận chain mainnet `5042`, RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`, USDC ERC-20 6 decimals và native gas 18 decimals từ tài liệu chính thức và RPC. Repo hiện public. Thay đổi Gateway có sẵn được giữ nguyên và không gộp vào commit triển khai.

Kết quả local: 301 unit test trong workspace; snapshot chỉ chứa code đã commit có 297 unit test, đều qua. 12 kiểm thử UI desktop/mobile, TypeScript, lint và production build đã qua. Lint có 5 warning có sẵn. Kiểm thử UI dùng ví/API giả lập; chưa thay thế kiểm chứng bằng giao dịch thật hoặc kiểm thử trên database production. File tutorial sinh tự động đã được đồng bộ để khớp tài liệu nguồn sau khi CI phát hiện bản cũ.

Người dùng xác nhận chưa nhận tài trợ Circle/Arc và cung cấp ví gửi/nhận `0x83b22dcd84511C4bBb7abcd6b51056D8eA416877`, yêu cầu chi phí thấp nhất. RPC mainnet hiện trả số dư 0 USDC: chưa ký/gửi giao dịch. Lệnh thử dự kiến chuyển `0.000001 USDC` về chính ví này, cộng gas theo preview. Self-transfer được ghi rõ và không tính vào metrics thanh toán cho người khác.

Các gate chưa hoàn tất: apply migration Supabase, kiểm tra database thật, funding ví, người dùng ký giao dịch, receipt/video thực tế, enable/promote production và người dùng kiểm tra hồ sơ trước submit. Mainnet có kill switch `ARC_MAINNET_PAYMENTS_ENABLED` mặc định false. Deadline chính thức đã được kiểm tra lại, vẫn là 15/10/2026 10:59 giờ Việt Nam; form DoraHacks hiện hành chưa đọc được.

Draft PR: https://github.com/0xWarg2/paycmd/pull/13. Preview đã READY; `/pay` trả HTTP 200 và mainnet vẫn tắt: https://paycmd-git-codex-arc-mainnet-microgrants-vuitinhvl7xs-projects.vercel.app/pay. Preview có bảo vệ đăng nhập Vercel. Người dùng chọn Supabase hiện tại `mhfzuslhvrrlnfmqpjgc` và sẽ chạy migration trong SQL Editor; lần kiểm tra gần nhất chưa tìm thấy bảng mới. Preview chưa có service-role key cho database này.

Chi tiết cấu hình, recovery, rollback và giới hạn: [release runbook](2026-10-12-arc-mainnet-release-runbook.md). Hồ sơ reviewable: [submission draft](2026-10-12-arc-microgrants-submission-draft.md). Chưa nộp hồ sơ.
