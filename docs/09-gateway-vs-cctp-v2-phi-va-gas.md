# Gateway Và CCTP V2: Phí, Gas Và Vai Trò Của Ví

Tài liệu này giải thích tiền nằm ở đâu, phí bị trừ ở đâu và ví nào cần native
token trong các luồng Circle Gateway và CCTP V2.

> CCTP V2 `/bridge` là hướng phát triển tiếp theo. Ra hiện tại đang chạy
> Circle Gateway. Gateway cross-chain transfer mặc định dùng Forwarding Service
> để Circle/relayer mint hộ ở destination. Manual mint gas vẫn là option kỹ
> thuật để debug hoặc tiết kiệm forwarding fee.

## 1. Bốn Thành Phần Cần Phân Biệt

| Thành phần | Vai trò | Có giữ Gateway balance? | Khi nào cần native gas? |
| --- | --- | --- | --- |
| Circle SCA wallet | Ví chính do Circle tạo cho user | Có, với tư cách depositor | Deposit, authorize signer và mint về chính SCA |
| Gateway balance | USDC đã deposit vào Gateway theo depositor và source domain | Đây là số dư, không phải một ví riêng | Không tự trả gas |
| Gateway signer | Một EOA multichain do Circle tạo để ký burn intent và có thể submit mint | Không | Khi signer submit mint ở destination |
| MetaMask | Ví external do user kiểm soát | Không liên quan Gateway balance | Approve, burn và mint trong CCTP V2 trực tiếp |

Gateway signer không sở hữu Gateway balance. Gateway balance thuộc depositor,
thường là địa chỉ Circle SCA. Trong Ra hiện tại, Gateway signer được lưu là
một ví EOA `MULTICHAIN`: cùng một địa chỉ `0x...` dùng được trên Arc Testnet,
Base Sepolia và Avalanche Fuji. Tuy cùng địa chỉ, native token balance vẫn tách
theo network. Ví dụ `0xSIGNER...2222` có thể có `0 ETH` trên Base nhưng có
`0.05 USDC` native trên Arc. Việc ký burn intent là ký message offchain nên
không tốn gas. Chỉ transaction onchain như deposit, authorize hoặc mint mới tốn
native token.

## 2. Gateway Transfer Manual Mint Gas

Ví dụ:

```text
/transfer 100 from base to arc
```

Luồng thực thi:

```text
Circle SCA trên Base
  -> deposit USDC vào Gateway nếu balance thiếu
Gateway balance của SCA trên Base
  -> Gateway signer ký burn intent
Circle Gateway
  -> trả attestation
Minter wallet submit transaction trên Arc
  -> recipient nhận 100 USDC trên Arc
```

### Phí bị trừ ở đâu?

Gateway cross-chain transfer hiện có hai khoản phí được trừ bằng USDC từ
Gateway balance ở source:

1. Gas fee cho burn intent trên source chain. Ví dụ bảng phí Circle công bố cho
   Base là `0.01 USDC`.
2. Cross-chain transfer fee bằng `0.005%` số tiền transfer.

Ví dụ chuyển `100 USDC` từ Base sang Arc:

```text
Amount đến recipient:                100.000 USDC
Base burn gas fee minh họa:            0.010 USDC
Cross-chain fee: 100 x 0.005% =         0.005 USDC
Gateway balance nguồn cần tối thiểu:  100.015 USDC
```

Con số trên chỉ dùng để minh họa công thức. Ra phải lấy fee estimate ngay
trước khi confirm vì phí có thể thay đổi. `maxFee` trong burn intent chỉ là mức
phí tối đa user chấp nhận, không phải phí thực tế chắc chắn bị thu.

### Native gas bị trừ ở ví nào?

Khi chọn manual mint gas, native gas được trả riêng:

- Nếu Gateway balance Base đã đủ và signer đã authorized, signer chỉ ký
  offchain ở source nên không mất ETH trên Base.
- Nếu cần auto-deposit, Circle SCA trên Base cần ETH để approve/deposit.
- Nếu cần authorize signer, Circle SCA trên Base cần ETH để gửi transaction
  delegate.
- Transaction mint cần native gas ở destination chain.

Minter wallet ở destination được chọn theo recipient:

