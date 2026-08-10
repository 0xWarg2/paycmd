# Gateway SCA-only: phạm vi ảnh hưởng và test plan

## Runtime sau migration

- `sourceDepositor` và `sourceSigner` luôn là cùng một địa chỉ Circle SCA.
- BurnIntent dùng chữ ký ERC-1271 và mọi payload gửi Gateway đều có `contractSigner: true`.
- Deposit chỉ approve/deposit bằng SCA; không gọi `addDelegate`.
- Withdraw, scoped transfer và manual mint đều do SCA ký/gọi contract.
- Manual mint tới ví ngoài không đổi recipient: SCA trả gas và gọi `gatewayMint`, USDC vẫn được mint tới địa chỉ ngoài.
- Các API tạo/đọc/delegate Gateway EOA trả `410 Gone`; backend không còn tạo, đọc hay fallback sang `gateway_signer`.
- Delegate cũ có thể vẫn tồn tại on-chain, nhưng runtime Payna không đọc hoặc dùng nó. Việc revoke là một migration bảo mật riêng.

## Unified multi-source

BurnIntent được nhóm theo `sourceDomain`. Mỗi nhóm source chain được SCA ký riêng để ERC-1271 kiểm tra đúng state/chain context. Sau khi tất cả chữ ký tạo thành công, Payna gửi toàn bộ signed payload trong **một** `POST /v1/transfer`.

Ví dụ Base + Arc + Avalanche:

```text
Base BurnIntent      -> SCA signature Base   ┐
Arc BurnIntent       -> SCA signature Arc    ├─ one Gateway transfer request
Avalanche BurnIntent -> SCA signature Avax   ┘
```

Không có request burn riêng theo từng chain. Nếu một chữ ký lỗi trước submit, không payload nào được gửi. Nếu Gateway đã trả `transferId`, retry phải tiếp tục tuân theo duplicate-transfer guard hiện có.

## Thêm chain mới

Không còn bước tạo EOA/delegate cho từng user hoặc bổ sung một danh sách EOA hard-code Arc/Base/Avax. Wallet onboarding lấy các blockchain SCA từ `CIRCLE_CHAIN_NAMES`, được sinh từ `GATEWAY_CHAIN_CONFIGS`.

Tuy nhiên thêm chain **không hoàn toàn tự động**. Vẫn cần một cấu hình toàn cục gồm:

1. Gateway domain và USDC contract.
2. Viem chain/RPC.
3. Circle `Blockchain` enum cho SCA wallet operations.
4. Kiểm thử deposit, ERC-1271 signing, forwarding và manual mint trên chain đó.

Chain có Gateway domain nhưng chưa có `circleBlockchain` vẫn hiển thị balance, nhưng bị loại khỏi nguồn spend SCA để fail closed.

## Test cases bị ảnh hưởng

| Case | Kỳ vọng |
|---|---|
| Tạo user/wallet mới | Chỉ tạo `accountType: SCA`; không có row `gateway_signer` |
| Deposit trên mỗi chain SCA-supported | Approve + deposit bằng SCA; không `addDelegate` |
| Scoped same-chain/cross-chain | `sourceSigner = sourceDepositor = SCA`, `contractSigner: true` |
| Unified Base + Arc + Avax | Ba nhóm ký theo domain; một POST Gateway; một `transferId` |
| Hai intent cùng source domain | Một chữ ký BurnIntentSet cho domain đó |
| Một source không được Circle Wallet SDK hỗ trợ | Source bị exclude trước ký; không submit partial burn |
| Một chữ ký source thất bại | Không gọi `/v1/transfer`; funds không di chuyển |
| Gateway trả lỗi cho request multi-source | Không fallback EOA; trả lỗi SCA/Gateway |
| Auto forwarding | SCA ký burn; Circle Forwarder hoàn tất mint; xác minh destination tx |
| Manual mint về chính SCA | SCA có gas destination và gọi `gatewayMint` |
| Manual mint tới ví ngoài | SCA có gas destination; token mint tới recipient ngoài |
| Withdraw | SCA ký BurnIntent và SCA gọi mint cùng chain |
| User cũ còn delegate EOA | Transfer vẫn chỉ dùng SCA; không query `gateway_signer` |
| API EOA/delegate cũ | Trả `410 Gone`, không tạo wallet hoặc transaction |
| Retry sau quote thay đổi | Guard trả 409 trước submit; không partial burn |
| Retry sau đã có `transferId` | Không auto retry/fallback để tránh double send |

## Soak test trước production

Chạy ít nhất scoped, unified 2-source/3-source, forwarding, manual external recipient và withdraw trên từng chain có `circleBlockchain`. Đối chiếu Gateway response, on-chain ERC-1271 result, fee thực tế, transaction history và RA receipt. Public Circle docs có thể chậm hơn package implementation, nên production enable cần bằng chứng testnet cho từng chain.
