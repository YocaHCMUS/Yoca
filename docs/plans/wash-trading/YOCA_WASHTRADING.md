# BỔ SUNG THỰC NGHIỆM MÔ-ĐUN WASH TRADING

> Các công thức trong tài liệu này dùng dạng văn bản thuần để hiển thị đúng trên mọi trình đọc Markdown.  
> Phiên bản hiện tại sử dụng **heuristic GNN-inspired**, không phải mô hình GCN/GAT/GraphSAGE đã được huấn luyện.

## 1. Công thức chính xác của từng đặc trưng

Ký hiệu:

- `clip(x) = min(1, max(0, x))`
- `inDegree(w)`: số giao dịch đi vào ví `w`
- `outDegree(w)`: số giao dịch đi ra khỏi ví `w`
- `volume(w)`: tổng lượng token của các giao dịch liên quan đến ví `w`

### 1.1. Tham gia chu trình

```text
circularPattern(w) = 0.94 nếu ví w thuộc ít nhất một chu trình
circularPattern(w) = 0    nếu ngược lại
```

### 1.2. Khoảng cách thời gian ngắn

Sắp xếp thời điểm giao dịch của ví theo thứ tự tăng dần và tính khoảng cách liên tiếp.

```text
averageIntervalMs = tổng các khoảng thời gian / số khoảng thời gian

timeScore(w) = clip(1 - averageIntervalMs / 900000)
```

`900000 ms = 15 phút`.

Điểm cao nghĩa là các giao dịch xảy ra gần nhau. Công thức hiện tại chưa đo độ đều đặn bằng phương sai.

### 1.3. Độ tương đồng lượng token

```text
meanAmount = tổng amount / số giao dịch

standardDeviation =
sqrt(tổng((amount - meanAmount)^2) / số giao dịch)

coefficientOfVariation = standardDeviation / meanAmount

amountSimilarity(w) = clip(1 - coefficientOfVariation)
```

Điểm càng gần `1` thì lượng token của các giao dịch càng giống nhau.

### 1.4. Self-loop

```text
selfLoop(w) = 0.85 nếu tồn tại giao dịch w -> w
selfLoop(w) = 0    nếu không có
```

### 1.5. Hubness

```text
degree(w) = inDegree(w) + outDegree(w)

hubness(w) = min(1, degree(w) / maxDegreeTrongĐồThị)
```

Điểm cao nghĩa là ví có nhiều kết nối tương đối so với các ví khác.

### 1.6. Khối lượng tương đối

```text
relativeVolume(w) =
min(1, volume(w) / maxVolumeTrongĐồThị)
```

Đây là khối lượng tương đối trong tập đang phân tích, không phải bất thường thống kê.

### 1.7. Điểm rủi ro của ví

```text
walletScore =
min(0.97,
    circularPattern * wc +
    timeScore        * wt +
    amountSimilarity * wa +
    selfLoop         * ws +
    hubness          * wh +
    relativeVolume   * wv
)
```

## 2. Đơn vị đầu vào

| Trường | Ý nghĩa | Đơn vị |
|---|---|---|
| `from`, `to` | Ví gửi và ví nhận | Địa chỉ ví Solana |
| `amount` | Lượng token đã quy đổi theo decimals | Token, không phải USD/VND |
| `timestamp` | Thời điểm giao dịch | Unix timestamp, giây |
| `mint` | Token đang phân tích | Địa chỉ mint |
| `signature` | Mã giao dịch | Chuỗi định danh |

Không được hiển thị `amount` bằng `$` hoặc `₫` nếu chưa nhân với giá token tại thời điểm giao dịch.

## 3. Lý do chọn trọng số

| Đặc trưng | GCN-inspired | GAT-inspired | GraphSAGE-inspired |
|---|---:|---:|---:|
| Circular pattern | 0.32 | 0.36 | 0.24 |
| Time score | 0.21 | 0.17 | 0.18 |
| Amount similarity | 0.21 | 0.27 | 0.17 |
| Self-loop | 0.06 | 0.05 | 0.06 |
| Hubness | 0.14 | 0.10 | 0.25 |
| Relative volume | 0.06 | 0.05 | 0.10 |
| **Tổng** | **1.00** | **1.00** | **1.00** |

- **GCN-inspired:** phân bổ tương đối cân bằng, ưu tiên chu trình.
- **GAT-inspired:** nhấn mạnh chu trình và sự giống nhau về lượng token.
- **GraphSAGE-inspired:** nhấn mạnh cấu trúc lân cận, hubness và khối lượng.

Các trọng số trên là giả thuyết thiết kế do nhóm lựa chọn, không phải trọng số được học từ dữ liệu và chưa được chứng minh là tối ưu.

## 4. Lý do chọn ngưỡng rủi ro

### 4.1. Ngưỡng của ví

| Điểm | Mức |
|---:|---|
| `score >= 0.72` | High |
| `0.45 <= score < 0.72` | Medium |
| `score < 0.45` | Low |