| Tình huống | Ví submit mint | Ví cần native gas |
| --- | --- | --- |
| Chuyển về Circle SCA của chính user | Circle SCA trên destination | Circle SCA trên destination |
| `/pay` hoặc transfer cho ví Vũ | Gateway signer trên destination | Gateway signer trên destination |

Ví dụ địa chỉ cụ thể:

```text
Circle SCA của tôi:        0xSCA...1111
Gateway signer multichain: 0xSIGNER...2222
Ví Vũ trên Arc:            0xVU...4444
```

Trường hợp `0xSCA...1111` chuyển `100 USDC` từ Base sang Arc cho chính mình:

```text
Source funds:
  Gateway balance của 0xSCA...1111 trên Base bị trừ 100 USDC + Gateway fee.

Source native gas:
  0xSCA...1111 cần ETH trên Base nếu phải auto-deposit hoặc authorize signer.
  0xSIGNER...2222 chỉ ký burn intent, không cần ETH trên Base để ký.

Destination native gas:
  0xSCA...1111 cần native USDC trên Arc để submit mint về chính SCA.
```

Trường hợp `/pay 100 USDC to Vũ from base to arc`:

```text
Source funds:
  Gateway balance của 0xSCA...1111 trên Base bị trừ 100 USDC + Gateway fee.

Source native gas:
  0xSCA...1111 cần ETH trên Base nếu phải auto-deposit hoặc authorize signer.
  0xSIGNER...2222 chỉ ký burn intent, không cần ETH trên Base để ký.

Destination native gas:
  0xSIGNER...2222 cần native USDC trên Arc để submit mint.
  0xVU...4444 không cần native USDC để nhận tiền.
```

Nếu destination là Avalanche Fuji thay vì Arc, ví submit mint cần `AVAX` trên
Avalanche Fuji. Nếu destination là Base Sepolia, ví submit mint cần `ETH` trên
Base Sepolia.

Arc dùng USDC làm native token. Vì vậy signer hoặc SCA thực hiện mint trên Arc
phải có sẵn một lượng USDC native để bootstrap transaction mint. Nạp native gas
vào ví recipient không giải quyết lỗi nếu minter thực tế là Gateway signer.
Cùng một địa chỉ signer có thể cần native token ở destination network cụ thể:
nạp `ETH` vào `0xSIGNER...2222` trên Base không giúp mint trên Arc; muốn mint
trên Arc thì phải nạp native `USDC` vào `0xSIGNER...2222` trên Arc.

## 3. Gateway Với Forwarding Service Mặc Định

Circle Gateway Forwarding Service submit mint ở destination thay cho ví của
Ra. Đây là mặc định cho Gateway cross-chain transfer/pay trong Ra. User
trả các chi phí bằng USDC tại source và không cần giữ native token ở
destination.

Theo ví dụ chính thức của Circle cho transfer `1,000 USDC` từ Base:

```text
Base burn gas fee:                     0.01 USDC
Forwarding fee:                        0.21 USDC
Cross-chain fee: 1,000 x 0.005% =      0.05 USDC
Minimum maxFee:                        0.27 USDC
```

Khi dùng Forwarding Service:

- Gateway balance nguồn cần ít nhất `1,000.27 USDC`.
- Circle/relayer trả native gas để mint ở destination.
- Gateway signer của Ra không cần giữ native gas ở destination.
- Phần gas destination đã được quy đổi thành forwarding fee bằng USDC.

Trong mode này, lỗi thiếu native gas của Gateway signer/SCA ở destination không
còn chặn bước mint. Source chain vẫn có thể cần native gas nếu Ra phải
auto-deposit hoặc authorize signer trước khi burn.

## 4. CCTP V2 Trực Tiếp Bằng MetaMask

CCTP V2 không sử dụng Gateway balance và không sử dụng Gateway signer. USDC
được burn trực tiếp từ MetaMask ở source rồi mint native USDC ở destination.

```text
MetaMask source
  -> approve USDC
  -> depositForBurn
Circle Iris
  -> attestation
MetaMask destination
  -> receiveMessage và mint USDC
```

### Fast Transfer

CCTP V2 Fast Transfer thu protocol fee từ số USDC bị burn. Mức phí phụ thuộc
source chain và phải được query từ Circle.

