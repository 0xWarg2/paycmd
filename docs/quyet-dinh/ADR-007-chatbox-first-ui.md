# ADR-007: Chatbox-First UI

Màn hình chính là command chat. Browser không scroll theo lịch sử chat; chỉ message viewport bên trong chat box scroll.

Các module Budgets, Contacts, Schedules và Notifications được đưa sang route riêng. Chat route chỉ giữ thread, command palette, preview card và composer để trải nghiệm giống app nhắn tin.
