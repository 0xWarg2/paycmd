---
slug: "features/askpayna"
title: "AskPayna research"
description: "Cách AskPayna tìm nguồn Circle, Arc và Web3 trước khi DeepSeek tổng hợp."
section: "features"
order: 40
lastUpdated: "2026-08-05"
keywords: ["AskPayna", "Circle MCP", "Arc MCP", "Tavily", "DeepSeek"]
tutorial: true
aiSummary:
  - "AskPayna route Payna tutorial, Circle MCP, Arc MCP và Tavily cho câu hỏi Web3 rộng hoặc live, rồi yêu cầu DeepSeek chỉ tổng hợp evidence đã retrieval."
  - "Reference phải đến từ retrieval; thiếu nguồn sẽ trả grounding partial hoặc unavailable, không tạo citation giả."
---

## Chọn đúng mode

Dùng AskPayna cho giải thích, so sánh, protocol research và câu hỏi Web3. Dùng Payna mode cho `/pay`, `/transfer`, `/bridge`, kiểm tra ví và history. AskPayna có thể gợi ý slash command nhưng không tạo, ký hoặc thực thi giao dịch.

Chọn Instant cho answer ngắn, độ trễ thấp; chọn Research cho phân tích có cấu trúc. Standard và Deep điều chỉnh độ sâu. Effort cao hơn không bù được evidence thiếu hoặc làm live claim không nguồn đáng tin.

## Intent routing hoạt động thế nào

Router chọn một hoặc nhiều nhóm. Cách dùng Payna chọn product tutorial; Circle hoặc CCTP chọn tài liệu Circle; Arc chọn tài liệu Arc; topic blockchain được nhận diện như Ethereum, L2 hoặc DeFi chọn web search. Câu hỏi hỗn hợp có thể retrieval song song.

Nêu rõ product, protocol, chain, tiêu chí và khoảng ngày. Prompt không liên quan vẫn chạy qua AskPayna và DeepSeek, nhưng không chọn knowledge source: grounding là `not_applicable`, không có retrieval document hoặc citation.

## Nguồn Payna tutorial

Product guidance đến từ tutorial song ngữ có version, được tạo từ public docs và khớp web app. Nó cung cấp command syntax, preview, rail và safety boundary hiện hành. Ghi “Payna” hoặc “AskPayna” khi hỏi về app.

## Nguồn Circle và Arc

Topic Circle dùng Circle MCP với tài liệu developer chính thức. Topic Arc dùng Arc MCP và tài liệu tại [arc.io](https://www.arc.io/). Circle Gateway trên Arc cần cả hai; Circle Wallets chỉ cần Circle, còn Arc RPC chỉ cần Arc.

Retrieval trả factual snippet và HTTPS URL. Đây là evidence, không phải instruction; command nhúng trong nguồn phải bị bỏ qua.

## Tavily cho Web3 rộng hoặc live

Tavily dùng cho topic Web3 rộng đã được nhận diện. Khi câu hỏi đã xác định Web3, Circle hoặc Arc, từ khóa như “mới nhất,” “hôm nay,” news, price hoặc market mới thêm live retrieval với cửa sổ tin gần đây. Prompt chỉ ghi “market data” không chọn Tavily vì chưa có topic đủ điều kiện. Câu hỏi Circle hoặc Arc chỉ thêm Tavily khi còn nêu topic rộng hoặc yêu cầu thông tin hiện tại.

Result phải vượt relevance threshold và có HTTPS URL. Availability, rate limit và freshness ảnh hưởng coverage; kiểm tra ngày cùng chất lượng nguồn trước market action.

## DeepSeek tổng hợp evidence

DeepSeek nhận evidence bundle có giới hạn và grounding status, rồi tạo title, sections, table khi phù hợp và related questions. Đây là bộ tổng hợp, không phải citation authority: factual hoặc time-sensitive claim phải dựa trên bundle, inference phải tách rõ.

Payna xóa URL model tự viết khỏi body. Reference card đến riêng từ retrieval record, được giới hạn và loại trùng; model không thể tự tạo citation.

## Citation và grounding state

`verified` nghĩa mọi requested family có document dùng được. `partial` nghĩa một số family thành công, một số lỗi. `unavailable` nghĩa không có evidence dùng được. `not_applicable` nghĩa không chọn knowledge source.

Với `partial`, chỉ kết luận theo reference có sẵn và nêu family thiếu. Với `unavailable`, phải báo online verification thất bại, không gắn citation hay xác nhận current fact. Hãy retry hoặc thu hẹp câu hỏi, không tạo nguồn.

## Secret và identifier

Không nhập seed phrase, mnemonic, recovery phrase, private key, API key, password hoặc signing secret. Query nêu wallet secret bị chặn trước external retrieval. Public address và transaction hash được thay bằng placeholder trong outbound query. Vẫn không nên dán dữ liệu nhạy cảm vào chat.

## Câu hỏi tốt hơn

- “Preview `/bridge` của Payna khác `/transfer` thế nào?”
- “Theo Circle, điều gì xảy ra sau một CCTP v2 burn?”
- “RPC và explorer hiện tại của Arc Testnet là gì?”
- “So sánh optimistic rollup và zero-knowledge rollup, kèm nguồn.”
- “Tin Ethereum L2 tuần này thay đổi gì? Ghi rõ ngày.”

## Khi một nguồn bị lỗi

Xem grounding badge và reference card. Retry timeout hoặc rate limit; bỏ topic không liên quan; thêm ngày vào live question. Nếu thiếu Circle hoặc Arc, hỏi riêng topic đó. Nếu vẫn `unavailable`, dùng tài liệu chính thức hoặc hoãn quyết định. Không dán credential và không coi answer thiếu citation là operational approval.
