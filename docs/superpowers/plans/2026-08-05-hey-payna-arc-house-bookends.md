# HEY PAYNA ARC HOUSE Việt Nam Bookends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Vietnamese HEY PAYNA hackathon deck from 14 to 16 slides by adding a personalized ARC HOUSE Việt Nam welcome slide and a thank-you/X-contact slide.

**Architecture:** Rebuild the Vietnamese template starter from the unchanged 14-slide English source using a 16-entry source-slide map. Both new bookend slides duplicate source slide 11, while all existing slides continue to duplicate their original source frames and are edited in place through `@oai/artifact-tool`.

**Tech Stack:** JavaScript ES modules, `@oai/artifact-tool`, PowerPoint PPTX, LibreOffice PDF export, Poppler PDF rendering, bundled presentation template-fidelity and overflow tools.

## Global Constraints

- Preserve the English 14-slide source deck unchanged.
- Produce exactly 16 Vietnamese slides in this order: welcome, existing slides 1–11, thank-you, existing backup slides 12–14.
- Slide 1 names Lecter Vũ, Teddy, and the ARC HOUSE Việt Nam community.
- Slide 13 displays `@0xWarg__` and `x.com/0xWarg__`.
- Preserve all approved Vietnamese narrative copy and English technical terms.
- Preserve the exact command `Pay 1 USDC to Minh on Arc from Base.`
- Preserve source typography, geometry, images, masters, layouts, and object structure.
- Every slide must contain Vietnamese speaker notes ending with a `[Sources]` block.

---

### Task 1: Expand the template frame map and starter deck to 16 slides

**Files:**
- Modify: `tmp/hey-payna-vi/prepare-localization.mjs`
- Regenerate: `tmp/hey-payna-vi/template-frame-map.json`
- Regenerate: `tmp/hey-payna-vi/template-starter.pptx`
- Regenerate: `tmp/hey-payna-vi/template-starter-layout/*.layout.json`

**Interfaces:**
- Consumes: the unchanged English source deck and its 14 inspected source-slide layout files.
- Produces: a 16-slide starter deck in the exact output order required by the design spec.

- [ ] **Step 1: Verify the current frame map has 14 one-to-one entries**

Run:

```bash
jq '.outputSlides | length' tmp/hey-payna-vi/template-frame-map.json
```

Expected: `14`.

- [ ] **Step 2: Replace the one-to-one loop with an explicit source order**

Use this exact array in `prepare-localization.mjs`:

```js
const sourceOrder = [11, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11, 12, 13, 14];
```

Each output slide must read edit targets from its mapped source slide layout. Use narrative roles for welcome, existing product narrative, thank-you/contact, and three backup slides.

- [ ] **Step 3: Regenerate and validate the frame map**

Run:

```bash
/Users/xuanhaj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tmp/hey-payna-vi/prepare-localization.mjs
jq '.outputSlides | length' tmp/hey-payna-vi/template-frame-map.json
jq '[.outputSlides[].sourceSlide]' tmp/hey-payna-vi/template-frame-map.json
```

Expected: length `16` and source order `[11,1,2,3,4,5,6,7,8,9,10,11,11,12,13,14]`.

- [ ] **Step 4: Rebuild the 16-slide template starter**

Run the bundled `prepare_template_starter_deck.mjs` with the existing English source PPTX, the regenerated frame map, `template-starter.pptx`, `template-starter-preview`, and `template-starter-layout`. Do not request the helper contact sheet because the system Python lacks PIL; create contact sheets later with the bundled Python runtime.

Expected: the starter inspect reports 16 slides and `starter-slide-01.layout.json` through `starter-slide-16.layout.json` exist.

### Task 2: Add bookend copy, renumber pages, and build 16 sets of speaker notes

**Files:**
- Modify: `tmp/hey-payna-vi/localize-deck.mjs`

**Interfaces:**
- Consumes: the 16-slide `template-starter.pptx` from Task 1.
- Produces: the localized 16-slide `Hey-Payna-Hackathon-Demo-VI.pptx`, 16 PNG previews, 16 layout exports, and embedded speaker notes.

- [ ] **Step 1: Add the welcome translation at index 0**

Use the inherited source-slide-11 shape names:

```js
{
  "closing-title": "Xin chào\nARC HOUSE Việt Nam!",
  "closing-command-text": "Lecter Vũ · Teddy · anh em ARC HOUSE Việt Nam",
  "closing-brand": "HEY PAYNA",
  "closing-tag": "AI stablecoin copilot · Hackathon product demo",
}
```

- [ ] **Step 2: Insert the thank-you translation at output slide 13**

Use the inherited source-slide-11 shape names:

