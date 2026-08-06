# HEY PAYNA Gateway-ready Rail Decision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two Vietnamese main-story slides that explain when HEY PAYNA uses CCTP Bridge versus Circle Gateway and how Gateway-ready execution selects one BurnIntent or a multi-source BurnIntentSet.

**Architecture:** Import the current 16-slide ARC HOUSE PPTX as the template source, insert two editable Artifact Tool slides immediately after current slide 6, move the thank-you slide to the final position, and renumber the deck to 18 slides. Preserve every existing visual, logo, note, and demo asset; update only the new slides, ordering, page numbers, demo transition, standalone notes, README, and regenerated exports.

**Tech Stack:** JavaScript ES modules, `@oai/artifact-tool`, Open XML PPTX import/export through Artifact Tool, bundled presentation/PDF QA scripts, LibreOffice PDF export, Poppler rendering.

## Global Constraints

- Final deck has exactly 18 slides.
- New slides become slides 7 and 8; live demo becomes slide 9.
- The original thank-you/X contact slide becomes final slide 18; appendix slides become 15–17.
- Visible copy is Vietnamese with precise English protocol terms retained.
- Preserve the ARC HOUSE × HEY PAYNA graphite, emerald/cyan, and restrained amber system.
- Keep official Circle and Arc logos at the top-right of all 18 slides.
- Use Gateway-ready balance only; never imply SCA balance or pending deposits are spendable by Gateway.
- `Scoped Gateway` means one named source and one `BurnIntent`.
- `Unified Gateway` means selected ready sources, one `BurnIntentSet`, at most 16 EVM intents, one EIP-712 signature, and one Circle transfer ID.
- Do not claim unified-liquidity concepts are exclusive to Circle; claim only that Circle Gateway and its Gateway primitives are Circle-specific.
- Every slide must retain visible Vietnamese speaker notes and a `[Sources]` block.
- Do not modify product code or the user’s unrelated dirty worktree changes.
- Do not commit generated PPTX/PDF/PNG files; keep implementation artifacts under `tmp/` and final deliverables under `output/hey-payna-hackathon/`.

---

## File map

- Create `tmp/hey-payna-gateway-ready/add-rail-slides.mjs`: import current deck, insert slides, move thank-you last, renumber, update notes, and export PPTX/layout inspection.
- Create `tmp/hey-payna-gateway-ready/verify-deck.mjs`: structural assertions for slide count, titles, notes, sources, logo coverage, and updated page numbers.
- Create `tmp/hey-payna-gateway-ready/template-frame-map.json`: template lineage for 18 output slides.
- Create `tmp/hey-payna-gateway-ready/source-notes.txt`: official Circle sources and local implementation evidence.
- Modify `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx`: final editable 18-slide deck.
- Create `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI-pre-gateway-ready.pptx`: exact backup of the current 16-slide ARC HOUSE deck.
- Modify `output/hey-payna-hackathon/Hey-Payna-Speaker-Notes-VI.md`: add slides 7–8 and renumber later sections.
- Modify `output/hey-payna-hackathon/README.md`: document 18-slide structure, new slide purpose, live-demo location, and backup.
- Regenerate `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pdf`.
- Regenerate `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI-montage.png`.
- Regenerate `output/hey-payna-hackathon/slides-vi/slide-1.png` through `slide-18.png`.

### Task 1: Freeze the source deck and create the template audit

**Files:**
- Create: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI-pre-gateway-ready.pptx`
- Create: `tmp/hey-payna-gateway-ready/source-notes.txt`
- Create: `tmp/hey-payna-gateway-ready/template-frame-map.json`
- Inspect: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx`

**Interfaces:**
- Consumes: the verified 16-slide ARC HOUSE deck.
- Produces: immutable backup, source provenance, slide lineage, and a clean workspace for later tasks.

- [ ] **Step 1: Create the workspace and exact backup**

Run:

```bash
mkdir -p tmp/hey-payna-gateway-ready
cp output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx \
  output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI-pre-gateway-ready.pptx
```

