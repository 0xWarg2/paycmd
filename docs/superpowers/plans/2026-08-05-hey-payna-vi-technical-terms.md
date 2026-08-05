# HEY PAYNA Vietnamese Technical Terms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Vietnamese HEY PAYNA hackathon deck so Vietnamese explanations retain the English product, protocol, lifecycle, and live-demo vocabulary needed to match the product UI and Circle documentation.

**Architecture:** Continue the existing template-following workflow: edit only inherited text and notes through the JavaScript `@oai/artifact-tool` localization module, then regenerate the PPTX and its derived PDF/PNG outputs. Preserve the 14-slide English source deck and all geometry, styling, images, masters, layouts, and `[Sources]` blocks.

**Tech Stack:** JavaScript ES modules, `@oai/artifact-tool`, PowerPoint PPTX, LibreOffice PDF export, bundled presentation render/test/fidelity tools.

## Global Constraints

- Narrative sentences, explanations, transitions, safety messages, and presenter scripts remain Vietnamese.
- Product and protocol names remain unchanged: AskPayna, Circle Gateway, Circle SCA, CCTP v2, Arc, MetaMask, DeepSeek, Next.js, TypeScript, and Supabase.
- Canonical Web3/payment terms and actual system statuses remain English when they map to the UI, documentation, or code.
- The live-demo input is exactly `Pay 1 USDC to Minh on Arc from Base.`
- Preserve 14 slides, 14 speaker-note parts, 14 `[Sources]` blocks, and a 14-page PDF.
- Preserve the English source deck and edit the Vietnamese output in place.

---

### Task 1: Align the localization source and standalone presenter script

**Files:**
- Modify: `tmp/hey-payna-vi/localize-deck.mjs`
- Modify: `output/hey-payna-hackathon/Hey-Payna-Speaker-Notes-VI.md`
- Modify: `output/hey-payna-hackathon/README.md`

**Interfaces:**
- Consumes: the existing 14-slide `template-starter.pptx` and per-slide translation/notes arrays in `localize-deck.mjs`.
- Produces: one localization module whose slide text and embedded notes use the approved terminology consistently.

- [ ] **Step 1: Verify the current module still contains translated lifecycle labels and a Vietnamese live-demo command**

Run:

```bash
rg -n 'NẠP|CHỜ FINALITY|XEM TRƯỚC|CHUYỂN|Trả 1 USDC|NGHIÊN CỨU|Đang finalizing' tmp/hey-payna-vi/localize-deck.mjs output/hey-payna-hackathon/Hey-Payna-Speaker-Notes-VI.md
```

Expected: matches identify the exact strings that must be replaced.

- [ ] **Step 2: Update the localization module**

Apply these exact visible-text changes:

```text
Slide 5: DEPOSIT → FINALITY → PREVIEW → TRANSFER
Slide 6 command: Pay 1 USDC to Minh on Arc from Base.
Slide 10: RESEARCH, PAY, REQUEST, PAYROLL, BRIDGE, SWAP, TRACK, PROVE
Slide 11 command: Pay 1 USDC to Minh on Arc from Base.
Slide 13: Preview, Submitted, Finalizing, Receipt ready
```

Update slide 6 embedded notes so the presenter types the same English command while all spoken explanation remains Vietnamese.

- [ ] **Step 3: Update the standalone notes and usage guidance**

Change the slide 6 command in `Hey-Payna-Speaker-Notes-VI.md` to the exact English command. Add one README sentence explaining that English technical terms are intentionally retained to match the UI, source code, and Circle/Arc documentation.

- [ ] **Step 4: Check source consistency**

Run:

```bash
rg -n 'Pay 1 USDC to Minh on Arc from Base\.|DEPOSIT|FINALITY|PREVIEW|TRANSFER|RESEARCH|PAYROLL|Receipt ready' tmp/hey-payna-vi/localize-deck.mjs output/hey-payna-hackathon/Hey-Payna-Speaker-Notes-VI.md
```

