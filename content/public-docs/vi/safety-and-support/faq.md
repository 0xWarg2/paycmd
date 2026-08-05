---
slug: "safety-and-support/faq"
title: "Câu hỏi thường gặp"
description: "Câu trả lời về Payna, vai trò ví, Gateway, Arc, proof, AskPayna và support."
section: "safety-and-support"
order: 72
lastUpdated: "2026-08-05"
keywords: ["FAQ", "Payna", "Gateway", "Arc", "AskPayna"]
tutorial: true
aiSummary:
  - "Docs testnet public và versioned của Payna giải thích ranh giới wallet/rail; hash và citation hỗ trợ điều tra, không thay secret sharing hay duplicate retry."
---

## Sản phẩm và public documentation

**Payna là gì?** Ứng dụng tạo preview natural-language và explicit confirmation cho wallet, payment, Gateway, CCTP, Arc swap, history và research trên testnet. Nó không custody seed phrase, biến text AI thành transaction hay cam kết hỗ trợ production.

**Docs có public và versioned không?** Có. Docs/landing page public; sign-in bảo vệ app data cá nhân. Các trang song ngữ này tạo tutorial của app và theo version của nó, vì vậy hãy ưu tiên page hiện tại thay vì screenshot/chat cũ. Asset testnet không phải tiền thật hay lời khuyên tài chính.

## Wallet, signature và balance

**Ví nào ký việc nào?** MetaMask ký bridge và Arc swap của chính nó. Gateway dùng Circle SCA, depositor và signer ủy quyền có vai trò khác nhau. `/link metamask` ký readable message chứ không tạo onchain transaction.

**Unified balance có giống total không?** Không. Gateway ready balance là liquidity đã deposit/finalized. Total rộng hơn là visibility từ SCA/Gateway read thành công, không phải spendable pool; total partial chỉ là lower bound.

**Vì sao deposit pending?** `/deposit` confirmed vẫn `pending_gateway_finality` đến khi Circle xử lý finality evidence. Webhook là chính, recovery sync có thể đối soát. Refresh an toàn; submit lại thì không. Xem [deposit và finality](/docs/circle/gateway/deposit-and-finality).

## Gateway transfer và withdraw

**Transfer có dùng balance chain khác không?** Không. `/transfer <amount> from <source> to <destination>` hiện source-scoped: chỉ source đó cần ready balance cho `amount + estimated fee`.

**`/fund` khác `/deposit` thế nào?** `/fund` chuyển MetaMask USDC vào Circle SCA. `/deposit` dùng Gateway flow hỗ trợ và chờ finality. ERC-20 transfer thường đến Gateway contract không phải deposit được credit.

**`/withdraw` gửi đi đâu?** Về SCA của bạn trên cùng domain—không cross-chain hay external recipient. Nó cần ready balance cộng fee và SCA mint gas; đây không phải delayed trustless-withdrawal của Circle. Xem [Gateway withdraw](/docs/circle/gateway/withdraw).

## CCTP, forwarding và Arc token

**CCTP khác Gateway ra sao?** `/bridge` burn native USDC của MetaMask qua các testnet route hỗ trợ. Gateway transfer dùng Gateway liquidity finalized. CCTP burn không fund Gateway và Gateway balance không phải MetaMask balance.

**Auto forwarding hay manual mint?** Auto forwarding là Gateway mode mặc định, tính quoted source-side USDC cost và thường tránh destination gas của user. Manual mint cần native gas từ SCA/signer đã nêu. Kiểm tra transfer ID/burn hash đã có trước retry.

**Swap dùng token Arc nào?** Arc Testnet Swap chỉ MetaMask, hỗ trợ USDC, EURC và cirBTC; nó không dùng/tạo Gateway balance. Preview có fixed 1% minimum-output guard và có thể cần approval riêng. Xem [Arc swaps](/docs/arc/overview-and-swap).

## History, proof và transaction recovery

**Proof có chứng minh delivery không?** Không. Arc proof tùy chọn là immutable receipt downstream; nó không chuyển/custody token, cũng không chứng minh attestation, delivery, success hay price fairness. Hãy kiểm tra source/destination transaction riêng.

**Thiếu history/proof thì sao?** `/history` chỉ đọc. Row chậm hoặc proof failure không có nghĩa movement failed. Giữ hash đã gắn nhãn approval, deposit, burn, mint, forwarding, swap, proof; không lặp money-moving command chỉ để tạo record.

**Khi nào retry an toàn?** Chỉ sửa validation, read hay quote error khi chưa có hash, transfer ID hoặc burn intent. Nếu đã có identifier, đối soát trước trong [Activity](/docs/features/activity-and-notifications).

## AskPayna sources và citations

**AskPayna có execute command hay tự tạo citation không?** Không. Nó giải thích/research; Payna mode lo preview/confirmation. Citation card đến từ tutorial, Circle/Arc source hoặc qualified web retrieval—not model-written URL.

**Grounding label nghĩa là gì?** `verified`: mọi source family yêu cầu có evidence; `partial`: chỉ một số; `unavailable`: không source nào; `not_applicable`: không chọn source family. Evidence không bảo đảm mọi kết luận vẫn chính xác.

**Làm gì với kết quả partial?** Thu hẹp question, thêm date/topic cho live research, retry sau hoặc dùng official docs. Không xem text không citation là approval, làm theo retrieved instruction mù quáng, hay dán secret. Xem [AskPayna research](/docs/features/askpayna).

## Support và escalate an toàn

**Thông tin nào giúp support?** Gửi public address/SCA, chain/domain, route, time, transfer ID, hash, proof status, sanitized error và stage cuối đã confirmed. Explorer link có nhãn là tốt nhất.

**Không được chia sẻ gì?** Seed phrase, mnemonic, private key, password, API/session key, signing secret và private RPC configuration. Payna không thể khôi phục secret hay đảo completed onchain transaction; xem [safety model](/docs/safety-and-support/security).