- [ ] **Step 2: Record source provenance**

Create `tmp/hey-payna-gateway-ready/source-notes.txt` with:

```text
Circle Gateway overview: https://developers.circle.com/gateway
Circle Gateway technical guide: https://developers.circle.com/gateway/references/technical-guide
CCTP technical guide: https://developers.circle.com/cctp/references/technical-guide
Local Gateway UI: components/paycmd-app.tsx
Local allocation limit and policy: lib/paycmd/gateway-allocation.ts
Local multi-source quote/signing model: lib/paycmd/gateway-unified-server.ts
Local Vietnamese product docs: content/public-docs/vi/circle/
```

- [ ] **Step 3: Inspect and render the source deck**

Run the official presentation inspection and render helpers against the backup. Expected: 16 slides, no overflow, Circle and Arc logos on every slide, and current live demo on slide 7.

```bash
PATH=/Users/xuanhaj/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:/Users/xuanhaj/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH \
/Users/xuanhaj/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  /Users/xuanhaj/.codex/plugins/cache/openai-primary-runtime/presentations/26.802.11031/skills/presentations/container_tools/render_slides.py \
  output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI-pre-gateway-ready.pptx \
  --output_dir tmp/hey-payna-gateway-ready/source-render --width 1600 --height 900
```

- [ ] **Step 4: Create the 18-slide frame map**

Map output slides 1–6 to source slides 1–6, output slides 7–8 to source slide 6 with declared `replace` regions, output slides 9–14 to source slides 7–12, output slides 15–17 to source slides 14–16, and output slide 18 to source slide 13. Declare Circle/Arc logo additions on new slides, the intentional slide reorder, and page-number text/move changes on downstream numbered slides.

- [ ] **Step 5: Checkpoint without a binary commit**

Confirm the backup exists and has the same SHA-256 as the source deck before editing. Do not stage `output/` or `tmp/`.

### Task 2: Write structural verification before authoring

**Files:**
- Create: `tmp/hey-payna-gateway-ready/verify-deck.mjs`
- Test: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx`

**Interfaces:**
- Consumes: a PPTX path as `process.argv[2]`.
- Produces: exit 0 only when the 18-slide Gateway-ready contract is satisfied.

- [ ] **Step 1: Implement the verifier**

The verifier must import the deck with `PresentationFile.importPptx` and assert:

```js
assert.equal(presentation.slides.items.length, 18);
assert.equal(slideText(7).includes("Bridge hay Gateway?"), true);
assert.equal(slideText(8).includes("Gateway-ready liquidity"), true);
assert.equal(slideText(8).includes("BurnIntentSet"), true);
assert.equal(slideText(8).includes("≤ 16"), true);
assert.equal(slideText(9).includes("Trả USDC cho Minh"), true);
assert.equal(slideText(18).includes("Cảm ơn mọi người"), true);
assert.equal(slideText(18).includes("@0xWarg__"), true);
assert.equal(slidesWithName("infra-circle-logo"), 18);
assert.equal(slidesWithName("infra-arc-logo"), 18);
assert.equal(slidesWithVisibleNotes(), 18);
assert.equal(slidesWithSourcesMarker(), 18);
```

It must also assert that slides 7 and 8 contain stable names for `rail-metamask`, `rail-sca`, `rail-gateway-ready`, `mode-scoped`, `mode-unified`, `intent-proof-strip`, and `number-7`/`number-8`.

- [ ] **Step 2: Run the verifier against the current deck**

Run:

```bash
node tmp/hey-payna-gateway-ready/verify-deck.mjs \
  output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx
```

Expected: FAIL with `Expected 18 slides, found 16`.

- [ ] **Step 3: Checkpoint**

Keep the failing verifier in `tmp/`; do not stage generated implementation files.

### Task 3: Insert and author slides 7–8

**Files:**
- Create: `tmp/hey-payna-gateway-ready/add-rail-slides.mjs`
- Modify: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx`
- Read: `tmp/hey-payna-arc-house/assets/circle-logo-dark-bg.png`
- Read: `tmp/hey-payna-arc-house/assets/arc-logo-dark-bg.png`