Ví dụ minh họa `1,000 USDC` từ Base sang Arc với mức `1.3 bps`:

```text
CCTP Fast fee: 1,000 x 0.013% =       0.13 USDC
USDC được mint dự kiến:              999.87 USDC
```

Ngoài protocol fee:

- MetaMask cần ETH trên Base cho transaction approve nếu allowance chưa đủ.
- MetaMask cần ETH trên Base cho transaction burn.
- Ví submit mint cần native USDC trên Arc cho transaction mint.

Không có liquidity pool, wrapped token hoặc swap slippage. Chênh lệch USDC là
protocol fee, không phải giá swap.

### Standard Transfer

CCTP V2 Standard Transfer hiện có protocol fee `0 USDC`, nhưng phải đợi source
chain đạt finality lâu hơn. Native gas vẫn phát sinh:

- Source gas cho approve và burn.
- Destination gas cho mint.

Vì vậy "Standard miễn phí" chỉ có nghĩa là không có CCTP protocol fee, không có
nghĩa là toàn bộ transaction miễn gas.

### CCTP V2 Với Forwarding Service

Nếu bật CCTP Forwarding Service:

- MetaMask vẫn cần native gas ở source để approve và burn.
- Circle/relayer submit mint ở destination.
- User không cần native token ở destination.
- Fast fee nếu có và forwarding fee được trừ bằng USDC tại source.
- Service fee hiện được Circle công bố là `0.20 USDC` cho destination không phải
  Ethereum, cộng phần forwarding gas được quote động.

## 5. Bảng So Sánh

| Luồng | Nguồn tiền | Phí USDC | Ai trả source gas? | Ai trả destination gas? |
| --- | --- | --- | --- | --- |
| Gateway manual | Gateway balance của SCA | Burn gas fee + `0.005%` cross-chain fee | SCA nếu cần deposit/authorize | SCA hoặc Gateway signer |
| Gateway auto forwarding | Gateway balance của SCA | Gateway fee + forwarding fee | SCA nếu cần deposit/authorize | Circle/relayer |
| CCTP V2 trực tiếp | USDC trong MetaMask | Fast fee; Standard protocol fee bằng `0` | MetaMask | MetaMask hoặc ví submit mint |
| CCTP V2 + Forwarding | USDC trong MetaMask | Fast fee + forwarding fee | MetaMask | Circle/relayer |

## 6. Quy Tắc Hiển Thị Trong Ra

Preview trước khi confirm phải hiển thị:

```text
Rail
Source of funds
Amount recipient nhận
Estimated USDC fee
Source native gas payer
Destination native gas payer
Địa chỉ ví đang thiếu gas
```

Không hiển thị chung chung "recipient thiếu gas". Backend phải trả đúng
`walletRole`:

- `sca`: nạp native token vào Circle SCA trên chain được báo.
- `gateway_signer`: nạp native token vào Gateway signer trên destination.
- `metamask`: user đổi network và chuẩn bị native token trong MetaMask.

Mọi con số phí trong UI phải lấy từ Gateway fee estimate hoặc
`BridgeKit.estimate()` ngay trước khi user confirm. Không hardcode bảng phí vào
logic giao dịch.

Ra mặc định dùng Auto forwarding cho `/transfer` và `/pay`. Nếu user muốn
giữ luồng manual để tiết kiệm forwarding fee, thêm `manual`, `manual gas` hoặc
`no forwarding` vào command:

```text
/transfer 100 from base to arc manual
/pay 25 to Vũ on arc from base no forwarding
```

## Nguồn Circle

- [Circle Gateway Fees](https://developers.circle.com/gateway/references/fees)
- [Gateway Technical Guide](https://developers.circle.com/gateway/references/technical-guide)
- [Gateway Forwarding Service](https://developers.circle.com/gateway/references/forwarding-service)
- [Circle CCTP](https://developers.circle.com/cctp)
- [CCTP Fees](https://developers.circle.com/cctp/concepts/fees)
- [CCTP Forwarding Service](https://developers.circle.com/cctp/concepts/forwarding-service)
- [Bridge Kit Estimate Costs](https://developers.circle.com/bridge-kit/tutorials/estimate-costs)
