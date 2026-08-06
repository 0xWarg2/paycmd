---
slug: "commands/gateway"
title: "Circle Gateway commands"
description: "Reference for deposit, withdraw, transfer, gas, and gateway."
section: "commands"
order: 61
lastUpdated: "2026-08-05"
keywords: ["deposit", "withdraw", "transfer", "gas", "gateway"]
commands: ["deposit", "withdraw", "transfer", "gas", "gateway"]
tutorial: true
aiSummary:
  - "Gateway commands include /deposit, /withdraw, /transfer, /gas, and /gateway; transfer is scoped-first and can explicitly fall back to a unified BurnIntentSet."
---

## `/deposit`

- **Purpose:** Move USDC from your Circle SCA into the Gateway depositor balance on one source domain.
- **Syntax and variants:** `/deposit <amount> [USDC] from <source-chain>`; amount must be positive with up to six decimals.
- **Example:** `/deposit 50 from base`; natural language: “Deposit 50 Base USDC into Gateway.”
- **Prerequisites:** SCA, sufficient chain-scoped SCA USDC, native gas for delegate/approval/deposit calls, and supported Gateway/Wallet SDK chain.
- **Preview:** Check amount, token, source, SCA/depositor, rail, and gas. This preview does not claim funds are ready.
- **Confirmation boundary:** Payna confirmation authorizes Circle-wallet contract execution; MetaMask is not the signer. Delegate and approval can occur before the final deposit call.
- **Success and persisted data:** A confirmed hash is stored as `pending_gateway_finality`, with block data when available. It becomes `success` only after verified webhook or recovery sync evidence.
- **Named errors and fixes:** **“Insufficient USDC balance”**: `/fund` the SCA first. **“Insufficient gas or gas estimation failed”**: fund the named SCA's native gas. **`GATEWAY_FINALITY_PENDING`**: wait/sync the existing hash; never duplicate the deposit. See [deposit and finality](/docs/circle/gateway/deposit-and-finality).

## `/withdraw`

- **Purpose:** Burn ready Gateway USDC on a source domain and mint the same requested amount back to your SCA on that same domain.
- **Syntax and variants:** `/withdraw <amount> [USDC] from <source-chain>`.
- **Example:** `/withdraw 5 from base`; natural language: “Return 5 Base Gateway USDC to my SCA.”
- **Prerequisites:** SCA, authorized Gateway signer, ready source-scoped balance for amount plus quoted fee, and destination mint gas in the wallet Payna names.
- **Preview:** Review amount, source, same-domain SCA recipient, and withdraw rail. Current preview does not fetch the fee; execution quotes after confirmation and returns estimate/required balance.
- **Confirmation boundary:** Payna confirmation starts signer initialization if needed, estimate, checks, burn-intent signature, attestation, and manual mint; MetaMask does not sign.
- **Success and persisted data:** Result includes transfer ID, fee/source debit, mint hash, wallet, and a `withdraw` history row.
- **Named errors and fixes:** **`INSUFFICIENT_GATEWAY_BALANCE`**: reduce amount or deposit and await finality. **`INSUFFICIENT_GAS`**: fund the specified SCA/signer. **“Gateway attestation missing”**: preserve transfer ID and reconcile before retrying. See [withdraw](/docs/circle/gateway/withdraw).

## `/transfer`

- **Purpose:** Move scoped Gateway USDC, or explicitly combine ready balances with one BurnIntentSet.
- **Syntax and variants:** `/transfer <amount> [USDC] from <source> to <destination> [manual]`; `/transfer <amount> from gateway to <destination> [manual]` starts unified mode.
- **Example:** `/transfer 10 from base to arc`; if Base is short, choose the proposed minimum deposit or **Use Unified Gateway**.
- **Prerequisites:** SCA/depositor, a valid Circle quote, enough ready capacity after every intent's `maxFee`, and separately confirmed delegates on selected sources.
- **Preview:** Scoped preview shows ready balance, required maximum debit, and two explicit fallback choices. Unified preview shows checkboxes, allocations, per-source reserves, total fee, maximum debit, mint mode, exclusions, and fingerprint.
- **Confirmation boundary:** Deposit is a separate command and never auto-sends the original transfer. Persistent delegate authorization is also confirmed separately. Final transfer confirmation signs one EIP-712 BurnIntent or BurnIntentSet; MetaMask does not sign.
- **Success and persisted data:** Unified history stores `source_mode`, allocation JSON, one transfer ID, settled fee when available, destination hash, and optional Arc proof.
- **Named errors and fixes:** **`GATEWAY_INSUFFICIENT_SCOPED_BALANCE`**: choose deposit or unified. **`GATEWAY_INSUFFICIENT_UNIFIED_BALANCE`**: select more usable sources or reduce amount. **`GATEWAY_DELEGATE_REQUIRED`**: authorize, wait for finality, and preview again. **`GATEWAY_QUOTE_CHANGED`**: review the refreshed fingerprint. **`GATEWAY_FORWARDING_FAILED`**: reconcile the existing transfer ID. See [Gateway transfer](/docs/circle/gateway/transfer).

## `/gas`

- **Purpose:** Read native gas for the Circle wallet relevant to Gateway execution on one chain.
- **Syntax and variants:** `/gas check <chain>`; `check` and chain are both required by the parser.
- **Example:** `/gas check arc`; natural language: “Check my Arc wallet gas.”
- **Prerequisites:** Signed-in user, existing Circle SCA, supported chain, and current Wallet SDK coverage.
- **Preview:** Immediate read; inspect wallet ID/address, blockchain, native symbol, raw/formatted balance, and `hasGas`.
- **Confirmation boundary:** None; no transaction or signature occurs.
- **Success and persisted data:** Returns a gas snapshot and does not write history.
- **Named errors and fixes:** **“No Circle wallet found”**: run `/wallet create`. **“Invalid chain”**: use the support matrix. **“current Circle wallet SDK cannot check signer gas”**: choose a covered chain or inspect the named address with that chain's explorer.

## `/gateway`

- **Purpose:** Inspect Gateway configuration or only Gateway ledger balance, without adding SCA funds.
- **Syntax and variants:** `/gateway info`, `/gateway balance`, or `/gateway balance <chain>`.
- **Example:** `/gateway balance base`; natural language: “Show my Base Gateway balance.”
- **Prerequisites:** Sign in; balance requires an SCA/depositor address. No gas is needed for reads.
- **Preview:** Immediate read. `info` exposes public domains/contracts; `balance` exposes Gateway rows, partial/unavailable flags, and selected scope.
- **Confirmation boundary:** None; these variants never move money.
- **Success and persisted data:** Returns live configuration or fetched Gateway balance; no transaction-history row is created.
- **Named errors and fixes:** **“No wallet address found”**: create the SCA. **“Unsupported chain”**: correct the scope. **Gateway unavailable/partial**: retry later and do not interpret missing data as zero. See [unified balance](/docs/circle/gateway/unified-balance).
