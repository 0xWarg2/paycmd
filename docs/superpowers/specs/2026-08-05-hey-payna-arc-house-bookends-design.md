# HEY PAYNA ARC HOUSE Việt Nam Bookend Slides Design

## Goal

Personalize the Vietnamese HEY PAYNA hackathon deck for ARC HOUSE Việt Nam with a dedicated welcome slide and a dedicated thank-you/contact slide, without weakening the existing product narrative.

## Audience

The primary audience is Lecter Vũ, Teddy, and the wider ARC HOUSE Việt Nam community attending the product presentation.

## Deck Structure

The deck expands from 14 to 16 slides:

1. New ARC HOUSE Việt Nam welcome slide.
2. Existing HEY PAYNA product cover.
3–11. Existing problem, product, AskPayna, Circle Gateway, demo, flow, safety, architecture, and differentiation slides.
12. Existing product synthesis/closing slide.
13. New thank-you and X contact slide.
14–16. Existing backup slides.

Visible page numbers are updated to match the new physical slide positions. The two bookend slides and the two visual cover/closing slides remain unnumbered.

## Visual Design

Both new slides duplicate the existing slide 11 closing frame. This creates a consistent bookend treatment while avoiding an immediate repetition of the existing cover frame.

No new visual primitives, generated logos, portraits, or unverified ARC HOUSE assets are introduced. The existing authentic HEY PAYNA background, antler mark, phone illustration, typography, colors, and spacing are preserved exactly.

## Slide 1 — Welcome

Visible copy:

- Main title: `Xin chào\nARC HOUSE Việt Nam!`
- Highlight bar: `Lecter Vũ · Teddy · anh em ARC HOUSE Việt Nam`
- Brand: `HEY PAYNA`
- Tag: `AI stablecoin copilot · Hackathon product demo`

Speaker notes:

> Xin chào Lecter Vũ, Teddy và toàn thể anh em tại ARC HOUSE Việt Nam. Mình rất vui được có mặt ở đây để chia sẻ HEY PAYNA — một AI stablecoin copilot giúp việc tìm hiểu và thanh toán USDC xuyên chuỗi trở nên đơn giản nhưng vẫn an toàn.

Transition:

> Đầu tiên, hãy bắt đầu bằng trải nghiệm mà chúng mình muốn tạo ra.

## Slide 13 — Thank You and Contact

Visible copy:

- Main title: `Cảm ơn mọi người\nđã lắng nghe.`
- Highlight bar: `X · @0xWarg__ · x.com/0xWarg__`
- Brand: `HEY PAYNA`
- Tag: `Câu hỏi & góp ý từ ARC HOUSE Việt Nam`

The displayed X URL is `https://x.com/0xWarg__`, matching the existing product contact configuration.

Speaker notes:

> Cảm ơn Lecter Vũ, Teddy và toàn thể anh em ARC HOUSE Việt Nam đã lắng nghe. Mình rất mong nhận được câu hỏi, góp ý và những góc nhìn thực tế từ mọi người. Mọi người cũng có thể kết nối với HEY PAYNA qua X tại @0xWarg__.

Presenter behavior:

- Stop on this slide for questions.
- Advance to slides 14–16 only when a backup topic or demo recovery explanation is needed.

## Existing Content

- Preserve all existing Vietnamese narrative copy and approved English technical terms.
- Preserve the exact live-demo command `Pay 1 USDC to Minh on Arc from Base.`
- Preserve the existing English source deck as a separate artifact.
- Update the standalone Vietnamese speaker-notes file to a 16-slide structure.

## Sources

- Existing HEY PAYNA visual source: `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo.pptx`
- X contact configuration: `lib/paycmd/ai/quota-contact.ts`
- Existing product imagery: `public/payna-hero-bg.svg` and `public/payna-antlers.png`

## Acceptance Criteria

- The Vietnamese deck contains exactly 16 slides.
- Slide 1 names Lecter Vũ, Teddy, and the ARC HOUSE Việt Nam community.
- Slide 13 displays `@0xWarg__` and `x.com/0xWarg__`.
- Every slide has Vietnamese speaker notes with a `[Sources]` block.
- The PDF contains exactly 16 pages.
- All 16 slides render without overflow, unintended overlap, empty structural placeholders, or template-fidelity issues.
- The English 14-slide source deck remains unchanged.
