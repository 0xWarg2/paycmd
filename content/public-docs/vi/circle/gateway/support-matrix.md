---
slug: "circle/gateway/support-matrix"
title: "Gateway network support"
description: "Danh sách Gateway domains và khả năng thao tác của Circle Wallet SDK hiện tại."
section: "circle.gateway"
order: 26
lastUpdated: "2026-08-05"
keywords: ["network", "domain", "Circle SDK", "testnet"]
tutorial: false
aiSummary: []
---

## Hai lớp hỗ trợ

Một network có thể được Circle Gateway liệt kê nhưng current Circle Wallet SDK của Payna chưa thực hiện được SCA hoặc EOA signing operation mà command cần. Generated table bên dưới tách riêng hai câu hỏi này.

**Gateway listed** nghĩa là Payna có public Gateway configuration entry chứa chain label, Circle domain, native USDC address và viem chain definition. Riêng điều này chưa hứa mọi Payna workflow đều tạo được Circle wallet transaction.

**Wallet SDK operations** nghĩa là cả hai Circle blockchain mapping Payna dùng đều available: một cho SCA contract execution và một cho managed EOA signer. “No” vẫn có thể cho phép public read như balance qua configured RPC, nhưng deposit, delegate authorization, manual mint hoặc managed-wallet action khác chưa khả dụng qua current SDK path.

## Domain có nghĩa gì

`domain` là numeric identifier Circle cấp cho blockchain trong Gateway và CCTP message. Nó không phải EVM chain ID và không được thay vào wallet network configuration. Circle duy trì official mapping tại [Gateway supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains).

Payna dùng domain khi query depositor balance, tạo burn intent, match webhook và reconcile processed block height. Balance trên domain 6 và domain 26 vẫn là hai source entry riêng dù value được cộng cho unified visibility.

## Table sinh từ configuration

Các row không phải Markdown viết tay. Documentation page project chúng tại render time từ `GATEWAY_CHAIN_CONFIGS`, cùng configuration mà Gateway SDK của Payna sử dụng. Vì vậy khi thêm, bỏ hoặc remap supported chain, public label, domain và Wallet SDK indicator update mà không cần maintain table thứ hai.

Projection chỉ expose `key`, `label`, `domain` và computed Wallet SDK boolean. Cột “Gateway listed” luôn true cho rendered row vì row tồn tại trong configuration đó.

## Cách hiểu unsupported operation

Wallet SDK “No” nghĩa là “không operable qua Circle managed-wallet flow hiện tại của Payna”, không phải “Circle Gateway protocol không biết domain này”. Không workaround bằng cách chọn chain name gần giống hoặc tự đổi domain. Hãy dùng row có Wallet SDK “Yes”, hoặc chờ application và SDK configuration thêm missing mapping.

Support còn phụ thuộc operation. Auto forwarding, manual mint, deposit, withdrawal và public balance read có dependency khác nhau. Runtime checkpoint phù hợp—transfer estimate panel hoặc confirmed execution response/error—mới là final check. Table row không bảo đảm recipient, gas balance, quote, webhook hay RPC đang healthy tại thời điểm này.

## Phạm vi testnet

Chapter Payna này mô tả integration Gateway **testnet** hiện tại. Chain label như Base Sepolia, Avalanche Fuji, Polygon Amoy và Arc Testnet không được hiểu là mainnet destination. Test token không có giá trị redeem tiền mặt và testnet availability có thể đổi.

Official support page của Circle liệt kê cả testnet/mainnet network và required confirmation. Dùng nó cho protocol coverage, sau đó dùng generated table này cho runtime coverage hẹp hơn của Payna. Solana Devnet có thể có trong list rộng hơn của Circle nhưng không thuộc EVM configuration projection hiện tại của Payna.

## Public data và private configuration

Table cố ý không expose RPC URL, RPC key, Circle API credential, wallet ID, database identifier, private key hay environment-variable override. Các value đó là operational secret hoặc deployment detail và không cần để quyết định public command có được hỗ trợ không.

Khi troubleshoot, chia sẻ public chain label, domain, wallet address, transaction hash, transfer ID và exact error code. Không bao giờ paste credential để chứng minh row đã configured. Việc thiếu private detail trong table là safety property, không phải tài liệu chưa đầy đủ.

## Verification checklist

1. Match chain alias trong command với intended generated row.
2. Xác nhận Circle domain qua official [supported-blockchains reference](https://developers.circle.com/gateway/references/supported-blockchains).
3. Yêu cầu Wallet SDK “Yes” cho Payna SCA hoặc managed-signer transaction.
4. Xác nhận cả source và destination đáp ứng operation need.
5. Với transfer, lấy fresh estimate panel; với withdrawal, fee, balance, gas và signer chỉ được check sau confirmation.
6. Coi unsupported là hard stop; không patch domain hoặc RPC value trong client request.
