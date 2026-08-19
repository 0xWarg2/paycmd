# PayCMD growth and revenue roadmap

Ngày lập: 2026-08-13  
Base branch: `dev` tại `84dc37b`  
Mục tiêu: biến PayCMD/Payna từ một demo chat-first stablecoin thành sản phẩm có telemetry đáng tin, vòng lặp tăng trưởng, nguồn thu minh bạch và lộ trình production rõ ràng.

## 1. Kết luận audit

PayCMD đã có nhiều primitive quan trọng nhưng landing page chưa phản ánh đúng độ sâu sản phẩm:

- Pay, transfer, request payment và payroll theo contact group.
- Circle Gateway unified balance, Circle SCA, CCTP v2 bridge và swap trên Arc Testnet.
- Preview lease, explicit confirmation, allocation guard, fee ceiling, idempotency và receipt proof.
- AskPayna research có nguồn Circle/Arc/Web, quota và tách biệt khỏi mode thực thi giao dịch.
- Supabase Auth/Postgres, RLS, notifications, transaction history và public docs song ngữ.

Các khoảng trống chính:

- Chưa có product analytics/public telemetry nên không đo activation, retention, volume hay doanh thu.
- Landing page chỉ liệt kê capability, chưa đưa ra bằng chứng sử dụng thực tế.
- Chưa có merchant checkout, payment link public, escrow lifecycle hoặc recurring subscription production-ready.
- Swap chưa dùng Arc App Kit custom fee; bridge chưa dùng Bridge Kit custom fee policy.
- Chưa có treasury workspace, approval policy, multi-currency ledger, reconciliation và accounting export.
- Agent chưa có scoped session, spending policy, revocation, audit log hoặc onchain identity/reputation.
- DeFi surface chưa có risk disclosure, protocol allowlist, simulation, position health và jurisdiction gate.

## 2. Nguyên tắc sản phẩm

1. Không hiển thị số giả hoặc mượn volume hệ sinh thái để nhận là volume của PayCMD.
2. Mọi số public phải có định nghĩa, nguồn dữ liệu, network và `as of` timestamp.
3. Mọi fee phải xuất hiện trong quote trước khi ký; không thu phí ẩn.
4. Testnet capability không được quảng cáo như production/mainnet.
5. AI đề xuất nhưng policy engine quyết định; giao dịch rủi ro cao cần explicit approval.
6. Mỗi money movement cần idempotency, receipt, reconciliation và recovery path.
7. DeFi/perps/prediction markets chỉ mở sau legal, compliance và risk review.

## 3. Phase và branch

| Phase | Branch | Outcome | Circle/Arc primitive | Revenue hypothesis |
|---|---|---|---|---|
| 0 | `codex/phase-0-growth-telemetry` | Public metrics, funnel analytics, truthful social proof | Existing Gateway/CCTP/Wallet data | Đo conversion trước khi tối ưu; pricing CTA |
| 1 | `codex/phase-1-money-movement` | Gasless P2P, payroll, checkout, remittance, payment links | Gateway, CCTP v2, Wallets, Arc payments/eCommerce | Checkout fee, bridge fee, payroll SaaS |
| 2 | `codex/phase-2-treasury-fx` | Multi-currency accounts, stablecoin FX, approval workflow | Arc App Kit Swap, Gateway, EURC/USDC | FX spread/custom fee, treasury subscription |
| 3 | `codex/phase-3-wallet-infrastructure` | Modular wallets, AA, multichain dashboard | Circle Modular Wallets, ERC-4337, Paymaster | Wallet/API/enterprise plan |
| 4 | `codex/phase-4-agentic-finance` | Agent wallet policies, escrow, subscriptions, jobs | Dev-controlled Wallets, SCP, ERC-8004/8183 | Escrow fee, agent execution plan, x402 |
| 5 | `codex/phase-5-defi-trading` | DEX/yield/lending first; gated perps/prediction | Arc Swap/App Kit + allowlisted protocols | Swap fee, yield management fee, Pro plan |

Các branch được tạo độc lập từ cùng commit `dev` để review/merge riêng. Khi một phase cần schema/API của phase trước, rebase hoặc merge phase trước vào branch đó trước khi tiếp tục; không copy-paste implementation.

## 4. Phase 0 — Growth telemetry and proof

### Scope

- Public aggregate RPC không lộ PII.
- Homepage hiển thị registered users, verified money movements, USDC moved và AskPayna answers.
- Gắn nhãn `testnet`, timestamp, định nghĩa metric và fallback khi telemetry chưa deploy.
- Event taxonomy cho `landing_view`, `launch_clicked`, `wallet_created`, `first_fund`, `preview_created`, `payment_completed`, `research_completed`, `checkout_completed`.
- Internal funnel dashboard ở phase kế tiếp; Phase 0 chỉ tạo data contract và social proof read surface.

### North-star và guardrails

- North-star: weekly transacting users.
- Activation: user hoàn tất wallet + fund + giao dịch đầu tiên trong 24 giờ.
- Revenue: net platform fees, không tính protocol/network fees.
- Guardrails: failed transfer rate, time-to-finality P95, support incidents, refunded/duplicate operations.

### Exit criteria

- Metrics có test cho normalize/format và không tự biến lỗi thành zero.
- Aggregate SQL chỉ trả số, network và timestamp; không trả address/user id.
- Homepage hoạt động khi Supabase chưa cấu hình.
- Unit test, lint và build pass.

## 5. Phase 1 — Payments and money movement

### Features

