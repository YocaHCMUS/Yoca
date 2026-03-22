## Công cụ và chi phí:

- Công cụ: GitHub Copilot (gồm cả bản Chat và Agent mode)
- Chi phí: Miễn phí cho sinh viên
- Model chính: GPT-4 cho inline edit, Claude Sonnet 4.5, 4.6 cho chat và agent mode
- Đang dùng AI ở mức độ trợ lý thực thi, em vẫn nắm quyền kiểm soát chính về logic và cấu trúc hệ thống, còn AI sẽ hỗ trợ:
  - Viết các đoạn code mẫu (boilerplate)
  - Sửa lỗi TypeScript nhanh
  - Refactor giao diện dựa trên các component đã có sẵn

  Ví dụ: Thay vì ngồi tự gõ từng field cho các hàm format địa chỉ ví hay viết JSDoc cho các hàm SQL helper, em sẽ đưa logic mình đã viết cho AI để nó tự động hóa phần văn bản hoặc định dạng lại cho chuẩn.

## Track AI usage cho feature "Xác thực ví và Hệ thống xử lý lỗi" (từ 22/2 đến nay):

Dã dùng AI xuyên suốt cho hai tác vụ chính:

- Tác vụ 1: Refactor luồng giao diện kết nối ví (22/2):
  - Phát hiện lỗi khi có nhiều nút bấm xác thực ví sẽ hiện nhiều Modal chồng chéo => Yêu cầu AI giúp di chuyển toàn bộ logic quản lý Modal vào một `SolanaProvider` trung tâm.
- Tác vụ 2: Chuẩn hóa hệ thống Error Handling (27/2 - 28/2): Thiết kế lại cách backend trả lỗi về frontend:
  - Dùng AI để rà soát và chuyển đổi toàn bộ format thông báo lỗi sang dạng SCREAMING_SNAKE_CASE
  - Nhờ AI tư vấn cách tích hợp thêm các mã lỗi RPC từ ví và lỗi từ Google Auth vào chung một luồng xử lý lỗi tập trung để làm sạch code frontend.

- Tác vụ 3: Mở rộng Localization và UI (1/3):
  - Dùng AI để viết nhanh một hàm mock hỗ trợ tỷ giá hối đoái (USD sang VND) ngay trong tool định dạng số.
  - Nhờ AI chuyển đổi phần hiển thị thống kê Token từ dạng bảng thủ công sang `StructuredList` của Carbon Design để giao diện chuyên nghiệp hơn mà không cần SCSS phức tạp.

## Hỗ trợ kỹ thuật và học thuật tổng quát

Bên cạnh các tác vụ thực thi, em dùng chatGPT để hỗ trợ trong việc giải quyết các vấn đề nền tảng:

- TypeScript & Type-safety: dùng AI để thảo luận về cách dùng Interface, Type Alias hay Generics sao cho đảm bảo tính an toàn của mã nguồn. Ví dụ như cách dùng Type Narrowing khi lọc dữ liệu từ API hoặc xử lý các trường hợp dữ liệu bị null/undefined.

- Xử lý API & Backend: AI hỗ trợ phân tích cấu trúc JSON từ các nguồn dữ liệu bên ngoài hệ sinh thái Solana, từ đó xây dựng các schema để validate dữ liệu bằng thư viện Zod trước khi lưu vào database.

- Kiến trúc RESTful API: dùng AI như một nguồn tham khảo để so sánh các cách đặt tên endpoint, tổ chức pagination và lọc dữ liệu theo đúng chuẩn thực hành phổ biến.

- Quản lý môi trường & Git: AI giúp em xử lý các tình huống khi Git rebase bị lỗi, xung đột mã nguồn hoặc giải quyết các vấn đề về cổng mạng (port) trên hệ điều hành.
