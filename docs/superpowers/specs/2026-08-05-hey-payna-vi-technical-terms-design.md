# HEY PAYNA Vietnamese Deck — Technical-Term Localization Design

## Goal

Keep the hackathon deck understandable in Vietnamese while preserving the English product vocabulary that judges will see in the live interface, Circle documentation, transaction lifecycle, and source code.

## Localization Rule

- Narrative sentences, explanations, transitions, safety messages, and presenter scripts remain Vietnamese.
- Product and protocol names remain unchanged: AskPayna, Circle Gateway, Circle SCA, CCTP v2, Arc, MetaMask, DeepSeek, Next.js, TypeScript, and Supabase.
- Canonical Web3 and payment terms remain English when translation would make the demo harder to match with the UI or documentation: rail, finality, source domain, preview, intent, settlement, receipt, operation, testnet, stablecoin, parser, fallback, retrieval, custody, bridge, burn, mint, attestation, and cron.
- System status and lifecycle labels remain English when they represent actual application states: queued, running, waiting_gateway, success, failed, Submitted, Finalizing, and Receipt ready.
- The live-demo input remains exactly `Pay 1 USDC to Minh on Arc from Base.` so the slide, speaker script, and product interface show the same command.

## Slide Changes

- Slide 5 lifecycle headings use `DEPOSIT → FINALITY → PREVIEW → TRANSFER`.
- Slide 6 and slide 11 show the English live-demo command.
- Slide 10 capability labels use the product vocabulary `RESEARCH`, `PAY`, `REQUEST`, `PAYROLL`, `BRIDGE`, `SWAP`, `TRACK`, and `PROVE`.
- Slide 13 lifecycle headings use `Preview`, `Submitted`, `Finalizing`, and `Receipt ready`.
- Other English technical terms already present in the Vietnamese deck are retained.

## Speaker Notes

- Spoken explanations remain Vietnamese.
- The slide 6 instruction tells the presenter to type the English command exactly.
- The standalone Vietnamese notes file uses the same command and terminology as the embedded PowerPoint notes.
- Existing `[Sources]` blocks remain intact on all 14 slides.

## Outputs

- Update the existing Vietnamese PPTX in place while preserving the English source deck.
- Regenerate the Vietnamese PDF, montage, and 14 slide PNGs.
- Update the standalone Vietnamese speaker-notes file and README if needed.

## Acceptance Criteria

- The deck remains visually identical except for approved text edits.
- All 14 slides render without overflow or unintended overlap.
- The PPTX contains 14 visible speaker-note parts and 14 `[Sources]` blocks.
- The PDF contains 14 pages.
- The live-demo command is identical in slide 6, slide 11, embedded notes, and standalone notes.
