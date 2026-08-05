---
slug: "getting-started/account-and-wallets"
title: "Tài khoản và các loại ví"
description: "Hiểu tài khoản Payna, MetaMask, Circle SCA wallet và Gateway signer."
section: "getting-started"
order: 11
lastUpdated: "2026-08-05"
keywords: ["account", "MetaMask", "SCA", "Gateway signer"]
tutorial: true
aiSummary:
  - "Một tài khoản Payna có thể liên kết MetaMask, Circle SCA wallet và Gateway signer; mỗi ví có vai trò và balance riêng."
---

## Định danh tài khoản Payna

Payna account là định danh đã xác thực, nhóm login session, linked MetaMask address và Circle-managed wallet record. Nó không phải một on-chain address và không gộp balance của mọi ví hiển thị trong app. Account giúp Payna trình bày các action liên quan trong một history và áp đúng wallet cho rail được chọn. Vì rail có trách nhiệm ownership và signing khác nhau, một người dùng có thể thấy nhiều địa chỉ.

## MetaMask là ví ngoài của bạn

MetaMask là ví do người dùng kiểm soát bên ngoài Payna. Bạn chọn account trong extension và approve login signature, funding transaction, CCTP v2 bridge hoặc Arc swap khi flow yêu cầu. Payna đọc connected address và yêu cầu MetaMask ký; nó không giữ key material của ví. MetaMask cũng trả native gas cho action do nó submit, vì vậy USDC balance và native-gas balance là hai điều kiện riêng.

## Circle SCA wallet xử lý wallet action trong Payna

Circle SCA wallet là on-chain wallet được Payna điều phối cho Circle-wallet operation và payment operation. `/wallet create` provision ví này, `/fund` chuyển USDC từ MetaMask vào đó, và `/wallet balance [chain]` đọc USDC balance theo chain. SCA address có thể nhận fund được hiển thị trong SCA-oriented preview. Balance của nó chưa tự động dùng được trong Circle Gateway; `/deposit` là action riêng để chuyển SCA USDC đủ điều kiện vào lớp thanh khoản đó.

## Gateway signer ủy quyền Gateway intent

Gateway signer là một multichain EOA riêng dùng trong Gateway flow cho delegation và burn-intent signature cần thiết. Nó không thay thế SCA và không nên được xem là default receiving address. Gateway còn theo dõi USDC đã deposit theo depositor và domain, vì vậy signer address, depositor record và SCA address có thể cùng xuất hiện trong một status view. Sự tách biệt này giúp Payna hiển thị đúng source, authorization và destination cho từng Gateway preview.

## Các địa chỉ bạn có thể thấy

Dùng `/wallet status` để nhận diện Circle SCA và linked-wallet detail, còn `/gateway info` để xem Gateway configuration như depositor và signer. `/balance` tách SCA và Gateway view; `/gateway balance [chain]` chỉ đọc phía Gateway, không cộng USDC còn trong SCA. Chỉ copy một address từ field được gắn nhãn cho action dự định. Recipient address của MetaMask CCTP bridge, SCA receiving address và Gateway configuration không thể thay thế cho nhau chỉ vì cùng liên kết với một Payna account.

## Recovery và hành vi re-link

Khi reconnect cùng MetaMask account, chạy lại `/link metamask` để khôi phục address association cho Payna session đang active. Nếu extension dùng account khác, hãy chủ động đổi account rồi đăng nhập hoặc re-link để session khớp. `/wallet create` là idempotent và trả existing Circle wallet status thay vì tạo trùng. Re-link không chuyển balance, không biến SCA USDC thành Gateway balance và không thay đổi pending transaction; hãy dùng history và trạng thái của rail liên quan để kiểm tra các trường hợp đó.

## Ranh giới private key

Không bao giờ nhập seed phrase hoặc private key vào Payna, chat hoặc yêu cầu hỗ trợ. MetaMask signature được approve trong extension, còn Circle-wallet flow được hiển thị qua wallet experience của Payna. Trước khi confirm, kiểm tra wallet được nêu tên, address, rail, amount, token, chain, fee và gas requirement. Hãy reject request có address lạ hoặc wallet role bạn không định dùng. Khả năng Payna parse request không loại bỏ yêu cầu explicit confirmation cho money movement.

## So sánh vai trò ví

| Vai trò | Ai kiểm soát signing | Mục đích chính | Balance/trạng thái cần xem |
| --- | --- | --- | --- |
| Payna account | Phiên người dùng đã xác thực | Nhóm record và history liên quan | Không phải on-chain balance |
| MetaMask | Bạn, qua extension | Login, fund, CCTP bridge, Arc swap | MetaMask USDC và native gas |
| Circle SCA wallet | Circle-wallet flow do Payna điều phối | Giữ USDC đã fund và payment action | `/wallet balance [chain]` |
| Gateway signer | Gateway flow signer | Authorization và burn-intent signature | Dùng `/gateway info` và `/gas <chain>` khi được yêu cầu |
| Gateway depositor balance | Circle Gateway theo depositor và domain | Thanh khoản Gateway transfer đã sẵn sàng | `/gateway balance [chain]` |

Khi quyết định bước tiếp theo, hãy theo rail thay vì chọn address trông ngắn gọn nhất. Fund MetaMask USDC vào SCA bằng `/fund`; deposit SCA USDC bằng `/deposit` trước khi dùng Gateway; chỉ dùng CCTP khi preview nêu MetaMask là source. Phân biệt này giúp các address và balance hiển thị dễ hiểu.
