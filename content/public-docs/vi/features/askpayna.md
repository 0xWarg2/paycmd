---
slug: "features/askpayna"
title: "AskPayna research"
description: "Cách AskPayna tìm nguồn Circle, Arc và Web3 rồi dùng DeepSeek tổng hợp."
section: "features"
order: 40
lastUpdated: "2026-08-05"
keywords: ["AskPayna", "Circle MCP", "Arc MCP", "Tavily", "DeepSeek"]
tutorial: true
aiSummary:
  - "AskPayna dùng tutorial có version cho hướng dẫn Payna, Circle MCP cho Circle, Arc MCP và arc.io cho Arc, Tavily cho Web3 rộng hoặc dữ liệu thời sự, rồi DeepSeek tổng hợp trên evidence."
  - "Citation chỉ được lấy từ retrieval; nguồn lỗi trả partial hoặc unavailable thay vì tạo URL giả."
---

## Khi nào dùng AskPayna

Dùng AskPayna cho câu hỏi kiến thức Web3, crypto, L1/L2, Circle hoặc Arc. Lệnh payment và wallet nên chạy ở Payna mode để có parser, preview và confirmation.

## Thứ tự nguồn

- Hướng dẫn Hey Payna: tutorial song ngữ theo đúng version web app.
- Circle: Circle MCP và tài liệu Circle chính thức.
- Arc: Arc MCP và tài liệu blockchain tại [arc.io](https://www.arc.io/).
- Web3 rộng hoặc dữ liệu cần tính thời sự: Tavily search.
- DeepSeek: tổng hợp evidence, cấu trúc câu trả lời và related questions.

## Chính sách citation

DeepSeek chỉ được cite HTTPS URL do retrieval trả về. Nếu một nguồn timeout hoặc không có key, câu trả lời đánh dấu `partial` hoặc `unavailable`; AskPayna không tự tạo reference. Query chứa seed phrase, private key hoặc API key bị chặn trước external retrieval.
