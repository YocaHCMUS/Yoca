**Báo cáo chi tiết về việc sử dụng AI trong quá trình thực hiện đồ án phân tích dữ liệu On-chain Solana**

Trong quá trình thực hiện đồ án phân tích dữ liệu on-chain trên hệ sinh thái Solana, tôi có sử dụng các công cụ AI như một nguồn hỗ trợ học thuật và kỹ thuật. AI được sử dụng chủ yếu dưới dạng hệ thống hỏi–đáp để giải thích khái niệm, kiểm tra các cách triển khai, phân tích lỗi lập trình, và tham khảo các thực hành phổ biến trong phát triển phần mềm. AI không được sử dụng để tự động viết toàn bộ hệ thống hoặc thay thế quá trình thiết kế của đồ án.

Việc sử dụng AI diễn ra xuyên suốt nhiều giai đoạn của dự án, từ giai đoạn thiết kế kiến trúc dữ liệu, triển khai backend, xử lý dữ liệu API, đến xây dựng giao diện hiển thị. Dưới đây là các nhóm nội dung chính mà AI được sử dụng để hỗ trợ.

---

**1. Tham khảo các thực hành lập trình trong TypeScript**

Phần backend và phần xử lý dữ liệu của đồ án được viết chủ yếu bằng TypeScript. AI được sử dụng để tìm hiểu các cách triển khai đảm bảo tính type-safety và khả năng bảo trì của mã nguồn.

Một số nội dung cụ thể đã trao đổi gồm:

- Cách sử dụng **interface** và **type alias** trong TypeScript, cũng như sự khác nhau giữa hai khái niệm này.
- Việc sử dụng **Generics** để tạo các cấu trúc dữ liệu tổng quát nhưng vẫn giữ được type-safety.
- Cách TypeScript thực hiện **type narrowing** khi sử dụng các hàm như `filter()` hoặc các điều kiện logic.
- Cách xử lý các trường hợp dữ liệu API có thể là `null` hoặc `undefined`.
- Cách tổ chức các **data transfer types** khi làm việc với API response.

Ví dụ một trường hợp cụ thể là khi lọc dữ liệu từ một API response:

```ts
const tokens = res.included.filter((raw) => raw.type == "token");
```

AI được sử dụng để giải thích tại sao TypeScript có thể suy luận rằng `raw` trong mảng kết quả chỉ còn kiểu `"token"`, và cách cơ chế **type narrowing** hoạt động trong trường hợp này.

Trong một trường hợp khác, tôi cần chuyển đổi dữ liệu từ API sang dạng dữ liệu dùng để insert vào database:

```ts
const topTokenInsert = solanaRes
  .filter((raw) => cgIdToAddress[raw.id!])
  .map((raw, index) => ({
    address: cgIdToAddress[raw.id!],
    rank: index + 1,
  }));
```

AI được sử dụng để kiểm tra xem cách viết này có đảm bảo type-safety hay không, và liệu việc sử dụng `!` (non-null assertion) có phải là thực hành phù hợp.

---

**2. Xử lý và chuẩn hóa dữ liệu từ API**

Đồ án sử dụng nhiều nguồn dữ liệu API từ các dịch vụ bên ngoài để thu thập thông tin token, market data và các chỉ số liên quan đến hệ sinh thái Solana. AI được sử dụng để hỗ trợ:

- Phân tích cấu trúc JSON trả về từ API.
- Xây dựng schema để validate dữ liệu.
- Thiết kế các kiểu dữ liệu TypeScript tương ứng với API response.
- Chuẩn hóa dữ liệu trước khi lưu vào database.

Ví dụ, khi làm việc với dữ liệu market của token, tôi phải mở rộng kiểu dữ liệu trả về từ API để thêm một số trường:

```ts
export interface CG_CoinMarkets extends MarketGetResponse[number] {
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_24h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
}
```

AI được sử dụng để xác nhận rằng việc mở rộng interface từ một phần tử của mảng response (`MarketGetResponse[number]`) là hợp lệ trong TypeScript.

Ngoài ra, AI cũng được dùng để thảo luận cách xây dựng **schema validation** bằng các thư viện như Zod để đảm bảo dữ liệu nhận được từ API có đúng định dạng trước khi xử lý.

---

**3. Thiết kế RESTful APIs**

Trong phần backend của hệ thống, AI được dùng để tham khảo các quy ước thiết kế RESTful API.

