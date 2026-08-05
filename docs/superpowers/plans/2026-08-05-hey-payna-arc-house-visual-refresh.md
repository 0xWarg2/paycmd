# HEY PAYNA ARC HOUSE Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign trực tiếp deck HEY PAYNA tiếng Việt 16 slide theo phong cách ARC HOUSE × HEY PAYNA, thêm logo Circle/Arc đúng brand guideline và xuất lại đầy đủ PPTX, PDF, ảnh cùng Speaker Notes.

**Architecture:** Giữ deck 16 slide hiện tại làm visual source và chỉnh inherited elements tại chỗ bằng Artifact Tool. Hai raster background 16:9 được tạo riêng cho slide 1/13; logo chính thức Circle và Arc được đặt như asset độc lập trên từng slide để giữ đúng tỷ lệ và clear space. Một script refresh riêng chịu trách nhiệm backup, thay background, thêm header brand rail, bố trí logo/số trang và bảo toàn notes.

**Tech Stack:** JavaScript ESM, `@oai/artifact-tool`, OpenAI ImageGen, SVG/PNG brand assets, LibreOffice, Poppler và presentation QA scripts.

## Global Constraints

- Chỉnh deck `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx` tại chỗ sau khi tạo bản backup.
- Giữ nguyên đúng 16 slide, 16 Speaker Notes, nội dung, live demo script và thứ tự slide.
- HEY PAYNA là product brand chính; Circle và Arc chỉ là infrastructure brands.
- Logo Circle và Arc dùng asset chính thức, không đổi màu, méo tỷ lệ hoặc đặt nổi bật hơn HEY PAYNA.
- Slide 1 và 13 dùng background ARC HOUSE mới; slide 2–12 và 14–16 giữ layout chính hiện tại.
- Không thay đổi deck tiếng Anh hoặc code sản phẩm.
- Mọi slide phải có `[Sources]` trong Speaker Notes.

---

### Task 1: Backup và brand asset provenance

**Files:**
- Create: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI-pre-arc-house.pptx`
- Create: `tmp/hey-payna-arc-house/assets/circle-logo-dark-bg.svg`
- Create: `tmp/hey-payna-arc-house/assets/arc-logo-dark-bg.svg`
- Create: `tmp/hey-payna-arc-house/source-notes.txt`

**Interfaces:**
- Consumes: deck tiếng Việt hiện tại và asset chính thức từ Circle Brand Kit.
- Produces: immutable backup và hai logo asset sẵn sàng đặt lên PowerPoint.

- [ ] **Step 1: Tạo backup không ghi đè**

Run:

```bash
cp -n output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx \
  output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI-pre-arc-house.pptx
