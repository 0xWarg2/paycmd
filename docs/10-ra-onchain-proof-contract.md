# Ra Onchain Proof Contract

## Mục Tiêu

Ra dùng Circle Gateway/CCTP để chuyển USDC thật. Các giao dịch burn/mint đã có onchain transaction của Circle trên source chain và destination chain. Contract riêng của Ra không thay Circle và không giữ tiền.

Contract `RaReceiptRegistry` chỉ emit một event nhỏ trên Arc Testnet để tạo proof công khai rằng app Ra đã xử lý một action:

- `bridge`: bridge USDC từ MetaMask bằng CCTP V2.
- `transfer`: chuyển USDC qua Circle Gateway.
- `pay`: trả tiền cho contact hoặc địa chỉ ví.

Proof này giúp demo/verification thấy Ra có own contract và có onchain activity riêng, thay vì chỉ trỏ đến infrastructure contracts của Circle như USDC, TokenMessenger, MessageTransmitter hoặc Gateway.

## Luồng Dữ Liệu

1. User chạy lệnh trong app.
2. Ra gọi Circle rail để thực hiện tiền thật.
3. Circle tạo transaction onchain:
   - Source tx: thường là burn/deposit/delegation trên source chain, ví dụ Base Sepolia.
   - Mint tx: mint/receiveMessage trên destination chain, ví dụ Arc Testnet.
4. Ra backend ghi `transaction_history`.
5. Nếu `RA_RECEIPT_ENABLED=true`, backend dùng relayer wallet gọi `RaReceiptRegistry.recordReceipt(...)` trên Arc Testnet.
6. Contract emit `ReceiptRecorded`.
7. App lưu `proof_tx_hash` vào `transaction_history` và hiển thị link `Ra proof`.

## Vì Sao Deploy Trên Arc Testnet

Arc là chain chính trong demo Ra và native gas là USDC, nên proof event nằm cùng nơi với hướng sản phẩm. Một proof tx trên Arc Testnet có thể mở ở:

```text
https://testnet.arcscan.app/tx/<proof_tx_hash>
```

Không phải lúc nào app cũng gọi contract Ra. Chỉ các luồng đã nối proof mới gọi:

- MetaMask CCTP bridge record.
- Gateway transfer.
- Pay qua Gateway.

Các thao tác đọc balance, resolve contact, login, notification không cần ghi contract.

## Contract

File chính:

```text
contracts/RaReceiptRegistry.sol
```

Event:

```solidity
event ReceiptRecorded(
  bytes32 indexed commandId,
  uint8 indexed actionType,
  address indexed user,
  address recipient,
  uint256 amountAtomic,
  uint256 sourceChainId,
  uint256 destinationChainId,
  bytes32 sourceTxHash,
  bytes32 destinationTxHash,
  bytes32 metadataHash
);
```

Ý nghĩa field:

- `commandId`: hash định danh action trong app.
- `actionType`: `1=bridge`, `2=transfer`, `3=pay`.
- `user`: ví user/source wallet nếu có.
- `recipient`: ví nhận nếu có.
- `amountAtomic`: USDC amount với 6 decimals.
- `sourceChainId`: chain ID source.
- `destinationChainId`: chain ID destination.
- `sourceTxHash`: tx hash source nếu có.
- `destinationTxHash`: tx hash mint/destination nếu có.
- `metadataHash`: hash metadata offchain như contact label, transfer id, mode.

Contract không lưu state từng receipt để tiết kiệm gas; proof nằm trong event log.

## Env

```bash
RA_RECEIPT_ENABLED=true
RA_RECEIPT_REGISTRY_ADDRESS=0x...
RA_RECEIPT_RELAYER_PRIVATE_KEY=0x...
RA_RECEIPT_RECORDER_ADDRESS=0x...
ARC_TESTNET_RPC_KEY=...
NEXT_PUBLIC_ARC_TESTNET_RPC_KEY=...
```

`RA_RECEIPT_RELAYER_PRIVATE_KEY` là server secret, không đưa vào client. Relayer wallet cần có USDC trên Arc Testnet để trả gas.

## Build Và Test

```bash
npm run contract:compile
npm run contract:test
```

## Deploy Arc Testnet

1. Tạo hoặc chọn relayer EOA.
2. Fund relayer bằng Arc Testnet USDC gas.
3. Set env:

```bash
export RA_RECEIPT_RELAYER_PRIVATE_KEY=0x...
export RA_RECEIPT_RECORDER_ADDRESS=0x...
export ARC_TESTNET_RPC_KEY=...
```

4. Deploy:

```bash
npm run contract:deploy:arc
```

5. Copy address ra output vào:

```bash
RA_RECEIPT_REGISTRY_ADDRESS=0x...
RA_RECEIPT_ENABLED=true
```

6. Redeploy app.

## Database

Migration:

```text
supabase/migrations/20260617020000_add_ra_receipt_proof_columns.sql
```

Thêm các cột:

- `proof_chain`
- `proof_contract_address`
- `proof_tx_hash`
- `proof_status`
- `proof_error`

Nếu proof bị skip hoặc fail, giao dịch tiền thật vẫn không bị rollback. Đây là thiết kế chủ ý vì proof contract không phải rail thanh toán.
