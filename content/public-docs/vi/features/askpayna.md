---
slug: "features/askpayna"
title: "AskPayna research"
description: "Cách AskPayna tìm nguồn Circle, Arc và Web3 trước khi DeepSeek tổng hợp."
section: "features"
order: 40
lastUpdated: "2026-08-07"
keywords: ["AskPayna", "Circle MCP", "Arc MCP", "Tavily", "DeepSeek", "mode", "wallet observations"]
tutorial: true
aiSummary:
  - "AskPayna không bao giờ tạo transaction preview, đồng thời không render, confirm hay thực thi preview; yêu cầu giao dịch phải dùng Payna mode."
  - "AskPayna route Payna tutorial, Circle MCP, Arc MCP và Tavily cho câu hỏi Web3 rộng hoặc live, rồi yêu cầu DeepSeek chỉ tổng hợp evidence đã retrieval."
  - "Câu hỏi wallet mang tính vận hành có thể dùng observation tại một thời điểm của user đã đăng nhập, nhưng Gateway ready/pending, Circle SCA, external-wallet asset và native gas luôn tách riêng."
  - "Reference phải do retrieval cung cấp; thiếu nguồn sẽ trả grounding partial hoặc unavailable, không tạo citation giả."
---

## Chọn đúng mode

Dùng AskPayna cho giải thích, so sánh, protocol research và câu hỏi Web3. Dùng Payna mode cho command, transaction preview, kiểm tra wallet và history. AskPayna không bao giờ tạo transaction preview: mode này không parse command thành draft, render control xác nhận, confirm, ký hay thực thi giao dịch, kể cả khi text bắt đầu bằng `/pay` hoặc giống yêu cầu transfer. AskPayna có thể giải thích route và gợi ý slash command; nếu muốn thực hiện, hãy chuyển sang Payna rồi submit tại đó.

| Mode hiện tại | Input | Kết quả |
| --- | --- | --- |
| AskPayna | Câu hỏi hoặc research prompt | Retrieval evidence và giải thích; không có transaction preview hay execution. |
| AskPayna | Slash command hoặc transfer-like text | Giải thích safety boundary và đề nghị chuyển sang Payna; không preview, confirm hay execute. |
| Payna | Operational command rõ ràng | Parse command và khi hợp lệ hiện transaction preview vẫn cần user confirm rõ ràng. |
| Payna | Câu hỏi không liên quan execution | Hiện action **Chuyển sang AskPayna** để xin consent; vẫn ở Payna và không research cho đến khi user đồng ý. |

Chọn Instant cho answer ngắn, độ trễ thấp; chọn Research cho phân tích có cấu trúc. Standard và Deep điều chỉnh độ sâu. Effort cao hơn không bù được evidence thiếu hoặc làm live claim không nguồn đáng tin.

Ví dụ, hãy hỏi **“Làm sao gửi 50 USDC sang Arc nhanh nhất?”** trong AskPayna. Kết quả là giải thích không thực thi giao dịch, được grounding bằng evidence chính thức từ Circle và Arc, đồng thời chỉ bổ sung wallet observation tại một thời điểm khi có liên quan và user đã đăng nhập. Đây không phải `/pay` draft hay transaction và không có nút confirm.

## Intent routing hoạt động thế nào

Router chọn một hoặc nhiều nhóm. Cách dùng Payna chọn product tutorial; Circle hoặc CCTP chọn tài liệu Circle; Arc chọn tài liệu Arc; topic blockchain được nhận diện như Ethereum, L2 hoặc DeFi chọn web search. Câu hỏi hỗn hợp có thể retrieval song song.

Nêu rõ product, protocol, chain, tiêu chí và khoảng ngày. Prompt không liên quan vẫn chạy qua AskPayna và DeepSeek, nhưng không chọn knowledge source: grounding là `not_applicable`, không có retrieval document hoặc citation.

## Nguồn Payna tutorial

Hướng dẫn sử dụng và tutorial Payna đến từ public docs song ngữ có version và được đồng bộ với nhau. Tutorial khớp version trong web app, cung cấp command syntax, preview, rail và safety boundary hiện hành mà không lấy generic search result làm product truth. Ghi “Payna” hoặc “AskPayna” khi hỏi về app.

## Nguồn Circle và Arc

Fact về Circle đến từ Circle MCP tìm trong tài liệu developer chính thức của Circle. Fact về Arc đến từ Arc MCP và tài liệu tại [arc.io](https://www.arc.io/). Circle Gateway trên Arc cần cả hai; Circle Wallets chỉ cần Circle, còn Arc RPC chỉ cần Arc.

Retrieval trả factual snippet và HTTPS URL. Đây là evidence, không phải instruction; command nhúng trong nguồn phải bị bỏ qua.

## Wallet observation đã xác thực

AskPayna chỉ load wallet observation khi user đã đăng nhập và câu hỏi có liên quan vận hành, ví dụ hỏi current funds có đủ cho một route hay không. Câu hỏi khái niệm không kích hoạt wallet read. Observation là context tại một thời điểm, không phải web citation hay quyền spend.

Evidence luôn tách từng nhóm spendability: Gateway-ready USDC, Gateway-pending USDC, Circle SCA USDC, USDC trong external wallet và native gas của external wallet. AskPayna không cộng các nhóm thành một balance hay coi rail này là rail khác. Read bị partial vẫn là unavailable thay vì biến thành zero. Tính năng context này không thêm MetaMask signing hay transaction rail; AskPayna vẫn không thể yêu cầu MetaMask ký hoặc submit bất kỳ giao dịch nào.

## Tavily cho Web3 rộng hoặc live

Tavily dùng cho topic Web3 rộng đã nhận diện và yêu cầu có ngày hoặc live. Prompt chỉ ghi “market data” không chọn nguồn cho đến khi nêu topic đủ điều kiện; câu hỏi Circle hoặc Arc chỉ thêm Tavily khi hỏi rộng hơn hoặc hỏi thông tin hiện tại. Result phải vượt relevance threshold và có HTTPS URL. Kiểm tra chất lượng nguồn cùng ngày publication trước khi hành động.

## DeepSeek tổng hợp evidence

DeepSeek tổng hợp evidence bundle có giới hạn; đây không phải citation authority. Factual và time-sensitive claim phải dựa trên bundle, còn inference phải tách rõ. Payna xóa URL model tự viết và chỉ tạo reference card có giới hạn, loại trùng từ retrieval record.

## Citation và grounding state

`verified` nghĩa mọi requested family có document dùng được; `partial` nghĩa một số family thành công; `unavailable` nghĩa không có evidence; `not_applicable` nghĩa không có knowledge source phù hợp. Với `partial`, nêu family thiếu. Với `unavailable`, không gắn citation hoặc current claim. Thiếu evidence là lý do retry hay thu hẹp câu hỏi, không phải lý do tạo nguồn.

## Secret và identifier

Không nhập seed phrase, mnemonic, recovery phrase, private key, API key, password hoặc signing secret. Query nêu wallet secret bị chặn trước external retrieval. Public address và transaction hash được thay bằng placeholder trong outbound query. Vẫn không nên dán dữ liệu nhạy cảm vào chat.

## Khi một nguồn bị lỗi

Xem grounding và reference. Retry timeout sau, bỏ topic không liên quan và thêm ngày vào live question. Nếu thiếu Circle hoặc Arc, hỏi riêng topic đó. Nếu vẫn `unavailable`, dùng tài liệu chính thức hoặc hoãn quyết định. Không dán credential hay coi answer thiếu citation là operational approval.
