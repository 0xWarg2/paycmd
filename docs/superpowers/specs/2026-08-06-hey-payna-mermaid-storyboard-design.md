# HEY PAYNA Mermaid Storyboard Design

## Goal

Create a Vietnamese Mermaid storyboard for all 18 slides of the HEY PAYNA ARC HOUSE hackathon deck. Every diagram must explain one audience-facing idea in a few seconds, with extra clarity and detail on slides 3, 6, 8, 9, and 10.

## Deliverable

Create `output/hey-payna-hackathon/Hey-Payna-Mermaid-Storyboard-VI.md`.

For every slide, the file contains:

1. the audience takeaway;
2. one Mermaid diagram;
3. one presenter callout sentence;
4. a placement recommendation: full-slide, half-slide, or optional appendix visual.

The current PowerPoint and native Google Slides deck remain unchanged in this phase.

## Audience and language

- Audience: ARC HOUSE Việt Nam hackathon jury and community members.
- Visible labels are Vietnamese, retaining English protocol terms only where precision requires them.
- Diagrams explain product behavior, not code structure.
- Do not expose API routes, database tables, function names, implementation modules, or academic notation.
- Prefer familiar words such as “Người dùng”, “Xem trước”, “Xác nhận”, “Đang hoàn tất”, and “Biên nhận”.

## Visual grammar

- Use `flowchart LR` for journeys and comparisons.
- Use `flowchart TB` for layered explanations or before/after states.
- Use at most six primary nodes on ordinary slides.
- Key slides may use up to nine nodes when the extra branch is essential.
- Use short labels, explicit arrow text, and one clear reading direction.
- Use soft rounded nodes through Mermaid classes; avoid dense subgraphs and crossed lines.
- Stable color meaning:
  - emerald: ready, success, payment available;
  - cyan: information, evidence, routing choice;
  - amber: waiting, preview, or user approval;
  - red: blocked action, unsafe retry, or failure boundary;
  - neutral graphite: context or inactive state.

## Slide-by-slide narrative roles

1. Welcome: ARC HOUSE audience meets HEY PAYNA.
2. Product promise: a sentence becomes a controlled USDC payment.
3. Problem: six Web3 concerns overwhelm one simple payment request.
4. Product thesis: AskPayna explains; Payna Commands acts after approval.
5. Grounded research: question routes to evidence, then produces a sourced answer.
6. Gateway readiness: deposit reaches Circle finality, Circle sends a webhook, Payna updates the balance to ready, and payment becomes available.
7. Rail choice: MetaMask-held USDC uses CCTP; SCA-held USDC must deposit; Gateway-ready USDC uses Gateway.
8. Intent choice: one sufficient source produces one BurnIntent; distributed ready liquidity produces a user-approved BurnIntentSet of at most 16 intents.
9. Live demo: command, preview, confirm, Gateway execution, webhook status update, Activity, and Arc receipt.
10. Orchestration: the user sees one journey while Payna coordinates validation, identity, payment rail, and evidence.
11. Safety: AI may understand and prepare but cannot sign or submit without confirmation.
12. Architecture: experience, intelligence, Circle payment rails, and Arc/Supabase evidence.
13. Command layer: many stablecoin jobs reuse one controlled journey.
14. Conclusion: understand, approve, execute, prove.
15. Appendix rail comparison: Gateway for ready recurring liquidity; CCTP for direct wallet bridging.
16. Finality fallback: webhook updates quickly after Circle confirms; if notification is delayed, Payna reconciles the same operation and never blind-retries.
17. Prototype boundary: working capabilities now and explicit hackathon limits.
18. Thank-you: audience questions and X contact.

## Key-slide designs

### Slide 3 — Six concerns, one user goal

Use a central “Trả tiền cho Minh” goal flowing into six compact concerns, then converge on “Quá nhiều quyết định”. The diagram must make the burden visible without reading like a technical checklist.

### Slide 6 — Gateway-ready through webhook status updates

Use one horizontal journey:

`Deposit USDC → Circle chờ finality → Circle xác nhận → Webhook báo Payna → Balance: Gateway-ready → Có thể thanh toán`

The presenter callout must state: the webhook does not make blockchain finality faster; it removes slow status polling by notifying Payna as soon as Circle confirms the deposit.

### Slide 8 — Scoped or Unified

Start from Gateway-ready balances and ask one simple decision: “Một source đủ amount + fee?”. The yes path ends at `1 BurnIntent`. The no path requires an explicit user choice, previews allocations, and ends at `BurnIntentSet ≤ 16`. Both paths converge on one approval and one tracked Circle transfer.

### Slide 9 — Live payment with observable finality

Show the audience journey, not backend internals:

`Câu lệnh → Preview → Confirm → Circle Gateway → Webhook cập nhật → Activity → Arc receipt`

Add one red safety branch from the waiting state: `Không gửi lại mù quáng`.

### Slide 10 — One experience, coordinated layers

Use two audience-friendly lanes:

- top: what the user sees — ask, preview, confirm, receipt;
- bottom: what Payna coordinates — understand, verify, choose rail, track evidence.

Avoid implementation names and code-oriented terminology.

## Webhook accuracy rule

Never claim that a webhook accelerates blockchain finality. The correct audience statement is:

> Circle quyết định khi deposit đã final. Webhook giúp Payna biết ngay khi Circle xác nhận, nên giao diện chuyển sang Gateway-ready nhanh hơn so với chờ polling định kỳ.

## Validation

- Exactly 18 numbered slide sections.
- Exactly 18 Mermaid blocks.
- Slides 3, 6, 8, 9, and 10 contain the detailed flows above.
- At least two diagrams explain webhook-driven status updates: slide 6 and slide 16; slide 9 also includes the webhook in the live journey.
- Every Mermaid block uses a supported diagram type and has balanced identifiers, arrows, and class definitions.
- No diagram contains developer-facing paths, function names, database terms, or academic notation.
- The finality wording passes a scan for the required distinction between faster notification and unchanged blockchain finality.
