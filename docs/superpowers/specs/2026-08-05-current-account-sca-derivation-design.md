# Current Account SCA Derivation Design

## Objective

Derive the existing Circle developer-controlled SCA for the current Payna test account onto four additional EVM testnets so the same SCA address can execute Gateway deposit operations there:

- `ARB-SEPOLIA`
- `OP-SEPOLIA`
- `MATIC-AMOY`
- `UNI-SEPOLIA`

This is a one-time account backfill. It does not change signup behavior for other users.

## Current problem

Payna's public Gateway configuration contains these four chains, and its balance reader can see USDC held at the unified EVM address. The current account's Circle SCA was originally created only on Arc Testnet, Base Sepolia, and Avalanche Fuji. Circle therefore cannot resolve that SCA as a transaction source on the four new chains, and contract execution fails before an on-chain transaction is submitted.

Code configuration is only application metadata. Circle Wallet derivation is a separate Circle-side operation that materializes the same wallet index and address on a target blockchain and returns a chain-specific wallet record.

## Selected approach

Use Circle's idempotent `deriveWallet` operation with the existing SCA wallet ID as the source. Do not call `createWallets`, because a fresh creation can select another address index and would not control the USDC already held by the current SCA address.

The operation will be exposed as a narrow administrative script rather than hidden inside the deposit route. The script requires an explicit target user identifier and uses the fixed allowlist above. It supports a read-only preview and a separate explicit apply mode.

## Data flow

1. Resolve exactly one `type = sca` record for the explicit Payna user.
2. Fetch that wallet from Circle and require:
   - account type `SCA`;
   - custody type `DEVELOPER`;
   - a valid EVM address;
   - a wallet set matching the Payna database record.
3. List Circle wallets in that wallet set and find existing SCA records with the same address.
4. Build a plan for the four fixed target blockchains:
   - `existing` when a matching SCA is already derived;
   - `missing` when derivation is required;
   - fail when the same target chain exists with conflicting address or account type.
5. In preview mode, print only chain/status/address-match information and perform no writes.
6. In apply mode, call `deriveWallet` only for missing targets, one chain at a time.
7. After every derivation, require the returned wallet to have the expected blockchain, SCA account type, wallet set, and the exact same address.
8. Re-list the wallet set and require all four target chains to be present with the expected identity.

## Gateway behavior after derivation

Derivation does not authorize Gateway and does not move funds. A later user-confirmed deposit remains responsible for:

1. checking the selected chain and amount;
2. adding the Gateway EOA delegate if it is not already authorized;
3. approving the Gateway Wallet to spend the selected USDC amount;
4. calling `GatewayWallet.deposit`;
5. waiting for Gateway finality/indexing.

The existing deposit implementation supplies `walletAddress + blockchain` to Circle. Once the SCA has been derived, Circle can resolve that target wallet and execute the contract calls.

## Safety and failure handling

- The script never accepts arbitrary blockchains; only the four reviewed testnets are allowed.
- Preview is the default. Apply requires an explicit flag.
- The script never calls delegate, approve, deposit, transfer, or withdrawal operations.
- Existing target wallets are skipped, making retries idempotent.
- Address, account type, wallet set, and blockchain mismatches stop the run.
- A failure on one target stops further derivations and reports which earlier targets succeeded. Derivation is additive and does not require rollback.
- Logs must not expose Circle credentials, entity secrets, Supabase keys, or full internal identifiers.

## Testing

Unit tests will cover plan construction and result validation:

- all four targets missing;
- some or all targets already derived;
- conflicting target address;
- wrong account type;
- wrong wallet set;
- wrong returned blockchain;
- apply calls only missing targets and stops on failure;
- preview performs no derivation.

Verification of the real account will run in two phases:

1. preview and inspect the four-chain plan;
2. apply, then re-list Circle wallets and confirm all four SCA records match the original address.

No test deposit is included in this operation. The user can confirm a separate small deposit afterward.

## Non-goals

- Automatically deriving wallets for all existing or future Payna users.
- Depositing the displayed 80 USDC from the four new chains.
- Automatically approving tokens or adding Gateway delegates.
- Changing Gateway allocation, BurnIntentSet, or forwarding behavior.
- Supporting Circle Wallet SDK-incompatible Gateway chains.
