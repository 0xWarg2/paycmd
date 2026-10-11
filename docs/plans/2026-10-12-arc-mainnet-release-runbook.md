# HeyPayna Arc wallet payment release

Implementation date: 2026-10-12 (Vietnam). Branch: `codex/arc-mainnet-microgrants`.

## Implemented scope

`/pay` is a dedicated MetaMask payment session. It reuses the existing `/pay` command parser with strict wallet-payment validation, explicit Arc mainnet/testnet selection, an immutable preview, signed ownership confirmation, and a separately signed ERC-20 transfer. The `/app` command center remains the Circle/Gateway testnet surface.

The wallet-payment registry lives alongside, rather than inside, `PayCmdChain` (the Gateway-supported testnet set). `arcMainnetChain` is defined in `web3-chains.ts`; `arcMainnetPublicClient` is independent of the testnet `arcPublicClient`. Do not set `ARC_NETWORK=mainnet`: that variable still selects the legacy testnet-only rail and deliberately fails closed for mainnet.

Mainnet payment facts, verified through official docs and read-only RPC calls:

| Field | Mainnet | Testnet |
| --- | --- | --- |
| Chain ID | 5042 | 5042002 |
| Public RPC | https://rpc.mainnet.arc.io | https://rpc.testnet.arc.io |
| Explorer | https://explorer.arc.io | https://explorer.testnet.arc.io |
| ERC-20 USDC | 0x3600000000000000000000000000000000000000 | Same documented system address, independently verified |
| Token decimals | 6 | 6 |
| Native gas decimals | 18 | 18 |

Sources: [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc), [contract addresses](https://docs.arc.io/arc/references/contract-addresses), [USDC event reference](https://docs.arc.io/arc/references/usdc-system-events), [gas reference](https://docs.arc.io/arc/references/gas-and-fees).

The gas reference includes testnet examples and parameters. Fees are estimated from the selected live RPC; the implementation does not copy its example native `parseUnits(...,6)` transfer or assume that testnet gas parameters apply to mainnet. USDC ERC-20 transfers have `value=0`, 6-decimal calldata, and 18-decimal gas accounting. Both views share one balance, so preflight reserves payment plus gas from that balance.

Receipt verification matches the transaction's chain ID, sender, token contract, calldata, hash and zero native value, then checks receipt status and the 6-decimal Transfer emitted by the ERC-20 contract. The separate 18-decimal system Transfer is not counted again. Ra receipt registry is optional in the existing /pay rail; the mainnet wallet rail verifies the actual transfer receipt without a registry deployment or relayer.

## Database and deployment

1. Apply `supabase/migrations/20261012000000_add_arc_wallet_payments.sql` to the intended Supabase project. It only creates the new wallet-payment table, indexes, RLS policy and aggregate function. Existing Gateway tables and metrics are untouched.
2. Confirm `SUPABASE_SERVICE_ROLE_KEY` is present on the server. Browsers receive only their own rows through SELECT-only RLS. API handlers alone mutate payment state after authenticating the user; the key stays server-side.
3. Keep `ARC_NETWORK=testnet` and existing testnet RPC variables. Set `ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io` (optional override; code has the official default).
4. Set `ARC_MAINNET_PAYMENTS_ENABLED=true` for the reviewed environment, then deploy. With the flag absent or false, the UI, preview endpoint and confirmation endpoint block new mainnet payments. Recording and reconciling already-authorized hashes remains available after disabling the flag.
5. Open `/pay`, sign in, connect MetaMask, select the intended network, and review the exact transfer before signing.

Mainnet history uses `arc_wallet_payments.network` and `chain_id`, with a separate API and explorer selected from the stored network. Existing public metrics continue to identify their activity as testnet. `get_arc_wallet_payment_metrics(p_network)` aggregates verified payments separately, excluding self-transfers. USDC moved is transfer volume, not revenue.

Every legacy financial API rejects mainnet context (header, request fields or query) before reaching a testnet rail. The legacy command parser also rejects explicit mainnet commands rather than accepting the `arc` prefix as Arc Testnet. The mainnet session renders no bridge, Gateway, swap, payroll or schedule controls; its links identify the Gateway testnet surface explicitly.

## Minimum real transaction

The user supplied one sender/recipient address: `0x83b22dcd84511C4bBb7abcd6b51056D8eA416877` and requested the minimum spend. Read-only mainnet preflight observed **0 USDC** in this wallet. It rejected the quote for insufficient funds; no transaction or wallet signature was executed.

Smallest positive ERC-20 amount: `0.000001 USDC` (one base unit). A self-transfer leaves the principal in the same wallet and spends gas. It demonstrates the payment pipeline, not payment to a customer or revenue. A distinct receiver is preferable for demonstrating receipt by another person but was not provided.

```text
/pay 0.000001 USDC to 0x83b22dcd84511C4bBb7abcd6b51056D8eA416877 on arc-mainnet
```

Fund the wallet with real USDC on Arc mainnet before obtaining a fresh quote. A faucet only provides testnet USDC. Funding from another Arc wallet avoids a bridge transaction; CCTP is also an official route, but requires independently verified mainnet source/destination contracts, balances and gas. See [Arc mainnet contracts](https://docs.arc.io/arc/references/contract-addresses). Do not use the application's testnet bridge to fund this wallet.

The exact gas budget remains unknown until the funded wallet can pass live preflight. Do not promise a fixed fee. The preview shows the cap derived from estimated gas plus 20% gas-limit headroom and RPC EIP-1559 fees. The user reviews the final fee and signs in MetaMask.

## Recovery and rollback

- Before broadcast, wallet rejection is recorded as rejected. A fresh preview is allowed.
- While confirming/signing/submitted, the UI locks the active operation. Database compare-and-set confirmation and an in-flight unique index also protect against duplicate requests/tabs.
- The ownership signature binds user, payment ID, network/chain, sender, receiver, amount, expiry and gas cap. It cannot confirm a different preview.
- The browser saves the returned hash synchronously before API calls, with a key scoped to user, network and payment. Reload resumes monitoring; it never prompts a new transfer automatically.
- If the wallet may have broadcast but returned no hash, the operation stays unresolved. Check MetaMask Activity/explorer and use hash recovery. The app does not assume a timeout means failure. A dropped/replaced transaction requires operator review; there is no automatic resend or automatic replacement/cancellation reconciliation in this release.
- RPC or persistence failures never mark a payment successful. Only a matching onchain receipt can settle it.
- Polling resumes while `/pay` is open (including after reload). There is no unattended background worker when all clients are closed.
- Emergency stop: set `ARC_MAINNET_PAYMENTS_ENABLED=false` and redeploy. Continue reconciling existing hashes. Then roll back to the previously verified Vercel deployment if needed. Retain the new ledger and receipt evidence. Website rollback does not reverse blockchain transfers.

## Remaining external gates

- Migration has not yet been applied: there is no available Supabase SQL/admin connector, DB connection credential or granted native browser control.
- Vercel CLI authentication is invalid; the connected Vercel MCP can inspect the existing project and is used for preview deployment instead.
- Funded-wallet quote, user wallet signature, actual mainnet receipt and video remain outstanding.
- Production enablement/promotion and grant submission follow actual transaction verification and user review.
- The repository is already public. A limited scan of 496 tracked files and all reachable Git text patches found no matches for the provider/private-key patterns used. This is not an exhaustive privacy review of arbitrary documents, binary files, or unreachable/deleted history. Unrelated untracked user documents and existing Gateway edits are preserved and excluded from the implementation commit.
