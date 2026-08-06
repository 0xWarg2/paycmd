# Hey Payna Hackathon Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an English 11-slide hackathon demo deck that makes Circle Gateway and AskPayna the two central product pillars, with three backup slides and PPTX/PDF/PNG outputs.

**Architecture:** Build a new 1280×720 presentation with `@oai/artifact-tool` in a temporary workspace. Embed existing Payna brand assets and verified UI snapshots, add editable text and native shapes, attach complete speaker notes and source blocks, then render and visually inspect every slide before exporting final artifacts.

**Tech Stack:** JavaScript ES modules, `@oai/artifact-tool`, bundled presentation renderers, LibreOffice/Poppler for PDF verification, existing Payna PNG/SVG assets.

## Global Constraints

- English, 16:9, 11 core slides plus 3 backup slides.
- Use the Payna dark-cosmic visual system and existing product UI; do not invent metrics, traction, customers, or partner endorsements.
- Titles are at least 35 pt, deck title at least 50 pt, body text at least 16 pt.
- Every slide has presenter notes; every external claim or asset has a `[Sources]` block in its notes.
- Final outputs are `Hey-Payna-Hackathon-Demo.pptx`, `Hey-Payna-Hackathon-Demo.pdf`, individual PNGs, and a montage.

---

### Task 1: Prepare verified assets and source ledger

**Files:**
- Read: `public/brand/antlers_transparent.png`
- Read: `tests/ui/theme.spec.ts-snapshots/landing-desktop-1440-darwin.png`
- Read: `tests/ui/command-center.spec.ts-snapshots/command-center-desktop-1440-darwin.png`
- Create: `tmp/hey-payna-hackathon/source-notes.txt`

**Interfaces:**
- Consumes: local product docs, brand assets, and UI snapshots.
- Produces: an asset map and source ledger used by the deck generator.

- [ ] Inventory the logo, landing, command-center, docs, and login screenshots with absolute paths and intended slide usage.
- [ ] Record the local source files for each product claim, especially `content/payna-tutorial.json`, `docs/10-ra-onchain-proof-contract.md`, and `docs/11-kien-thuc-luong-he-thong-va-test-e2e.md`.
- [ ] Confirm all selected raster assets are readable and large enough for their intended crop.

### Task 2: Build the editable presentation

**Files:**
- Create: `tmp/hey-payna-hackathon/build-deck.mjs`
- Create: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo.pptx`

**Interfaces:**
- Consumes: Task 1 asset map and the approved design spec.
- Produces: a 14-slide editable presentation with stable object names and speaker notes.

- [ ] Initialize the artifact-tool workspace with `setup_artifact_tool_workspace.mjs`.
- [ ] Implement shared theme helpers for background, typography, section labels, progress marks, screenshots, and notes.
- [ ] Build slides 1–5 with the exact titles and visible copy in the design spec, making AskPayna and Circle Gateway the principal visual anchors.
- [ ] Build slide 6 as a minimal live-demo hold slide with the exact Base-to-Arc payment command and five checkpoints.
- [ ] Build slides 7–11 with the exact titles and claims in the design spec.
- [ ] Build the three backup slides for rail comparison, demo recovery, and current boundaries.
- [ ] Add presenter notes with pacing, what to say, transitions, demo instructions, and source blocks.
- [ ] Export the PPTX and slide PNGs from the same presentation object.

### Task 3: Render, inspect, and revise

**Files:**
- Create: `tmp/hey-payna-hackathon/rendered/`
- Create: `tmp/hey-payna-hackathon/qa-ledger.txt`

**Interfaces:**
- Consumes: the Task 2 PPTX.
- Produces: an overlap-free and visually verified final deck.

- [ ] Render every slide at full size and create a montage.
- [ ] Inspect all 14 full-size slide images for wrapping, clipping, low-resolution crops, inconsistent margins, and unintended overlap.
- [ ] Run `slides_test.py` against the PPTX and fix every overflow or overlap warning that is not deliberately validated.
- [ ] Re-render revised slides and record the final QA result in the ledger.

### Task 4: Export and verify the handoff package

**Files:**
- Create: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo.pdf`
- Create: `output/hey-payna-hackathon/slides/slide-01.png` through `slide-14.png`
- Create: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Montage.webp`

**Interfaces:**
- Consumes: the final verified PPTX.
- Produces: the complete user-facing presentation package.

- [ ] Convert the verified PPTX to PDF and render the PDF to confirm page count and visual fidelity.
- [ ] Copy only final slide PNGs and the montage into the output directory.
- [ ] Confirm that PPTX, PDF, 14 PNGs, and montage exist and are non-empty.
- [ ] Open the final montage for a last narrative and consistency check.
