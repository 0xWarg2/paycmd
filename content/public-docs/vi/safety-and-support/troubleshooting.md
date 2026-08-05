---
slug: "safety-and-support/troubleshooting"
title: "Troubleshooting"
description: "Chẩn đoán lỗi wallet, balance, finality, quote và research mà không lặp lại giao dịch đang chạy."
section: "safety-and-support"
order: 71
lastUpdated: "2026-08-05"
keywords: ["troubleshooting", "gas", "pending", "MetaMask", "Gateway"]
tutorial: true
aiSummary:
  - "Ghép symptom với bước cuối đã xác nhận, chỉ sửa lỗi trước submission, và đối soát mọi hash hoặc transfer ID trước khi retry."
---

## MetaMask không khả dụng hoặc sai chain

**Chẩn đoán:** MetaMask bị khóa/ngắt kết nối, còn request chờ hoặc sai account/network. `/link metamask` mismatch nghĩa là account khác ký `personal_sign`; link không tạo gas transaction.

**Hành động an toàn:** Mở khóa/reconnect, hoàn tất/hủy request, chọn testnet/account rồi tạo preview mới. Kiểm tra name, chain ID, RPC trước khi thêm network.

**Không lặp lại:** Không approve prompt lạ hay ký account khác. Payna confirmation không phải MetaMask signature. Xem [wallet roles](/docs/getting-started/account-and-wallets).

## Login, link hoặc SCA balance mismatch

**Chẩn đoán:** Signed-in user, linked MetaMask, Circle SCA, Gateway depositor/signer có thể khác. Thiếu SCA USDC có thể là MetaMask; total partial là lower bound.

**Hành động an toàn:** Re-authenticate, kiểm tra link và xem đúng SCA/depositor/chain. Phân loại USDC là MetaMask, SCA, Gateway pending hoặc ready.

**Không lặp lại:** Không chỉ query signer, coi partial response là trống hay gửi secret để relink.

## `/fund` so với Gateway balance

**Chẩn đoán:** `/fund` chỉ chuyển MetaMask USDC vào Circle SCA. `/deposit` dùng SCA allowance/Gateway call; deposit confirmed vẫn `pending_gateway_finality` đến khi Circle finality làm ready.

**Hành động an toàn:** Xác nhận SCA balance, chỉ submit `/deposit` nếu chưa có, giữ hash rồi chờ webhook/recovery. Query cùng depositor/domain.

**Không lặp lại:** Không plain-transfer USDC đến Gateway contract hay submit duplicate deposit đang pending. Xem [deposit và finality](/docs/circle/gateway/deposit-and-finality).

## Quote, fee hoặc source amount error

**Chẩn đoán:** Estimate `/transfer` lỗi là read-only. Payna source-scoped: domain `from` cần `amount + estimated fee` dù total lớn hơn.

**Hành động an toàn:** Retry estimate unavailable sau, giảm amount hoặc chờ/deposit USDC finalized trên đúng source. Re-quote khi đổi route, recipient, amount hay mint mode.

**Không lặp lại:** Không coi fee fixed, dùng quote cũ hay mượn thiếu hụt Base từ Arc. Nếu có transfer ID, burn hay forwarding request, hãy đối soát nó.

## Source gas, destination gas hoặc payment mơ hồ

**Chẩn đoán:** Source native gas trả Gateway delegate/approval/deposit; USDC fee riêng. Manual mint cần named SCA/signer gas, auto forwarding thường tránh destination gas. Rail, chain, source/recipient mơ hồ chặn payment.

**Hành động an toàn:** Chỉ fund public address/chain trong error. Làm rõ payment rồi mở preview mới; `/gas <chain>` chỉ hỗ trợ đọc balance.

**Không lặp lại:** Không fund depositor contract, gọi Gateway gas là MetaMask gas hoặc confirm payment mơ hồ. Xem [fees và forwarding](/docs/circle/gateway/fees-gas-and-forwarding).

## CCTP chậm hoặc thiếu mint

**Chẩn đoán:** CCTP source burn có thể success khi attestation/destination mint pending. Manual self-mint cần destination MetaMask gas/signature; CCTP dùng MetaMask USDC, không phải SCA/Gateway balance.

**Hành động an toàn:** Giữ burn hash, route, speed, mint hash. Kiểm tra source burn, query attestation có sẵn, rồi chờ/recover destination mint trên explorer của nó.

**Không lặp lại:** Không burn lần nữa vì `pending_mint`, timeout, thiếu history hay proof. Xem [CCTP guide](/docs/circle/cctp-bridge).

## Arc swap slippage hoặc receipt pending

**Chẩn đoán:** Arc Swap chỉ MetaMask trên Arc Testnet. Liquidity, input, approval, reserve mới hoặc fixed 1% minimum-output guard có thể chặn execution. Swap hash có receipt chưa chắc là pending, không phải failed đã chứng minh.

**Hành động an toàn:** Refresh preflight/quote error và preview lại. Với approval/swap hash, xem ArcScan/allowance trước; fund đúng MetaMask account bằng input token và Arc gas nếu cần.

**Không lặp lại:** Không duplicate approval, đổi slippage ngoài rule hay retry swap có hash vì history chậm. Xem [Arc swaps](/docs/arc/overview-and-swap).

## History, proof hoặc AskPayna source thiếu

**Chẩn đoán:** `/history` chỉ đọc và Arc proof là receipt downstream nên có thể chậm sau action đã chuyển funds. AskPayna `partial` có một phần evidence, `unavailable` không có, `not_applicable` không chọn source family.

**Hành động an toàn:** Xóa filter, gắn nhãn hash theo chain/stage, xem đúng explorer. Thu hẹp research question, retry sau hoặc dùng official docs/reference card.

**Không lặp lại:** Không chạy lại business command vì thiếu record, gọi uncited text là verified hay gửi credential để sửa retrieval. Xem [AskPayna](/docs/features/askpayna) và [proof](/docs/arc/onchain-proof).

## Escalate bằng public evidence

**Chẩn đoán:** Escalation dành cho state hiện có chưa giải quyết, không để bỏ qua finality.

**Hành động an toàn:** Gửi public address/SCA, chain/domain, route, time, transfer ID, hash, proof status, sanitized error và stage cuối đã confirmed.

**Không lặp lại:** Không gửi seed phrase, private key, password, API/session key, signing secret, private RPC detail; không submit money-moving command khác khi state gốc chưa xong.