```js
{
  "closing-title": "Cảm ơn mọi người\nđã lắng nghe.",
  "closing-command-text": "X · @0xWarg__ · x.com/0xWarg__",
  "closing-brand": "HEY PAYNA",
  "closing-tag": "Câu hỏi & góp ý từ ARC HOUSE Việt Nam",
}
```

- [ ] **Step 3: Renumber inherited page-number shapes**

Add these exact translation entries to the existing slide objects:

```text
number-2=03, number-3=04, number-4=05, number-5=06,
number-6=07, number-7=08, number-8=09, number-9=10,
number-10=11, number-12=14, number-13=15, number-14=16
```

- [ ] **Step 4: Expand notes and sources arrays to 16 entries**

Prepend a Vietnamese welcome script with the approved transition. Insert a Vietnamese thank-you script after the existing product closing script. Both new notes must end with source blocks generated by the existing note writer.

Use these source lists:

```js
welcome: ["app/page.tsx", "public/payna-hero-bg.svg", "public/payna-antlers.png"]
thankYou: ["lib/paycmd/ai/quota-contact.ts", "public/payna-hero-bg.svg", "public/payna-antlers.png"]
```

Change the localization length guard from 14 to 16.

- [ ] **Step 5: Generate the PPTX and inspect the five structurally important slides**

Run:

```bash
/Users/xuanhaj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tmp/hey-payna-vi/localize-deck.mjs
```

Inspect slides 1, 2, 12, 13, and 14 at full size to verify the welcome → cover transition, closing → thank-you transition, and thank-you → appendix boundary.

### Task 3: Update standalone notes and usage documentation

**Files:**
- Modify: `output/hey-payna-hackathon/Hey-Payna-Speaker-Notes-VI.md`
- Modify: `output/hey-payna-hackathon/README.md`

**Interfaces:**
- Consumes: the approved 16-slide order and embedded speaker-note scripts.
- Produces: human-readable rehearsal notes and accurate file-usage instructions.

- [ ] **Step 1: Convert the standalone notes file to the 16-slide order**

Add the approved welcome section as slide 1, shift existing slides 1–11 to 2–12, add the approved thank-you section as slide 13, and renumber the three backup sections to 14–16. Change the live-demo references from slide 6 to slide 7.

- [ ] **Step 2: Update README counts and navigation**

Replace every `14 slide` reference with `16 slide`, set the live demo to slide 7, set the thank-you/contact slide to 13, and set backup slides to 14–16. Explain that slide 13 contains the X contact `@0xWarg__`.

- [ ] **Step 3: Verify note headings and X contact**

Run:

```bash
rg -n '^## Slide ' output/hey-payna-hackathon/Hey-Payna-Speaker-Notes-VI.md
rg -n 'Lecter Vũ|Teddy|ARC HOUSE|@0xWarg__|slide 7|14–16|16 slide' output/hey-payna-hackathon/Hey-Payna-Speaker-Notes-VI.md output/hey-payna-hackathon/README.md
```

Expected: exactly 16 slide headings and all personalized/contact details are present.

### Task 4: Render, export PDF, and run final QA

**Files:**
- Regenerate: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pdf`
- Regenerate: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI-montage.png`
- Regenerate: `output/hey-payna-hackathon/slides-vi/slide-1.png` through `slide-16.png`

**Interfaces:**
- Consumes: the final 16-slide Vietnamese PPTX.
- Produces: final PDF/PNG deliverables and fresh structural verification evidence.

- [ ] **Step 1: Run overflow and template-fidelity tests**

Require `slides_test.py` to report no overflow and `check_template_fidelity.mjs` to report `status: pass` with `issueCount: 0`.

- [ ] **Step 2: Render all 16 PPTX slides and inspect each individually**

Use `render_slides.py` to regenerate `slides-vi`. Inspect slide 1 through slide 16 at full size, then create a numerically ordered 4-column montage.

- [ ] **Step 3: Export and visually inspect the PDF**

Use bundled `soffice` to overwrite the PDF, render all pages with bundled `pdftoppm`, and inspect the full PDF contact sheet plus the two new pages at full size.

- [ ] **Step 4: Run structural and content assertions**

Require all of the following:

```text
PPTX slides: 16
rendered PNGs: 16
speaker-note parts: 16
[Sources] blocks: 16
PDF pages: 16
empty structural placeholders: 0
Lecter Vũ occurrence in visible slide XML: at least 1
Teddy occurrence in visible slide XML: at least 1
@0xWarg__ occurrence in visible slide XML: at least 1
English live-demo command visible occurrences: 2
```

- [ ] **Step 5: Run the project test suite**

Run `npm test` and require 126 tests passing with zero failures.

- [ ] **Step 6: Commit only this implementation plan**

Run:

```bash
git add docs/superpowers/plans/2026-08-05-hey-payna-arc-house-bookends.md
git commit -m "docs: plan Arc House deck bookends"
```

Do not stage generated slide binaries unless the user explicitly requests it.
