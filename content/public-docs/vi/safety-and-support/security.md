---
slug: "safety-and-support/security"
title: "Mô hình an toàn"
description: "Bảo vệ private key, preview, confirmation và ranh giới khôi phục trên testnet."
section: "safety-and-support"
order: 70
lastUpdated: "2026-08-05"
keywords: ["security", "seed phrase", "confirmation", "testnet"]
tutorial: true
aiSummary:
  - "Payna hướng tới testnet: không chia sẻ secret ví, kiểm tra mọi preview và signature, rồi kiểm tra giao dịch đã submit trước khi retry."
---

## Bắt đầu từ ranh giới testnet

Các luồng wallet, Gateway, CCTP, Arc swap và proof của Payna hướng tới testnet. Asset testnet không phải tiền production hay cam kết route production được hỗ trợ. Hãy thử nhỏ, kiểm tra network và không xem AskPayna là lời khuyên tài chính, pháp lý hoặc đầu tư.

## Giữ mọi secret ngoài chat

Không nhập seed phrase, mnemonic, recovery phrase, private key, password, API key, session token, RPC credential hay signing secret vào Payna, AskPayna, support hoặc form mở từ chat. MetaMask xử lý prompt authentication, `/fund`, CCTP và swap của riêng nó; Circle SCA/Gateway operation dùng Circle wallet và Gateway signing role đã nêu, không dùng MetaMask. Payna không cần wallet secret. AskPayna chặn secret-bearing query, redacts public identifier khi search, nhưng điều đó không cho phép dán dữ liệu nhạy cảm.

Public address, transaction hash, transfer ID, chain, thời điểm và lỗi đã loại thông tin nhạy cảm thường đủ để điều tra. Nếu một prompt đòi secret để khôi phục balance, hãy đóng nó và dùng quy trình recovery chính thức của ví.

## Kiểm tra chính wallet prompt

Trước khi chấp nhận MetaMask authentication, `/fund`, CCTP hoặc swap prompt, kiểm tra account, chain, contract/spender, amount và gas. Payna confirmation khác wallet signature. Circle SCA/Gateway operation thay vào đó dùng Circle wallet và Gateway signer role đã nêu. Từ chối signature/network addition bất ngờ và so sánh name, chain ID, RPC đề nghị với guide.

Circle SCA, Gateway depositor, Gateway signer được ủy quyền và MetaMask account có vai trò khác nhau. Đặc biệt, USDC trong SCA không phải Gateway balance sẵn sàng và Gateway signer không tự động là chủ balance. Xem [vai trò ví](/docs/getting-started/account-and-wallets) và [Gateway overview](/docs/circle/gateway/overview) trước khi chuyển tiền.

## Coi preview là điểm kiểm tra bắt buộc

Natural language/parser chỉ chuẩn bị intent, không thể bỏ qua explicit confirmation. Kiểm tra amount, token, rail, chain, full recipient, mint mode, estimated fee, source debit và gas payer. Với swap xem route/minimum output/slippage; với payment/transfer xác nhận source đã nêu.

Hủy khi bất kỳ trường nào khác yêu cầu của bạn. Mở preview mới sau khi đổi amount, recipient, route, source, destination hoặc mint mode vì quote và balance có thể cũ. Các guide [Gateway fees và forwarding](/docs/circle/gateway/fees-gas-and-forwarding), [CCTP bridge](/docs/circle/cctp-bridge) và [Arc swap](/docs/arc/overview-and-swap) giải thích các bước confirmation bổ sung của từng rail.

## Kiểm tra address, chain và allowance

Xác minh toàn bộ copied address từng ký tự với nguồn tin cậy hoặc address-book entry đã xác minh; không dùng kiểm tra chỉ prefix/suffix vì không ngăn address poisoning. Xác nhận source và destination là đúng testnet, đồng thời chỉ mở hash trên explorer của chain đó. Hash không thấy trên explorer sai không nói lên điều gì.

ERC-20 approval cấp quyền spender và là action riêng tốn gas. Đọc scope/network trong MetaMask. Không plain-transfer USDC đến Gateway contract: đó không phải deposit và có thể mất; dùng `/deposit`. Cẩn thận external link; không import wallet, approve contract hay cài extension chỉ vì chat yêu cầu.

## Biết khi nào retry an toàn

Thông thường có thể sửa và retry lỗi validation, yêu cầu wallet bị từ chối, balance check chỉ đọc hoặc lỗi transfer quote khi chưa có transaction, deposit, burn hash hay transfer ID. Refresh Gateway deposit recovery, kiểm tra status hoặc mở lại Activity cũng an toàn vì không submit transfer khác.

Khi đã có deposit, approval, delegate, CCTP burn, Gateway transfer, forwarding, manual mint hay swap hash, state có thể đổi. Không lặp lại vì chat/history/proof chậm. Burn có thể chờ mint, deposit có thể `pending_gateway_finality`, Arc proof không chuyển tiền. Đối soát identifier trong [Activity](/docs/features/activity-and-notifications).

## Checklist khi có sự cố

1. Dừng ký và lưu command, route, thời điểm, public hash và transfer ID.
2. Xác định bước cuối đã xác nhận: approval, deposit, source burn, forwarding, mint, swap hay proof.
3. Kiểm tra đúng explorer và Activity row tương ứng; phân biệt `pending` với `success`.
4. Dùng hướng dẫn recovery riêng của rail trước mọi submission mới.
5. Chỉ gửi identifier công khai và lỗi đã lọc. Không gửi secret, authentication token hoặc cấu hình riêng.

Nếu nghi ngờ ví bị xâm phạm, ngắt session liên quan và liên hệ wallet provider qua kênh chính thức đã xác minh. Payna không thể khôi phục seed phrase hoặc đảo ngược transaction onchain đã hoàn tất.