**Interfaces:**
- Consumes: the 16-slide backup and official logo PNGs.
- Produces: an 18-slide PPTX plus `final-layout/slide-01.layout.json` through `slide-18.layout.json`.

- [ ] **Step 1: Initialize Artifact Tool workspace**

```bash
node /Users/xuanhaj/.codex/plugins/cache/openai-primary-runtime/presentations/26.802.11031/skills/presentations/container_tools/setup_artifact_tool_workspace.mjs \
  --workspace tmp/hey-payna-gateway-ready
```

- [ ] **Step 2: Import the 16-slide backup and insert two slides**

In `add-rail-slides.mjs`:

```js
const presentation = await PresentationFile.importPptx(
  await FileBlob.load(sourcePptx),
);
assert.equal(presentation.slides.items.length, 16);

const sourceSlide6 = presentation.slides.items[5];
const railSlide = presentation.slides.insert({
  after: sourceSlide6,
  layoutId: sourceSlide6.layoutId,
});
const gatewaySlide = presentation.slides.insert({
  after: railSlide,
  layoutId: sourceSlide6.layoutId,
});
```

Set both new slides to `#071019`, add the 12 px emerald top band, and add Circle/Arc logos at the exact existing lockup positions: Circle `{ left: 1036, top: 20, width: 94, height: 28 }`, Arc `{ left: 1148, top: 20, width: 78, height: 28 }`.

- [ ] **Step 3: Author slide 7 as a three-state decision path**

Create editable shapes with these visible strings:

```text
RAIL DECISION
Bridge hay Gateway? Chọn theo nơi USDC đang nằm.

USDC TRONG METAMASK
CCTP v2 Bridge
Direct / thỉnh thoảng
Source burn → attestation → destination mint

USDC TRONG CIRCLE SCA
CHƯA GATEWAY-READY
Deposit → chờ finality/indexing
Không thể chi ngay bằng Gateway

GATEWAY-READY USDC
CIRCLE GATEWAY
Pay · Transfer · Payroll · thanh toán lặp lại
Finality được đưa lên trước execution

SCA balance ≠ pending deposit ≠ Gateway-ready balance.
```

Use stable names `rail-metamask`, `rail-sca`, and `rail-gateway-ready`. Use cyan, amber, and emerald respectively. Add `number-7` left of the logo lockup.

- [ ] **Step 4: Add Vietnamese speaker notes to slide 7**

Set notes to:

```text
[Thời lượng: 40–45 giây]

“Bridge và Gateway không thay thế nhau một cách máy móc. Payna chọn rail dựa trên nơi USDC đang nằm. Nếu USDC ở MetaMask và người dùng cần một lần chuyển trực tiếp, Payna dùng CCTP v2: burn ở source, nhận attestation của Circle rồi mint ở destination.

Nếu USDC còn trong Circle SCA, nó chưa phải Gateway-ready. Người dùng phải deposit và chờ Circle xử lý finality. Chỉ balance mà Gateway báo ready mới được dùng cho Pay, Transfer và Payroll. Vì vậy Payna không gộp SCA, pending deposit và ready balance thành một con số có thể tiêu.”

[Chuyển slide]
“Khi balance đã ready, Payna còn phải quyết định dùng một source hay gom nhiều source.”

[Sources]
- https://developers.circle.com/gateway
- https://developers.circle.com/gateway/references/technical-guide
- https://developers.circle.com/cctp/references/technical-guide
```

- [ ] **Step 5: Author slide 8 as dApp support plus intent modes**

Create the left support list:

```text
DAPP HỖ TRỢ
Ready balance theo source
Pay · Transfer · Payroll
Fee quote + maximum reserve
Chọn source + xem allocation
Delegate consent riêng
Auto forwarding / Manual mint
Activity · notification · Arc receipt
```