Ví có `score < 0.22` và không thuộc chu trình sẽ bị loại khỏi danh sách nghi vấn.

### 4.2. Ngưỡng của token

| Điểm token | Kết luận |
|---:|---|
| `>= 75` | HIGH_RISK |
| `45–74` | MEDIUM_RISK |
| `20–44` | LOW_RISK |
| `< 20` | CLEAN |

Các ngưỡng này được dùng để phân tầng hiển thị ban đầu. Do chưa có dữ liệu gán nhãn, nhóm chưa thể khẳng định đây là các ngưỡng tối ưu.

## 5. Ví dụ tính tay từ giao dịch đến điểm cuối

Giả sử có các giao dịch:

| ID | Thời điểm (giây) | From | To | Amount |
|---|---:|---|---|---:|
| T1 | 0 | A | B | 100 |
| T2 | 60 | B | C | 102 |
| T3 | 120 | C | A | 98 |
| T4 | 180 | A | D | 100 |
| T5 | 240 | D | A | 101 |
| T6 | 300 | A | E | 99 |

Ba giao dịch đầu tạo chu trình:

```text
A -> B -> C -> A
```

Sai lệch lượng token khi đóng vòng:

```text
amountDifference = abs(98 - 100) / 100 = 0.02 = 2%
```

Do `2% < 12%`, chu trình được chấp nhận.

Đối với ví A:

```text
circularPattern = 0.94
timeScore        = 1 - 75000 / 900000 = 0.9167
amountSimilarity ≈ 0.9898
selfLoop         = 0
hubness          = 1
relativeVolume   = 1
```

Điểm theo GCN-inspired:

```text
walletScore(A) =
0.94   * 0.32 +
0.9167 * 0.21 +
0.9898 * 0.21 +
0      * 0.06 +
1      * 0.14 +
1      * 0.06

walletScore(A) ≈ 0.9012
```

Vì `0.9012 >= 0.72`, ví A được xếp mức **High**.

## 6. Bộ test cần thực hiện

| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| WT-01 | `A -> B -> C -> A`, amount lệch dưới 12% | Phát hiện chu trình |
| WT-02 | `A -> B -> C -> D` | Không có chu trình |
| WT-03 | Cạnh đóng vòng lệch amount trên 12% | Không nhận chu trình |
| WT-04 | Toàn chu trình vượt quá 2 giờ | Không nhận chu trình |
| WT-05 | `A -> A` | Có tín hiệu self-loop, không kết luận gian lận |
| WT-06 | Một ví H giao dịch với nhiều ví khác, không tạo vòng | H có hubness cao, không bị nhầm thành chu trình |
| WT-07 | Giao dịch thưa và amount biến thiên lớn | Điểm thấp |
| WT-08 | Cùng input chạy nhiều lần | Kết quả giống nhau |

Chỉ ghi các test là “đạt” sau khi có log Vitest hoặc GitHub Actions.

## 7. Phân biệt dữ liệu live và demo fallback

| Nguồn | Bản chất | Dùng để đánh giá dữ liệu thật |
|---|---|---|
| `helius-enhanced-api` | Transfer thật từ Helius Enhanced API | Có |
| `helius-rpc-token-accounts` | Transfer thật được suy ra từ thay đổi số dư | Có, nhưng có giới hạn |
| Cache 5 phút | Dữ liệu live đã lưu tạm | Có, nếu nguồn ban đầu là live |
| `demo-fallback` | Dữ liệu tổng hợp có chủ động tạo chu trình | Không |


Kết quả từ `demo-fallback` chỉ chứng minh pipeline và giao diện hoạt động, không chứng minh khả năng phát hiện trên token thật.

## 8. Đánh giá trên tập giao dịch đã biết trước kết quả

Nhóm sử dụng tập dữ liệu tổng hợp có kết quả kỳ vọng xác định trước:

| Tập dữ liệu | Kết quả đã biết trước |
|---|---|
| Dataset A | Có chu trình hợp lệ |
| Dataset B | Không có chu trình |
| Dataset C | Có self-loop |
| Dataset D | Có cấu trúc star topology nhưng không có chu trình |

Mục tiêu đánh giá:

- Thuật toán phát hiện đúng cấu trúc đã tạo.
- Điểm số lặp lại giống nhau với cùng đầu vào.
- Self-loop và star topology không bị nhầm thành chu trình.
- Các ngưỡng 12%, 2 giờ, 0.22, 0.45 và 0.72 hoạt động đúng.

> Do chưa có tập dữ liệu được gán nhãn đủ tin cậy, nhóm chưa đánh giá độ chính xác phân loại bằng precision, recall, F1-score hoặc ROC-AUC. Thực nghiệm hiện tập trung vào tính đúng đắn của thuật toán trên các kịch bản kiểm soát và khả năng giải thích kết quả. Các điểm rủi ro được xem là tín hiệu hỗ trợ phân tích, không phải xác suất gian lận.
