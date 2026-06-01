## Theo Dõi Ứng Dụng Ai Trong Sprint (Từ 22/02 Đến Nay)

Trong giai đoạn này, AI được ứng dụng sâu rộng để hoàn thiện tính năng **"Xác thực ví và Hệ thống xử lý lỗi tập trung"**. Các tác vụ cụ thể bao gồm:

#### 1. Tái cấu trúc luồng giao diện kết nối ví (Ngày 22/02)

- **Ngữ cảnh:** Hệ thống gặp lỗi giao diện khi nhiều thành phần (component) nút bấm xác thực ví cùng tồn tại, dẫn đến việc kích hoạt nhiều Modal chồng chéo.
- **Hành động:** Sử dụng AI Agent để di chuyển toàn bộ logic quản lý trạng thái Modal vào một `SolanaProvider` trung tâm.
- **Kết quả:** Đóng gói thành công logic hiển thị, giúp các nút bấm chỉ cần gọi hàm qua context, đảm bảo tính nhất quán và hiệu năng của UI.

#### 2. Chuẩn hóa hệ thống Error Handling (Ngày 27/02 - 28/02)

- **Ngữ cảnh:** Cần thiết lập cơ chế phản hồi lỗi chuyên nghiệp từ Backend về Frontend để người dùng dễ dàng nắm bắt sự cố.
- **Hành động:** \* Yêu cầu AI rà soát và chuyển đổi toàn bộ định dạng thông báo lỗi sang chuẩn `SCREAMING_SNAKE_CASE` (ví dụ: `WALLET_NOT_CONNECTED`, `INSUFFICIENT_FUNDS`).
- Tư vấn cách tích hợp mã lỗi RPC từ thư viện Solana và lỗi từ Google Auth vào một luồng xử lý ngoại lệ duy nhất.

- **Kết quả:** Mã nguồn Frontend trở nên sạch sẽ hơn, chỉ cần một bộ lọc (filter) duy nhất để hiển thị thông báo lỗi tương ứng với mã lỗi nhận được.

#### 3. Mở rộng Localization và Tối ưu hóa UI (Ngày 01/03)

- **Ngữ cảnh:** Cải thiện trải nghiệm đa ngôn ngữ và tính trực quan của dữ liệu thị trường.
- **Hành động:** \* Sử dụng AI để xây dựng hàm giả lập (mock function) hỗ trợ tỷ giá hối đoái USD/VND, tích hợp vào bộ định dạng tiền tệ của hệ thống.
- Thực hiện chuyển đổi hiển thị thông số mã thông báo (Token Stats) từ bảng tĩnh sang dạng `StructuredList` của bộ thư viện Carbon Design.

- **Kết quả:** Giao diện đạt chuẩn thiết kế chuyên nghiệp mà không tốn nhiều thời gian điều chỉnh CSS thủ công.

## Minh Chứng Về Việc Sử Dụng Agentic Ai (Vscode Agent Mode)

Khác với việc chỉ Chat đơn thuần, em đã tận dụng **Agent mode** để AI tự động thực thi các thay đổi phức tạp trên toàn bộ Workspace:

- **Ví dụ về Tối ưu hóa cấu trúc dữ liệu:** Em hướng dẫn Agent tái cấu trúc hàm `getTokenMarketData`. Từ việc trả về một mảng dữ liệu thô, Agent đã tự động cập nhật logic ở các file liên quan để chuyển sang dạng **Lookup Record (Map)** theo địa chỉ ví. Việc này giúp tốc độ truy xuất dữ liệu ở Frontend đạt độ phức tạp O(1).
- **Ví dụ về Chẩn đoán lỗi logic sâu:** Khi trang tổng quan mã thông báo bị treo do vòng lặp fetch dữ liệu vô tận (recursive fetching), Agent đã phân tích các Hook trong tệp `index.tsx` và phát hiện việc phụ thuộc vòng (circular dependency) giữa dữ liệu meta và dữ liệu thị trường, từ đó đề xuất cách tách rời logic để sửa lỗi.
- **Ví dụ về Đảm bảo tính an toàn kiểu (Type-safety):** Agent hỗ trợ sửa đổi các định nghĩa `overloads` cho hàm dịch thuật, giúp trình biên dịch TypeScript có thể báo lỗi ngay lập tức nếu em truyền thiếu tham số vào chuỗi văn bản, tránh lỗi hiển thị khi ứng dụng vận hành.