Các nội dung trao đổi gồm:

- Cách đặt tên endpoint theo resource.
- Cách phân chia các route API cho dữ liệu token, market, và các chỉ số on-chain.
- Cách thiết kế response structure để dễ sử dụng cho frontend.
- Cách tổ chức dữ liệu pagination và filtering.

AI đóng vai trò như một nguồn tham khảo để so sánh với các chuẩn REST phổ biến.

---

**4. Hỗ trợ phân tích lỗi lập trình**

Trong quá trình phát triển hệ thống, AI được sử dụng để phân tích các lỗi TypeScript và hành vi của JavaScript.

Một số ví dụ cụ thể gồm:

- Tại sao TypeScript không cho phép dùng `string` bất kỳ để index vào một object nếu object đó không có index signature.
- Khi ép kiểu một object sang `any`, việc truy cập vào một key không tồn tại sẽ trả về `undefined`.
- Sự khác nhau giữa kiểm tra `null`, `undefined`, và các **falsy values** trong JavaScript.
- Cách hoạt động của **object lookup** trong TypeScript.

Những trao đổi này giúp hiểu rõ hơn cách TypeScript kiểm tra kiểu dữ liệu trong compile-time.

---

**5. Giải thích thuật ngữ và khái niệm kỹ thuật**

Trong quá trình đọc tài liệu kỹ thuật, AI được sử dụng để giải thích nhiều thuật ngữ chuyên ngành, bao gồm:

- Các khái niệm trong lập trình như **generics**, **type inference**, **type narrowing**, **schema validation**, và **data transformation**.
- Các thuật ngữ liên quan đến blockchain và hệ sinh thái Solana.
- Các khái niệm về cấu trúc dữ liệu của token và market data.

Ví dụ, khi gặp khái niệm generics trong nhiều ngôn ngữ lập trình, AI được dùng để so sánh việc hỗ trợ generics trong các ngôn ngữ khác nhau và cách TypeScript triển khai tính năng này.

---

**6. Hỗ trợ frontend với React**

Phần giao diện của hệ thống được xây dựng bằng React. AI được sử dụng để tham khảo:

- Cách tổ chức component trong một ứng dụng React.
- Cách xử lý dữ liệu bất đồng bộ từ API.
- Cách quản lý state khi hiển thị dữ liệu market hoặc token.

Ngoài ra, AI cũng được dùng để giải thích một số hành vi của CSS layout, ví dụ như cách `inline-grid` và `justify-content` ảnh hưởng đến kích thước của phần tử con.

---

**7. Hỗ trợ công cụ phát triển và môi trường làm việc**

AI cũng được sử dụng để giải quyết các vấn đề liên quan đến môi trường phát triển phần mềm.

Một số ví dụ gồm:

- Cách sử dụng Visual Studio Code để quản lý workspace.
- Cách chuyển sang một branch Git mới khi đang có thay đổi chưa commit.
- Cách kiểm tra process đang sử dụng một cổng mạng trên Linux.
- Cách cài đặt và gỡ bỏ các desktop environment trên hệ điều hành Fedora.

Những nội dung này giúp tối ưu hóa quá trình phát triển và quản lý dự án.

---

**8. Vai trò của AI trong dự án**

Trong toàn bộ quá trình thực hiện đồ án, AI đóng vai trò là một **công cụ hỗ trợ tri thức và tham khảo kỹ thuật**. AI được sử dụng để:

- Giải thích khái niệm kỹ thuật.
- Phân tích lỗi lập trình.
- So sánh các cách triển khai.
- Xác nhận các thực hành phổ biến trong phát triển phần mềm.

Các quyết định thiết kế hệ thống, triển khai thuật toán phân tích dữ liệu on-chain, và xây dựng kiến trúc dự án đều do tôi tự thực hiện dựa trên việc nghiên cứu tài liệu kỹ thuật và thử nghiệm thực tế.

---

**Kết luận**

Việc sử dụng AI trong đồ án chủ yếu nhằm hỗ trợ học tập và nâng cao hiệu quả phát triển phần mềm. AI giúp rút ngắn thời gian tra cứu tài liệu, làm rõ các khái niệm kỹ thuật phức tạp, và hỗ trợ phân tích các vấn đề lập trình phát sinh trong quá trình phát triển hệ thống phân tích dữ liệu on-chain trên Solana.
