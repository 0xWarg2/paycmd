# HEY PAYNA — ARC HOUSE Visual Refresh Design

## Mục tiêu

Nâng cấp trực tiếp deck tiếng Việt 16 slide hiện tại thành một bản hackathon demo chuyên nghiệp mang không khí ARC HOUSE Việt Nam, đồng thời giữ HEY PAYNA là thương hiệu sản phẩm chính và Circle/Arc là lớp hạ tầng.

## Phạm vi

- Chỉnh deck `output/hey-payna-hackathon/Hey-Payna-Hackathon-Demo-VI.pptx` tại chỗ sau khi tạo bản backup.
- Giữ nguyên 16 slide, thứ tự nội dung, Speaker Notes, live demo script và các slide backup.
- Thêm logo Circle và Arc chính thức ở góc phải trên của từng slide.
- Tạo background ARC HOUSE riêng cho slide 1 và slide 13.
- Đồng bộ lại màu sắc, đường nét trang trí và hierarchy trên toàn deck.
- Xuất lại PPTX, PDF, montage và ảnh từng slide.

## Visual direction đã duyệt

Hướng thiết kế: **ARC HOUSE × HEY PAYNA**.

- Nền chính: graphite gần đen, có chiều sâu nhưng không đen phẳng.
- Màu HEY PAYNA: emerald/mint giữ vai trò primary accent.
- Màu hạ tầng: cyan/electric blue dùng có kiểm soát cho Circle/Arc và các rail kỹ thuật.
- Màu cảnh báo: amber và coral chỉ dùng cho trạng thái finality, risk hoặc retry.
- Họa tiết: đường arc mảnh, grid kiến trúc, quầng sáng nhẹ và motif “house/network” trừu tượng.
- Không dùng hiệu ứng neon quá mạnh, không biến deck thành poster game, không làm giảm độ đọc.

## Brand hierarchy

1. HEY PAYNA là product brand chính.
2. ARC HOUSE Việt Nam là bối cảnh cộng đồng và host của phần trình bày.
3. Circle và Arc là technology/infrastructure brands.

Logo Circle và Arc phải dùng asset chính thức, giữ nguyên tỷ lệ, không đổi màu tùy ý và có clear space. Cụm logo hạ tầng ở góc phải trên phải nhỏ, nhất quán và không cạnh tranh với tiêu đề hoặc HEY PAYNA.

## Bố cục toàn deck

### Slide 1 — Welcome

- Full-bleed ARC HOUSE background.
- Giữ lời chào Lecter Vũ, Teddy và anh em ARC HOUSE Việt Nam.
- HEY PAYNA nổi bật hơn logo hạ tầng.
- Cảm giác: community welcome, premium Web3 event, không giống slide corporate mặc định.

### Slide 2–12 — Main story

- Giữ cấu trúc và nội dung hiện có.
- Thêm header brand rail mảnh và cụm logo Circle + Arc ở góc phải trên.
- Dùng accent theo ngữ nghĩa: cyan cho AskPayna/evidence, mint cho execution/Gateway, amber cho approval/finality.
- Các screenshot giữ nguyên tỷ lệ và ưu tiên độ rõ.

### Slide 13 — Thank you

- Full-bleed ARC HOUSE background cùng hệ với slide 1 nhưng có bố cục khác.
- Giữ X `@0xWarg__`, lời cảm ơn và lời mời góp ý từ ARC HOUSE Việt Nam.
- Tạo cảm giác kết thúc rõ ràng, đủ khoảng trống để dừng và nhận câu hỏi.

### Slide 14–16 — Backup

- Giữ visual system chung, logo hạ tầng và số trang.
- Không làm backup nổi bật hơn phần main story.

## Background ARC HOUSE

Background được tạo dưới dạng raster 16:9 để đảm bảo chất lượng ổn định trong PowerPoint. Thiết kế không chứa text hoặc logo được AI tái tạo; logo chính thức được đặt riêng trong PPTX để tránh sai hình dạng và đảm bảo khả năng cập nhật.

Hai background dùng cùng vật liệu thị giác nhưng khác composition:

- Welcome: vùng sáng chính lệch phải, có negative space bên trái cho lời chào.
- Thank you: vùng sáng và motif lệch phải/dưới, có negative space bên trái cho lời cảm ơn và X.

## Speaker Notes và nguồn

- Giữ nguyên lời script tiếng Việt hiện tại.
- Bổ sung nguồn asset Circle/Arc vào `[Sources]` của từng slide.
- Bổ sung nguồn ARC HOUSE Việt Nam và brand guideline vào slide 1/13.
- Không đưa URL hoặc nội dung sourcing lên canvas.

## An toàn và khả năng hoàn tác

- Tạo bản backup có timestamp trước khi ghi đè PPTX hiện tại.
- Chỉ chỉnh deck tiếng Việt; deck tiếng Anh không thay đổi.
- Không chạm vào code sản phẩm hoặc các thay đổi không liên quan trong working tree.

## Tiêu chí hoàn thành

- PPTX có đúng 16 slide và 16 Speaker Notes.
- Logo Circle + Arc xuất hiện đúng vị trí trên cả 16 slide.
- Slide 1 và 13 dùng background ARC HOUSE mới.
- Không có overflow, clipping, logo méo, logo quá lớn hoặc text bị giảm độ tương phản.
- Fidelity/template QA không có issue.
- PDF có đúng 16 trang và khớp với PPTX.
- Montage cho thấy hệ màu, header và brand hierarchy nhất quán.

## Nguồn thương hiệu

- Circle Brand Guidelines: https://circle.so/brand-guidelines
- Arc Partner Guidelines: https://www.arc.io/brand-guidelines-and-partner-toolkit
- ARC HOUSE Việt Nam: https://community.arc.io/public/clubs/vietnam