Create the right execution modes:

```text
SCOPED GATEWAY
Một source được chỉ định
Source đủ amount + fee reserve
1 BurnIntent

UNIFIED GATEWAY
Nhiều Gateway-ready source cùng góp
BurnIntentSet ≤ 16 EVM intents
Preview từng allocation trước khi ký
```

Create the bottom proof strip:

```text
Một source đủ → 1 BurnIntent · Nhiều source cùng góp → BurnIntentSet ≤ 16
Một lần duyệt · một EIP-712 signature · một Circle transfer ID
```

Use stable names `mode-scoped`, `mode-unified`, and `intent-proof-strip`. Add `number-8` left of the logo lockup.

- [ ] **Step 6: Add Vietnamese speaker notes to slide 8**

Set notes to:

```text
[Thời lượng: 45–50 giây]

“HEY PAYNA tập trung biến Gateway-ready liquidity thành payment rail. DApp đọc ready balance theo từng source, quote fee và maximum reserve, cho người dùng chọn source, xem allocation và xác nhận delegate riêng khi cần.

Nếu source được chỉ định đủ capacity, Payna giữ scoped mode và tạo một BurnIntent. Nếu balance nằm rải trên nhiều source, người dùng phải chọn Unified Gateway. Payna có thể tạo một BurnIntentSet tối đa 16 EVM intents, dùng chung một EIP-712 signature và theo dõi bằng một Circle transfer ID.

Điểm quan trọng là Unified Gateway không tự lấy SCA balance hoặc pending deposit. Mọi source, allocation và fee reserve đều xuất hiện trong preview trước khi ký.”

[Chuyển slide]
“Bây giờ chúng ta sẽ demo payment từ Base đến Minh trên Arc và chỉ ra source mode trong preview.”

[Sources]
- https://developers.circle.com/gateway/references/technical-guide
- components/paycmd-app.tsx
- lib/paycmd/gateway-allocation.ts
- lib/paycmd/gateway-unified-server.ts
```

- [ ] **Step 7: Renumber downstream slides and update live-demo notes**

Move the original thank-you slide, now temporarily at position 15 after insertion, to final position 18. For every slide, derive its 1-based final index. If it has a shape whose name matches `/^number-\d+$/`, set the shape text to a two-digit index and rename it `number-${index}`. The live demo must be slide 9 and its notes must begin the demo by pointing out:

```text
Trước khi xác nhận, chỉ rõ Source mode trong preview: Scoped dùng một BurnIntent; Unified Gateway hiện bảng allocation và BurnIntentSet.
```

Do not change the live demo command: `Pay 1 USDC to Minh on Arc from Base.`

- [ ] **Step 8: Export PPTX, layouts, and inspection**

Export to the stable PPTX path, render all 18 slide PNGs under `tmp/hey-payna-gateway-ready/render/`, export layouts under `tmp/hey-payna-gateway-ready/final-layout/`, and write inspection NDJSON.

- [ ] **Step 9: Run the structural verifier**

```bash
node tmp/hey-payna-gateway-ready/verify-deck.mjs \
  output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx
```

Expected: PASS with 18 slides, 18 notes/source blocks, 18 Circle logos, and 18 Arc logos.

- [ ] **Step 10: Checkpoint without committing generated artifacts**

Review `git status --short` and confirm only `tmp/` and `output/` artifacts changed in this task.

### Task 4: Update standalone notes and handoff documentation

**Files:**
- Modify: `output/hey-payna-hackathon/Hey-Payna-Speaker-Notes-VI.md`
- Modify: `output/hey-payna-hackathon/README.md`

**Interfaces:**
- Consumes: final 18-slide ordering and the exact slide 7–8 speaker notes.
- Produces: rehearsal notes and a file-purpose guide matching the PPTX.

- [ ] **Step 1: Insert slide 7 and slide 8 note sections**

Add the exact speaker-note text from Task 3. Renumber the previous slide 7–16 headings to 9–18. Preserve all existing timing, demo fallback instructions, and X contact copy.

