---
slug: "circle/gateway/withdraw"
title: "Gateway withdrawal"
description: "Đưa confirmed Gateway USDC về Circle SCA của user trên cùng domain."
section: "circle.gateway"
order: 24
lastUpdated: "2026-08-18"
keywords: ["withdraw", "Gateway", "ERC-1271", "SCA"]
tutorial: true
aiSummary:
  - "Payna withdrawal burn và mint trên cùng Gateway domain về Circle SCA của user."
  - "SCA ký trực tiếp bằng ERC-1271; không tạo hoặc authorize delegate EOA."
---

## Same-domain withdrawal

`/withdraw 10 from base` đưa confirmed Gateway USDC trên Base về ordinary USDC trong Base Circle SCA của user. Đây là same-domain Gateway Burn Intent rồi `gatewayMint`, không phải trustless recovery bảy ngày.

Source và destination domain giống nhau, recipient là SCA của authenticated user. Withdrawal không chọn external recipient và không chuyển fund tới MetaMask. Ordinary SCA balance chỉ tăng sau khi destination mint settle. Trước đó Activity có thể hiện funds in motion dù source Gateway balance đã được commit.

Gateway recovery bảy ngày là trustless fallback riêng cho protocol recovery. Normal withdrawal của Payna dùng regular spend-and-mint flow của Circle và không nên được mô tả với recovery delay. Support cần xác định path nào tạo transaction trước khi hướng dẫn timing.

## Preview boundary

Preview xác nhận amount, selected domain, receiving SCA, current balance state, estimated fee và gas responsibility. Nó là read-only: không sign, burn, mint hoặc khởi tạo wallet thứ hai. Nếu quote hết hạn, user review quote mới thay vì để server execute với fee hoặc block constraint đã cũ.

Chỉ confirmed Gateway balance tiêu được. Pending deposit vẫn hiện nhưng không thỏa `amount + fee`. Deposit transaction confirmed on-chain vẫn có thể ở pending finality khi Circle chờ required confirmation của domain và index nó. Payna dựa vào signed deposit webhook cùng reconciliation read thay vì giả định một receipt nghĩa là Gateway balance đã ready.

Mọi money value vẫn là decimal string dựa trên atomic bigint. Payna không dùng JavaScript `Number` hay `parseFloat` để quyết định balance có cover withdrawal không. Điều này quan trọng gần ranh giới sáu decimals của USDC, nơi display value đã round không được authorize atomic debit lớn hơn.

## Authorization và fee check

Sau confirmation, Payna resolve SCA của authenticated user, estimate Gateway fee và yêu cầu confirmed source balance đủ `amount + fee`. SCA ký Burn Intent trực tiếp bằng ERC-1271 với `contractSigner: true`. Không có delegate stage hoặc EOA fallback.

Destination mint transaction dùng cùng SCA và cần native gas được estimate động nếu Circle Gas Station không sponsor.

Direct ERC-1271 authorization nghĩa Gateway depositor và protocol field `sourceSigner` đều resolve thành SCA address. Circle verify contract signature vì submitted request được đánh dấu `contractSigner: true`. Historical operation có thể còn hiện legacy engine label, nhưng không thể làm withdrawal mới tạo hoặc dùng EOA delegate.

Trước burn, Payna check current fee, confirmed source capacity, SCA identity và destination execution prerequisite. Browser không thể supply wallet address của user khác hoặc chọn execution engine. Wallet provisioning endpoint yêu cầu authenticated session và idempotently trả existing SCA nếu đã tạo.

Gas là chain-specific execution prerequisite, không thuộc Gateway USDC balance. Payna hỏi RPC lấy current estimate thay vì hard-code gas price vào receipt. Nếu Circle Gas Station policy chấp nhận SCA Manual-mint transaction, user có thể có zero native balance. Nếu sponsorship không khả dụng, response nêu SCA, chain và native-gas need mà không gợi ý thêm USDC sẽ giải quyết.

## Durable state transition

Operation được persist trước first submit. UUID và fingerprint bind authenticated user, amount, recipient SCA, domain và mint path. Dùng lại UUID với data giống nhau trả known state; đổi payload trả conflict. Cách này ngăn double withdrawal khi browser lặp request sau timeout.

State điển hình gồm created, source submitted, pending mint, success, failed before submit và reconciliation required. Failure trước khi Circle nhận source spend có thể review an toàn. Failure sau khi có transfer ID là ambiguous và phải reconcile. UI không biến trường hợp sau thành generic retry button.

Signature, attestation và recovery data không bao giờ được lưu trong user-readable history column. Khi cần continuation, value này nằm trong server-only RLS-protected table có expiry và atomic claim. Public receipt chỉ có transfer ID, transaction hash, actual fee khi available, amount, chain và settlement state.

## Retry safety

Khi Circle đã trả transfer ID hoặc on-chain hash, không lặp withdrawal mù. Giữ identifier và reconcile current state. Signature, attestation và recovery material chỉ nằm trong server-only storage, không được history API trả về.

Nếu source spend accepted nhưng mint chưa hoàn tất, continuation chỉ được gọi existing destination mint. Nó không được sign Burn Intent mới. Hai tab không thể claim cùng continuation vì server atomically đánh dấu recovery record trước khi gọi Circle Kit.

Nếu Circle trả destination transaction hash rồi database update fail, Payna giữ recovery claim bị khóa và đánh dấu operation `reconciliation_required`. Operator có thể verify hash và sửa history, nhưng user không thể mint lại. Behavior bảo thủ này coi returned destination hash là bằng chứng state có thể đã đổi.

## Ví dụ hoàn chỉnh

Giả sử Base hiện 12.000000 confirmed Gateway USDC, 2 pending và không có transfer in motion khác. User preview `/withdraw 10 from base`. Circle estimate bounded fee nên Payna verify confirmed 12 cover cả 10 cùng fee đó. Pending 2 hiện để tham khảo nhưng bị loại khỏi calculation.

User confirm trong preview lease. Payna tạo durable operation, resolve Base SCA từ session, refresh quote và yêu cầu SCA đó ký ERC-1271 Burn Intent. Circle trả một transfer ID. Payna sau đó submit same-domain mint qua SCA, được Gas Station sponsor khi eligible, rồi record destination hash cùng settled fee.

Nếu network response biến mất sau khi Circle trả transfer ID, user không tạo withdrawal khác. Activity dùng ID đó để xác định mint pending, success hoặc cần controlled continuation. Request thứ hai với cùng UUID trả existing operation; amount mới dưới cùng UUID trả `GATEWAY_OPERATION_ID_CONFLICT`.

## Common failure

- **Thiếu confirmed balance:** chờ pending deposit hoặc giảm amount.
- **Thiếu native gas:** fund named SCA trên selected chain khi sponsorship không khả dụng.
- **Lỗi mơ hồ sau submit:** reconcile transfer ID hiện có; không tạo burn khác.
- **Quote hết hạn:** lấy estimate mới và confirm fingerprint mới.
- **Quote legacy:** đóng preview cũ rồi estimate lại qua Circle Kit.
- **Cảnh báo persist receipt:** inspect destination hash; không retry mint.
