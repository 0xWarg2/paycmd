# HEY PAYNA Gateway-ready rail decision — design spec

## Objective

Make the hackathon deck explain three decisions before the live demo:

1. when the dApp uses CCTP v2 Bridge versus Circle Gateway;
2. why HEY PAYNA executes only from Gateway-ready liquidity rather than treating every visible USDC balance as spendable;
3. how the updated Gateway flow chooses one scoped `BurnIntent` or a multi-source `BurnIntentSet`.

The audience is the ARC HOUSE Việt Nam hackathon jury. Visible slide copy remains Vietnamese, while protocol and product terms stay in English where they improve technical precision.

## Narrative change

Insert two main-story slides after the current Circle Gateway slide and before the live demo. The deck grows from 16 to 18 slides. The live-demo slide and every later slide move forward by two positions; their content remains otherwise unchanged unless a page number or transition sentence must be updated.

The revised sequence is:

- Slide 6: Circle Gateway turns finalized deposits into ready balance.
- Slide 7: choose CCTP Bridge or Circle Gateway according to where USDC is held.
- Slide 8: HEY PAYNA turns Gateway-ready liquidity into a payment rail using scoped or unified intent execution.
- Slide 9: live demo — pay Minh on Arc from Base.

The existing appendix comparison remains available for Q&A, but its notes should point back to the new main-story explanation instead of repeating it verbatim.

## Slide 7 — Bridge or Gateway?

### Communication job

Prevent the jury from interpreting Gateway as a generic replacement for every bridge. Rail selection begins with fund location and intended usage.

### Title

`Bridge hay Gateway? Chọn theo nơi USDC đang nằm.`

### Visible structure

Use a three-stage horizontal decision path, not a dense table:

1. **USDC trong MetaMask**
   - Use `CCTP v2 Bridge`.
   - Best for direct or occasional point-to-point movement.
   - Flow: source burn → Circle attestation → destination mint.

2. **USDC trong Circle SCA**
   - It is not Gateway-ready yet.
   - Deposit into Gateway, then wait for finality/indexing.
   - The dApp must not label this balance as immediately spendable by Gateway.

3. **Gateway-ready USDC**
   - Use `Circle Gateway`.
   - Best for Pay, Transfer, Payroll, repeated payments, and chain-abstracted spending.
   - Finality is front-loaded before execution rather than occurring in the middle of each payment.

### Primary callout

`SCA balance ≠ pending deposit ≠ Gateway-ready balance.`

### Speaker note emphasis

Circle Gateway is a Circle product and protocol. The broader categories of chain abstraction and unified liquidity are not exclusive to Circle. The Circle-specific claim is the Gateway implementation and its primitives: Gateway Wallet/Minter, BurnIntent, BurnIntentSet, Gateway attestation, and ready balance.

## Slide 8 — Gateway-ready payment rail

### Communication job

Show the jury what HEY PAYNA adds on top of Circle Gateway and make the new one-versus-many intent choice explicit.

### Title

`HEY PAYNA biến Gateway-ready liquidity thành payment rail.`

### Visible structure

Use a two-column comparison with one bottom proof strip.

#### Left column — dApp support

- Read ready balance by source domain.
- Support Pay, Transfer, and Payroll execution.
- Quote estimated fee and maximum fee reserve before approval.
- Let the user select sources and review allocation.
- Require separate consent for persistent delegate authorization.
- Offer Auto forwarding or Manual mint only where the destination supports it.
- Persist Activity, notification, Circle transfer ID, and optional Arc receipt evidence.

#### Right column — intent mode

**Scoped Gateway**

- The user names one source.
- The selected source has enough ready capacity for amount plus fee reserve.
- HEY PAYNA creates one `BurnIntent`.

**Unified Gateway**

- The user explicitly chooses `Dùng Unified Gateway` or commands `from gateway`.
- HEY PAYNA allocates ready balance across selected usable sources.
- The app creates a `BurnIntentSet` with up to 16 EVM burn intents.
- The set uses one EIP-712 signature and settles under one Circle transfer ID.
- Preview shows each allocation, ready balance, maximum fee reserve, maximum debit, priority reason, and delegate status.

### Bottom proof strip

`Một source đủ → 1 BurnIntent · Nhiều source cùng góp → BurnIntentSet ≤ 16`

Secondary line:

`Một lần duyệt · một EIP-712 signature · một Circle transfer ID`

### Safety boundaries

- Unified execution uses Gateway-ready balance only.
- It never auto-spends Circle SCA balance or pending deposits.
- A scoped shortfall offers an explicit minimum deposit or Unified Gateway; it does not silently change source mode.
- Changing selected sources refreshes the quote and allocation fingerprint.
- No burn is submitted while required delegate authorization remains pending.

## Visual treatment

- Preserve the established ARC HOUSE × HEY PAYNA graphite, emerald/cyan, and restrained amber system.
- Keep official Circle and Arc logos at the top-right of both new slides.
- Use native PowerPoint shapes and concise labels so the slides remain editable.
- Slide 7 uses cyan for CCTP, amber for SCA/pending, and emerald for Gateway-ready.
- Slide 8 uses blue/cyan for scoped execution and emerald for unified execution; amber is reserved for fee reserve, delegate, or safety boundaries.
- Do not add another full-bleed generated background. The new slides inherit the technical-slide background and grid treatment.
- Maintain the existing font scale, margins, page-number style, and speaker-note format.

## Speaker notes and sources

Both slides receive Vietnamese speaker notes with:

- a 35–50 second talk track;
- one transition sentence into the next slide;
- terminology guardrails, especially the distinction between Circle-specific Gateway primitives and the broader unified-liquidity category;
- a `[Sources]` block.

Primary sources:

- `https://developers.circle.com/gateway`
- `https://developers.circle.com/gateway/references/technical-guide`
- `https://developers.circle.com/cctp/references/technical-guide`
- local implementation and product documentation under `components/paycmd-app.tsx`, `lib/paycmd/gateway-allocation.ts`, `lib/paycmd/gateway-unified-server.ts`, and `content/public-docs/vi/circle/`.

## Acceptance criteria

- Final deck has exactly 18 slides.
- The two new slides appear immediately before the live demo.
- A jury member can answer where USDC must be located for Bridge, SCA deposit, and Gateway execution after reading slide 7.
- Slide 8 visibly distinguishes one scoped BurnIntent from a multi-source BurnIntentSet capped at 16 intents.
- The dApp support list matches the current local implementation.
- The deck does not claim that all unified-liquidity designs belong exclusively to Circle.
- All 18 slides retain Circle and Arc logos and have Vietnamese speaker notes with source blocks.
- The live-demo script is updated to demonstrate or verbally point out the scoped/unified choice.
- No text overflow, unintended overlap, broken page numbering, or template-fidelity violation remains after export.
- PPTX, PDF, montage, per-slide PNGs, standalone notes, and README are regenerated and verified.
