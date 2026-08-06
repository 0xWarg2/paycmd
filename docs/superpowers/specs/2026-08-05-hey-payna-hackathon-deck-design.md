# Hey Payna Hackathon Demo Deck Design

## Communication job

By the end of an 8–10 minute hackathon presentation, judges should understand that Hey Payna combines grounded Web3 intelligence and executable stablecoin infrastructure: AskPayna explains the right path with sources, while Circle Gateway turns an approved intent into a traceable cross-chain USDC action.

## Format and visual system

- English, 16:9, 11 core slides plus 3 backup slides.
- Payna dark-cosmic visual language: near-black navy canvas, mint-green signal color, cyan accents, warm off-white text, restrained red/amber status colors, antler logo, star/grid texture, and real product screenshots.
- Large takeaway titles, sparse body copy, one composition per slide, no invented traction or market statistics.
- Deliverables: editable PPTX with speaker notes, PDF, PNG for every slide, and a deck montage.

## Core slide sequence

1. **Move USDC across chains like sending a message.** Minimal cover with Payna logo, the subtitle “Grounded intelligence. Safe execution. Verifiable settlement.” and a cropped product interface.
2. **One payment still forces users to solve six Web3 problems.** Show the fragmented decisions: wallet, identity, source balance, payment rail, gas/finality, and proof. Presenter frames this as the systems problem Payna removes.
3. **Hey Payna connects “ask” and “act.”** Two large verbs connected by the explicit approval boundary: AskPayna retrieves and explains; Payna previews and executes only after confirmation.
4. **AskPayna answers with evidence—not guesses.** Show a research question about Circle Gateway on Arc, source badges for Payna Tutorial, Circle MCP, Arc MCP, and Web Search, plus the concise message “Research never signs or submits a transaction.”
5. **Circle Gateway turns deposited USDC into an execution-ready balance.** Explain the application flow in four concise stages: deposit and finalize, select a named source domain, preview amount plus fee, authorize one transfer intent and track destination settlement. Clearly separate SCA balance, Gateway balance, and CCTP.
6. **Live demo: pay Minh on Arc from Base.** Full-width command “Pay 1 USDC to Minh on Arc from Base.” with five checkpoints: resolve contact, inspect route, confirm, track Gateway, open Arc proof. This slide stays on screen during the live demo.
7. **The user sees one flow; Payna coordinates the rails.** Show the behind-the-command flow: natural language or slash command → deterministic validation → contact and wallet resolution → Gateway transfer → history, notification, and Arc receipt.
8. **AI can interpret intent. It cannot move funds.** State the safety boundary: explicit preview, user confirmation, source-scoped balance and fee checks, lifecycle status, and reconcile-before-retry behavior.
9. **Built with Circle + Arc, not simulated.** Present the architecture: Next.js/TypeScript UI, DeepSeek command router and grounded research, Circle Developer-Controlled Wallets, Circle Gateway, CCTP v2 for MetaMask bridge, Supabase, and a receipt registry on Arc that records evidence without custodying funds.
10. **This is a stablecoin command layer—not another bridge screen.** Contrast a single-purpose bridge with Payna’s combined research, payment, request, payroll, swap, history, notification, and proof surfaces while keeping Circle Gateway and AskPayna visually dominant.
11. **Ask with confidence. Move USDC with control. Prove what happened.** Resolve the opening, repeat the Base-to-Arc command, and close with “Hey Payna — the AI stablecoin copilot.”

## Backup slides

- **Gateway vs CCTP v2:** when Payna uses unified Gateway balance versus a MetaMask-held CCTP bridge.
- **Demo recovery:** pre-captured screenshots for preview, confirmation, Gateway finality, completion, and Arc proof; never resubmit a transaction whose status is uncertain.
- **Current boundaries:** testnet-oriented; no AI auto-execution; budgets are demo/static; schedules have no real cron; payroll is sequential; proof failure does not roll back the Circle payment.

## Speaker pacing

- Slides 1–5: 3 minutes.
- Slide 6 live demo: 2.5–3 minutes.
- Slides 7–10: 2.5 minutes.
- Slide 11: 20–30 seconds.
- Backup slides are used only for questions or demo recovery.

## Source policy

Product claims and visual assets come from the local Payna repository. Speaker notes cite the relevant local docs and assets; external protocol claims use official Circle or Arc documentation only when necessary.
