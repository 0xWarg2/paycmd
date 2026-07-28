# ADR-008: Brand Ra Không Khóa Vào USDC

Ra thay thế PayCMD làm tên brand public. Tên mới ngắn, gợi hình tượng thần mặt trời, và vẫn đủ rộng để sản phẩm không bị khóa vào một stablecoin hay một kiểu lệnh cụ thể.

V1 vẫn dùng USDC vì Circle Gateway và Unified Balance mạnh nhất cho demo. Namespace kỹ thuật `paycmd` được giữ lại trong code, env, cookie, migration và prompt cache để giảm rủi ro đổi tên khi sản phẩm vẫn đang phát triển nhanh.
