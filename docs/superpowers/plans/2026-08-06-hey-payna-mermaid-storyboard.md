# HEY PAYNA Mermaid Storyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a Vietnamese, audience-friendly Mermaid storyboard for every slide in the 18-slide HEY PAYNA ARC HOUSE deck.

**Architecture:** Create one standalone Markdown deliverable containing 18 numbered sections and 18 Mermaid flowcharts. Add a focused Node.js verifier that checks slide coverage, Mermaid block counts, required key-slide concepts, webhook accuracy language, and the absence of developer-facing labels.

**Tech Stack:** Markdown, Mermaid flowchart syntax, Node.js assertion script, ripgrep.

## Global Constraints

- Exactly 18 numbered slide sections and exactly 18 Mermaid blocks.
- Diagrams must be audience-facing and use Vietnamese labels with necessary English protocol terms retained.
- Slides 3, 6, 8, 9, and 10 receive the most detailed flows.
- Slides 6, 9, and 16 show webhook-driven status updates.
- Never claim that webhook accelerates blockchain finality; it accelerates Payna's awareness and UI update after Circle confirms.
- Ordinary diagrams use at most six primary nodes; key diagrams may use up to nine.
- Do not expose API routes, database tables, source files, function names, or academic notation.
- The existing PPTX and Google Slides deck remain unchanged.

---

### Task 1: Storyboard contract and red verifier

**Files:**
- Create: `tmp/hey-payna-mermaid/verify-storyboard.mjs`
- Test: `output/hey-payna-hackathon/Hey-Payna-Mermaid-Storyboard-VI.md`

**Interfaces:**
- Consumes: the final Markdown file as `process.argv[2]`.
- Produces: process exit code `0` and a JSON summary when all storyboard requirements pass.

- [ ] **Step 1: Write the verifier before the deliverable exists**

The verifier must assert:

```js
assert.equal(slideHeadings.length, 18);
assert.equal(mermaidBlocks.length, 18);
assert.deepEqual(slideNumbers, Array.from({ length: 18 }, (_, index) => index + 1));
assert.match(slide(3), /Ví|Danh tính|Nguồn tiền|Rail|Finality|Bằng chứng/);
assert.match(slide(6), /Webhook/);
assert.match(slide(6), /Gateway-ready/);
assert.match(slide(8), /1 BurnIntent/);
assert.match(slide(8), /BurnIntentSet ≤ 16/);
assert.match(slide(9), /Preview/);
assert.match(slide(9), /Webhook/);
assert.match(slide(10), /Người dùng thấy/);
assert.match(slide(16), /Không gửi lại/);
assert.match(markdown, /Webhook không làm blockchain đạt finality nhanh hơn/);
assert.doesNotMatch(markdown, /app\/api|route\.ts|Supabase table|function\(|database query/i);
```

- [ ] **Step 2: Run the verifier and confirm the expected red state**

Run:

```bash
node tmp/hey-payna-mermaid/verify-storyboard.mjs output/hey-payna-hackathon/Hey-Payna-Mermaid-Storyboard-VI.md
```

Expected: FAIL because the storyboard file does not exist.

### Task 2: Create the 18-slide Mermaid storyboard

**Files:**
- Create: `output/hey-payna-hackathon/Hey-Payna-Mermaid-Storyboard-VI.md`

**Interfaces:**
- Consumes: the slide narrative in `output/hey-payna-hackathon/Hey-Payna-Speaker-Notes-VI.md` and the approved design spec.
- Produces: 18 slide sections, each with takeaway, Mermaid diagram, presenter callout, and placement recommendation.

- [ ] **Step 1: Add the shared audience and color guidance**

The introduction must state that diagrams are for jury comprehension, not developer documentation, and include the stable color mapping.

- [ ] **Step 2: Write slides 1–5**

Use simple flows for welcome, product promise, six user problems, Ask/Act approval, and evidence-grounded answers. Slide 3 must converge six concerns into the user's overload and the HEY PAYNA simplification.

- [ ] **Step 3: Write slides 6–10**

Implement the approved key flows exactly:

```text
Slide 6: Deposit → Circle finality → Circle confirms → Webhook → Gateway-ready → Pay
Slide 8: one sufficient source → 1 BurnIntent; otherwise explicit Unified choice → allocation preview → BurnIntentSet ≤ 16
Slide 9: command → Preview → Confirm → Gateway → Webhook → Activity → Arc receipt, with no blind retry
Slide 10: user-visible lane above Payna coordination lane
```

- [ ] **Step 4: Write slides 11–14**

Cover approval safety, four-layer product architecture, reusable stablecoin command journey, and the final understand/approve/execute/prove message.

- [ ] **Step 5: Write slides 15–18**

Cover Gateway versus CCTP, webhook/reconciliation demo fallback, current prototype boundaries, and the final thank-you/contact path.

### Task 3: Validate readability and scope

**Files:**
- Modify: `output/hey-payna-hackathon/Hey-Payna-Mermaid-Storyboard-VI.md`
- Test: `tmp/hey-payna-mermaid/verify-storyboard.mjs`

**Interfaces:**
- Consumes: completed storyboard.
- Produces: validated storyboard and audit evidence.

- [ ] **Step 1: Run the structural verifier**

Run:

```bash
node tmp/hey-payna-mermaid/verify-storyboard.mjs output/hey-payna-hackathon/Hey-Payna-Mermaid-Storyboard-VI.md
```

Expected: PASS with `slides: 18`, `mermaidBlocks: 18`, and `webhookSlides: [6, 9, 16]`.

- [ ] **Step 2: Scan for syntax and audience defects**

Run:

```bash
rg -n 'TBD|TODO|app/api|route\.ts|function\(|database|poll every|blockchain finality nhanh hơn' output/hey-payna-hackathon/Hey-Payna-Mermaid-Storyboard-VI.md
```

Expected: no output except the deliberate accuracy sentence containing `Webhook không làm blockchain đạt finality nhanh hơn`.

- [ ] **Step 3: Inspect every Mermaid block manually**

Confirm every diagram has:

- a supported `flowchart LR` or `flowchart TB` declaration;
- unique node identifiers inside its block;
- balanced subgraph/end pairs when subgraphs are used;
- no crossed reading direction;
- short audience-facing labels;
- no more than nine primary nodes.

- [ ] **Step 4: Run final repository checks**

Run:

```bash
git diff --check
npm test
```

Expected: no whitespace errors and all project tests pass.

- [ ] **Step 5: Commit the design and plan documents only**

The output and temporary storyboard artifacts remain local deliverables unless the user explicitly asks to commit them.
