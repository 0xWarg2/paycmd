# Arc Microgrants submission draft — HeyPayna

Status: **draft, not ready to submit** until the mainnet deployment and real transfer are verified.

- Live app: https://heypayna.xyz/pay (planned route; confirm production release before submission).
- Public repository: https://github.com/0xWarg2/paycmd.
- Public builder profile: https://github.com/0xWarg2.
- Prior Circle/Arc funding: the user confirmed on 2026-10-12 that this project has never received Circle or Arc funding.
- Mainnet transaction: pending funded wallet and user signature; do not replace with a testnet hash.
- Demo video: pending actual verified flow.

## Product description (use after release verification)

HeyPayna turns a payment command into a clear preview and a user-confirmed USDC transaction on Arc. Users connect MetaMask, enter a same-network /pay command, review the network, recipient, amount and estimated USDC gas, then confirm and sign in their wallet. Settlement is verified against the transaction receipt and USDC Transfer event. Network-specific history links to the Arc explorer and resumes status checks after reload.

Arc makes USDC both the payment asset and gas asset. This lets the preview express the payment and its fee in the same familiar currency. The implementation handles Arc's 6-decimal ERC-20 interface and 18-decimal native gas accounting without counting their shared balance twice.

The mainnet release supports direct wallet payments. The older Circle Gateway, bridge, swap and scheduling features remain labeled as testnet functionality. Existing platform usage statistics are testnet activity and transfer volume, not revenue. Self-transfers used for smoke testing are disclosed and excluded from payment-volume metrics.

## Reviewer walkthrough

1. Open the verified deployment's `/pay` route and sign in.
2. Connect MetaMask and select Arc Mainnet (chain ID 5042).
3. Enter `/pay 0.000001 USDC to <reviewer-controlled receiver> on arc-mainnet` using a wallet funded with sufficient real Arc USDC for payment and gas.
4. Inspect the network, exact receiver, amount and maximum estimated gas in the preview.
5. Confirm, sign the preview ownership message, then review and sign the USDC transaction in MetaMask.
6. Follow the hash in history and compare it with the explorer. A pending receipt remains pending. Success appears only after receipt verification.

## Actual demo capture, 60–90 seconds

- 0–15s: show the deployed `/pay` route, connected wallet and Arc Mainnet chain badge.
- 15–35s: type the command and show recipient, amount and estimated gas in the preview.
- 35–60s: show user confirmation, wallet prompts, returned hash and pending/settled status.
- 60–90s: open the explorer, match hash/receiver/amount, then reload Payna to show persisted history.

Record a real flow, label any self-transfer explicitly, and redact private account/email details. UI fixtures and mock receipts are QA evidence only and must not be presented as mainnet activity.

## Program verification

[Official event](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq), checked 2026-10-12: mainnet deployment, public repo, short description and public builder profile are required; testnet-only projects and work already funded by Circle/Arc are ineligible. Deadline: 2026-10-14 23:59 ET = **2026-10-15 10:59 Vietnam time**. The page says dates/counts may change, so check again immediately before submission.

The Register link goes to DoraHacks. Its destination could not be fetched during this implementation session; the current form fields and any additional conditions remain unverified. Do not submit until the user reviews the working production app, transaction evidence, form and final description.