```

Expected: hai file có cùng SHA-256 trước khi deck chính được chỉnh.

- [ ] **Step 2: Tải logo chính thức**

Lấy white/dark-background Circle logo và Arc logo mới nhất từ:

```text
https://circle.so/brand-guidelines
https://www.arc.io/brand-guidelines-and-partner-toolkit
```

Expected: hai file SVG mở được, có `viewBox`, không chứa raster data URI và không bị chỉnh màu.

- [ ] **Step 3: Ghi provenance**

Ghi URL nguồn, ngày truy cập `2026-08-05`, tên asset và slide sử dụng vào `tmp/hey-payna-arc-house/source-notes.txt`.

- [ ] **Step 4: Xác minh asset**

Run:

```bash
rg -n '<svg|viewBox' tmp/hey-payna-arc-house/assets/*.svg
```

Expected: cả hai asset đều có SVG root và viewBox hợp lệ.

### Task 2: Tạo hai ARC HOUSE backgrounds

**Files:**
- Create: `tmp/hey-payna-arc-house/assets/arc-house-welcome-bg.png`
- Create: `tmp/hey-payna-arc-house/assets/arc-house-thank-you-bg.png`
- Create: `tmp/hey-payna-arc-house/background-prompts.txt`

**Interfaces:**
- Consumes: visual direction trong design spec.
- Produces: hai raster background 16:9 không có text/logo.

- [ ] **Step 1: Tạo background welcome**

Use ImageGen với prompt yêu cầu graphite architectural interior, subtle emerald/cyan light, abstract arc/grid/house motif, premium Web3 community event, negative space bên trái, không text, không logo, không watermark, 16:9.

- [ ] **Step 2: Tạo background thank-you**

Use ImageGen với cùng material system nhưng composition khác: light/motif lệch phải và dưới, negative space bên trái, không text, không logo, không watermark, 16:9.

- [ ] **Step 3: Lưu prompt và kiểm tra ảnh**

Run:

```bash
identify tmp/hey-payna-arc-house/assets/arc-house-*-bg.png
```

Expected: cả hai ảnh có tỷ lệ gần `1.7778`, không bị crop subject và không chứa chữ giả.

### Task 3: Viết script visual refresh

**Files:**
- Create: `tmp/hey-payna-arc-house/refresh-deck.mjs`
- Create: `tmp/hey-payna-arc-house/package.json`
- Modify: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx`

**Interfaces:**
- Consumes: deck hiện tại, hai background PNG và hai logo SVG.
- Produces: deck 16 slide đã refresh nhưng giữ nguyên notes/content.

- [ ] **Step 1: Import deck và assert invariants**

Script phải import deck hiện tại bằng Artifact Tool và fail nếu `slides.length !== 16` hoặc notes không đủ 16.

- [ ] **Step 2: Thay background slide 1/13**

Tìm full-bleed background element inherited hiện tại, thay image source bằng `arc-house-welcome-bg.png` và `arc-house-thank-you-bg.png`, giữ kích thước `13.333 × 7.5 in` và send to back.

- [ ] **Step 3: Áp dụng brand rail cho 16 slide**

Thêm một header rail mảnh theo hệ màu graphite/mint/cyan, nhưng không che title hoặc section label. Với slide 1/13, rail được rút gọn để giữ cover sạch.

- [ ] **Step 4: Thêm Circle + Arc ở góc phải trên**

Đặt hai logo theo một lockup ngang có khoảng cách cố định, cao tối đa `0.24 in`, right margin `0.48 in`, top margin `0.28 in`. Di chuyển slide number sang trái lockup nếu đang xung đột; HEY PAYNA vẫn lớn hơn cụm logo hạ tầng.

- [ ] **Step 5: Đồng bộ accent theo ngữ nghĩa**

Giữ layout và copy, chỉ cập nhật decorative strokes/accent hợp lý: cyan cho AskPayna/evidence, mint cho Gateway/execution, amber cho finality/approval và coral cho failure/retry.

- [ ] **Step 6: Bổ sung nguồn vào notes**

Mỗi slide thêm Circle/Arc brand guideline URL vào `[Sources]`; slide 1/13 thêm ARC HOUSE Việt Nam URL và prompt record của background.

- [ ] **Step 7: Export và kiểm tra cấu trúc**

Expected: PPTX ghi đè đúng đường dẫn chính, 16 slide, 16 notes và không có placeholder.

### Task 4: Render và visual QA

**Files:**
- Create: `tmp/hey-payna-arc-house/render/slide-01.png` … `slide-16.png`
- Create: `tmp/hey-payna-arc-house/contact-sheet.png`

**Interfaces:**
- Consumes: refreshed PPTX.
- Produces: full-slide renders phục vụ QA.

- [ ] **Step 1: Render 16 slide**

Run:

```bash
python3 /Users/xuanhaj/.codex/plugins/cache/openai-primary-runtime/presentations/26.802.11031/skills/presentations/container_tools/render_slides.py \
  output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx \
  --output_dir tmp/hey-payna-arc-house/render --width 1600 --height 900
```

- [ ] **Step 2: Tạo contact sheet theo thứ tự số**

Tạo montage 4 cột với slide 1–16 theo numeric order.

- [ ] **Step 3: Kiểm tra từng slide full size**

Kiểm tra title wrap, logo clear space, số trang, screenshot sharpness, contrast, slide 1/13 và các slide 6/7/15 có mật độ cao.

- [ ] **Step 4: Sửa mọi lỗi nhìn thấy và render lại**

Expected: không còn logo quá lớn, chạm title, crop background lỗi, hoặc text bị thiếu tương phản.

### Task 5: Xuất bản và verification

**Files:**
- Modify: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pdf`
- Modify: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI-montage.png`
- Modify: `output/hey-payna-hackathon/slides-vi/slide-1.png` … `slide-16.png`
- Modify: `output/hey-payna-hackathon/README.md`

**Interfaces:**
- Consumes: visually approved PPTX.
- Produces: final delivery package.

- [ ] **Step 1: Chạy slide QA**

Run:

```bash
python3 /Users/xuanhaj/.codex/plugins/cache/openai-primary-runtime/presentations/26.802.11031/skills/presentations/container_tools/slides_test.py \
  output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx
```

Expected: `Test passed. No overflow detected.`

- [ ] **Step 2: Chạy fidelity QA**

Run checker với frame map/starter/final layout của deck tiếng Việt.

Expected: `status: pass`, `issueCount: 0`.

- [ ] **Step 3: Xuất PDF và PNG**

Export PDF bằng LibreOffice, render PDF bằng Poppler và tạo montage cuối.

Expected: PPTX, PDF và thư mục ảnh đều có đúng 16 slide/page.

- [ ] **Step 4: Chạy content assertions**

Assert:

```text
slides=16
notes=16
[Sources]=16
PDF pages=16
Lecter Vũ>=1
Teddy>=1
@0xWarg__>=1
demo command=2
```

- [ ] **Step 5: Chạy test dự án**

Run:

```bash
npm test
```

Expected: toàn bộ test pass; nếu có failure không liên quan, báo chính xác thay vì sửa ngoài phạm vi.

- [ ] **Step 6: Cập nhật README**

Ghi rõ deck đã dùng ARC HOUSE visual refresh, vị trí logo hạ tầng, đường dẫn backup và cách dùng PPTX/PDF/notes.