Expected: the exact demo command appears in slide 6, slide 11, embedded notes, and the standalone notes; technical lifecycle/capability labels appear in the translation map.

### Task 2: Regenerate and verify the Vietnamese PowerPoint

**Files:**
- Modify: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx`
- Regenerate: `tmp/hey-payna-vi/final-render/*.png`
- Regenerate: `tmp/hey-payna-vi/final-layout/*.layout.json`

**Interfaces:**
- Consumes: `tmp/hey-payna-vi/localize-deck.mjs` and `tmp/hey-payna-vi/template-starter.pptx`.
- Produces: editable 14-slide Vietnamese PPTX with embedded Vietnamese speaker notes.

- [ ] **Step 1: Run the localization module**

Run:

```bash
/Users/xuanhaj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tmp/hey-payna-vi/localize-deck.mjs
```

Expected: exits 0 and writes `Hey-Payna-Hackathon-Demo-VI.pptx`.

- [ ] **Step 2: Run overflow testing**

Run:

```bash
/Users/xuanhaj/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/xuanhaj/.codex/plugins/cache/openai-primary-runtime/presentations/26.802.11031/skills/presentations/container_tools/slides_test.py output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx
```

Expected: `Test passed. No overflow detected.`

- [ ] **Step 3: Run template fidelity testing**

Run:

```bash
/Users/xuanhaj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/xuanhaj/.codex/plugins/cache/openai-primary-runtime/presentations/26.802.11031/skills/presentations/template_following_scripts/check_template_fidelity.mjs --workspace tmp/hey-payna-vi --final-pptx output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx --map tmp/hey-payna-vi/template-frame-map.json --starter-pptx tmp/hey-payna-vi/template-starter.pptx --starter-layout-dir tmp/hey-payna-vi/template-starter-layout --final-layout-dir tmp/hey-payna-vi/final-layout --edit-dir tmp/hey-payna-vi --no-report
```

Expected: status `pass` with `issueCount: 0`.

- [ ] **Step 4: Inspect all 14 rendered slide images**

Review `tmp/hey-payna-vi/final-render/slide-01.png` through `slide-14.png` at full size, checking the changed labels and demo commands for wrapping, clipping, alignment, and terminology consistency.

### Task 3: Regenerate derived outputs and perform final verification

**Files:**
- Modify: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pdf`
- Modify: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI-montage.png`
- Modify: `output/hey-payna-hackathon/slides-vi/slide-1.png` through `slide-14.png`

**Interfaces:**
- Consumes: the verified Vietnamese PPTX.
- Produces: PDF, montage, individual PNG slides, and a final validation record.

- [ ] **Step 1: Render the final PPTX to individual PNGs**

Run:

```bash
/Users/xuanhaj/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/xuanhaj/.codex/plugins/cache/openai-primary-runtime/presentations/26.802.11031/skills/presentations/container_tools/render_slides.py output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx --output_dir output/hey-payna-hackathon/slides-vi --width 1600 --height 900
```

Expected: 14 PNG files.

- [ ] **Step 2: Regenerate the montage and PDF**

Run the bundled contact-sheet helper over all 14 PNGs and use the bundled `soffice --headless --convert-to pdf` command to overwrite the Vietnamese PDF.

- [ ] **Step 3: Render and visually inspect the 14-page PDF**

Use bundled `pdftoppm -png` and contact-sheet tooling. Confirm the PDF preserves the latest lifecycle labels, command text, typography, and image placement.

- [ ] **Step 4: Verify structural counts and terminology**

Require all of the following:

```text
slides_test.py: pass
template fidelity: pass, issueCount 0
rendered PNGs: 14
speaker-note parts: 14
[Sources] blocks: 14
PDF pages: 14
live-demo command: exact English string in slide 6, slide 11, and presenter notes
```

- [ ] **Step 5: Commit only the implementation plan**

Run:

```bash
git add docs/superpowers/plans/2026-08-05-hey-payna-vi-technical-terms.md
git commit -m "docs: plan bilingual Payna deck update"
```

Do not stage generated binary output unless explicitly requested by the user.