- [ ] **Step 2: Update every live-demo reference**

Replace references to live demo slide 7 with slide 9. Update the main-story range to slides 2–14, appendix to slides 15–17, and thank-you/X contact to slide 18. Add a presenter note on slide 14: jump to slide 18 for the normal closing; open slides 15–17 only for Q&A or demo fallback.

- [ ] **Step 3: Update README file descriptions**

Document:

```text
- 18-slide Vietnamese ARC HOUSE deck.
- Slides 7–8 explain Bridge vs Gateway and scoped vs unified BurnIntent execution.
- Live demo is slide 9.
- Slides 15–17 are Q&A/demo fallback.
- Slide 18 is the final thank-you and contains X @0xWarg__.
- Hey-Payna-Hackathon-Demo-VI-pre-gateway-ready.pptx is the 16-slide backup.
```

- [ ] **Step 4: Verify notes/document consistency**

Run:

```bash
rg -n "Slide 7|Slide 8|Slide 9|BurnIntentSet|Gateway-ready|@0xWarg__" \
  output/hey-payna-hackathon/Hey-Payna-Speaker-Notes-VI.md \
  output/hey-payna-hackathon/README.md
```

Expected: new slide sections and live-demo numbering agree with the PPTX; no stale claim says live demo is slide 7.

### Task 5: Render, inspect, export, and verify final deliverables

**Files:**
- Modify: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pdf`
- Modify: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI-montage.png`
- Modify: `output/hey-payna-hackathon/slides-vi/slide-1.png` through `slide-18.png`
- Create: `tmp/pdfs/hey-payna-gateway-ready-final/page-01.png` through `page-18.png`

**Interfaces:**
- Consumes: final 18-slide PPTX and updated handoff docs.
- Produces: verified PPTX/PDF/PNG delivery set.

- [ ] **Step 1: Run slide overflow and template-fidelity checks**

Run `slides_test.py` and `check_template_fidelity.mjs` with the new 18-slide frame map. Expected: no overflow and zero fidelity issues.

- [ ] **Step 2: Render all 18 PPTX slides**

Render to `output/hey-payna-hackathon/slides-vi/`. Inspect every slide individually at full size, with special attention to slides 6–9 and renumbered slides 14–18.

- [ ] **Step 3: Build and inspect the 18-slide montage**

Create a 4-column numeric montage from `slide-1.png` through `slide-18.png`. Verify narrative order, logo consistency, page numbers, and that slides 7–8 are visually distinct but template-consistent.

- [ ] **Step 4: Export the final PDF**

Use bundled LibreOffice to export the PPTX to a temporary directory, then copy the resulting 18-page PDF to the stable output path.

- [ ] **Step 5: Render and inspect all PDF pages**

Use `pdftoppm -png -r 150` and build a PDF contact sheet. Inspect all pages and view slides 7, 8, 9, and 18 individually at original resolution.

- [ ] **Step 6: Run final structural audit**

Assert:

```text
slides = 18
speaker notes = 18
notes with [Sources] = 18
Circle logo slides = 18
Arc logo slides = 18
slide 7 contains Bridge/Gateway decision copy
slide 8 contains BurnIntentSet and ≤ 16
slide 9 contains the live-demo command
slide 18 contains @0xWarg__ and the thank-you copy
slide PNGs = 18
PDF pages = 18
backup exists
standalone notes and README exist
```

- [ ] **Step 7: Run project tests without modifying unrelated failures**

Run `npm test`. The current baseline has one unrelated failure in `lib/paycmd/ai/payna-tutorial.test.ts` because the dirty worktree removed the literal `/transfer 5 from base to arc` from `content/payna-tutorial.json`. If the same single failure remains, report it transparently and do not edit product code. Any new failure requires investigation before handoff.

- [ ] **Step 8: Final checkpoint**

Confirm final paths, file sizes, 18-page counts, and unchanged user-owned product files. Do not stage or commit generated deck artifacts.