- Gasless P2P bằng smart account/paymaster khi chain và wallet model hỗ trợ; luôn quote sponsorship state.
- Batch payroll có CSV import, validation, approval summary, partial-failure recovery và downloadable reconciliation.
- Merchant checkout/payment links: amount, currency, expiry, memo/order id, webhook, receipt page, refunds.
- Escrow MVP chỉ cho deterministic milestones; AI validation là recommendation, không phải unilateral release authority.
- Cross-border remittance: source/destination currency quote, CCTP/Gateway routing, recipient confirmation, compliance hooks.
- CCTP Bridge Kit custom fee policy: fee thêm trên transfer amount; theo Circle MCP, 90% custom fee tới PayCMD recipient và 10% tới Circle.

### Exit criteria

- Quote bind với recipient, route, amount, platform fee, protocol fee, expiry và idempotency key.
- Checkout webhook được ký, replay-protected và có retry queue.
- Refund/failed mint/reconciliation được test.
- Mainnet bị feature-flag cho đến khi compliance và operations sign-off.

## 6. Phase 2 — Treasury and FX

### Features

- Organization/workspace, role và approval threshold.
- Account buckets theo purpose; virtual ledger tách khỏi raw wallet balance.
- USDC/EURC quote, slippage, expiry và execution receipt.
- Treasury policies: target allocation, rebalance proposal, scheduled payroll/vendor payout.
- CSV/API export và monthly statement.
- Arc App Kit custom swap fee; Arc giữ 10% custom fee và PayCMD nhận 90%, cộng provider fee 2 bps theo Arc docs hiện tại.

### Exit criteria

- Double-entry ledger/reconciliation bất biến.
- Không dùng floating point cho money.
- Approval race, stale quote và concurrent rebalance có test.
- Fee revenue được ghi riêng khỏi user principal.

## 7. Phase 3 — Wallets and infrastructure

### Features

- User-controlled wallet cho consumer custody; developer-controlled wallet chỉ dùng cho automation/custodial flows có consent.
- Modular wallet/passkey, recovery, session key và subscription module.
- ERC-4337 bundler/paymaster abstraction và sponsored gas budgets.
- Multichain treasury dashboard, chain health, spendable vs pending vs reserved balance.
- API keys, webhook signing, rate limits và sandbox tenant cho merchants.

### Compatibility constraints

- Circle Gateway Unified Balance dùng Circle Wallet SCA ký trực tiếp qua ERC-1271; không thêm delegate EOA hay signer dự phòng.
- Circle MCP ghi nhận Bridge Kit chưa hỗ trợ trực tiếp Circle Wallets; không thiết kế một adapter giả định hoạt động.
- Arc transaction memo không nhận smart-contract wallet làm direct caller; metadata cần lưu application-layer hoặc EOA-signed path.

## 8. Phase 4 — Agentic finance

### Features

- Agent identity ERC-8004, metadata, reputation và validator separation.
- Spending policy: token/recipient allowlist, per-tx/day limit, expiry, revocation và emergency stop.
- ERC-8183 job lifecycle: create, quote/budget, fund escrow, submit deliverable, evaluate, settle/refund.
- AI-assisted escrow validation phải trả evidence + confidence; human/multisig quyết định trên ngưỡng rủi ro.
- Autonomous subscription/x402 nanopayment với merchant cap và audit trail.

### Exit criteria

- Agent không được giữ unrestricted production key.
- Mọi action có policy decision, trace id, signer identity và receipt.
- Prompt injection không thể mở rộng quyền hoặc thay recipient.
- Kill switch và revoke có integration test.

## 9. Phase 5 — DeFi and trading

### Thứ tự rollout

1. DEX swap với allowlisted token/pool, simulation và slippage guard.
2. Yield vault read-only discovery, sau đó opt-in deposit/withdraw.
3. Lending/borrowing với health factor và liquidation warning.
4. Perps và prediction markets chỉ sau legal/jurisdiction review, suitability gate và risk engine.

### Exit criteria

- Price impact, protocol fee, PayCMD fee, gas và minimum received hiển thị trước ký.
- Protocol/token allowlist có version và emergency disable.
- Không quảng cáo APY như lợi nhuận đảm bảo.
- Positions có cost basis, unrealized PnL, health và exit path.

## 10. Circle/Arc evidence used

- Circle Gateway: unified USDC balance, multi-source spend và chain abstraction.
- Circle CCTP v2: trust-minimized burn/mint; Bridge Kit estimate/bridge/retry và custom fee policy.
- Circle Wallets: user-controlled cho user custody; developer-controlled cho automation/treasury.
- Circle Modular Wallets: passkeys, recovery, multisig/subscription-style modules.
- Circle SCP: contract deploy/query/event monitoring.
- Arc `/build/payments`, `/build/ecommerce`, `/build/stablecoin-fx`, `/build/agentic-economy`.
- Arc `/app-kit/unified-balance`, `/app-kit/tutorials/swap/collect-swap-fee`, `/app-kit/concepts/swap-fees`.
- Arc `/arc/tools/account-abstraction`, ERC-8004 và ERC-8183 tutorials.

## 11. Definition of done cho mọi phase

- Threat model và data classification cập nhật.
- Migration reversible bằng forward fix; không chỉnh migration đã deploy.
- API auth/RLS/idempotency/replay protection được review.
- Unit/integration/E2E cho happy path và failure recovery.
- Bilingual copy, responsive layout, keyboard/screen-reader states.
- Public claims đối chiếu với telemetry và network thật.
- Fee/pricing, ToS, privacy và compliance sign-off trước mainnet.
