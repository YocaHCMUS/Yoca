# 🛠️ Hướng Dẫn Khắc Phục Sự Cố - Wash Trading Detection

## 📋 Mục Lục
1. [Lỗi Thường Gặp](#lỗi-thường-gặp)
2. [Vấn Đề Database](#vấn-đề-database)
3. [Vấn Đề GNN Service](#vấn-đề-gnn-service)
4. [Vấn Đề Frontend](#vấn-đề-frontend)
5. [Performance Issues](#performance-issues)
6. [Debugging](#debugging)

---

## 🔴 Lỗi Thường Gặp

### Lỗi 1: `Property 'transactions' does not exist`

**Nguyên Nhân:**
```typescript
// ❌ SAI - Không có bảng 'transactions'
db.query.transactions.findMany(...)
```

**Giải Pháp:**
```typescript
// ✅ ĐÚNG - Sử dụng walletTransactions
import { walletTransactions } from '../db/schema';

const txs = await db.select()
  .from(walletTransactions)
  .where(eq(walletTransactions.primaryTokenAddress, mint))
  .limit(1000);
```

---

### Lỗi 2: `Cannot find name 'transactions'`

**Nguyên Nhân:**
Không import `walletTransactions` từ schema

**Giải Pháp:**
```typescript
// Thêm dòng này ở đầu file
import { walletTransactions } from '../db/schema';
```

---

### Lỗi 3: `Parameter 't' implicitly has an 'any' type`

**Nguyên Nhân:**
```typescript
// ❌ SAI - Không có type annotation
txs.find(t => t.fromAddress === ...)
```

**Giải Pháp:**
```typescript
// ✅ ĐÚNG - Thêm type annotation
const txs = await db.select().from(walletTransactions).limit(100);
txs.find((t: typeof txs[0]) => t.fromAddress === ...)
```

---

### Lỗi 4: `Property 'scores' does not exist on type 'unknown'`

**Nguyên Nhân:**
```typescript
// ❌ SAI - Response không được type
const { scores } = await response.json();
```

**Giải Pháp:**
```typescript
// ✅ ĐÚNG - Type response
const data = await response.json() as { scores?: Record<string, number> };
const scores = data.scores || {};
```

---

## 🗄️ Vấn Đề Database

### Problem: Queries timeout

**Nguyên Nhân:**
- Dữ liệu quá lớn (> 10,000 records)
- Không có index
- Network chậm

**Giải Pháp:**
```typescript
// 1. Giảm limit
const txs = await db.select()
  .from(walletTransactions)
  .where(eq(walletTransactions.primaryTokenAddress, mint))
  .limit(1000); // ← Từ 5000 xuống 1000

// 2. Thêm index
// server/migrations/0008_wash_trading_index.sql
CREATE INDEX idx_wallet_tx_token_time
ON wallet_transactions(primary_token_address, block_timestamp DESC);

// 3. Giới hạn thời gian
const timeWindow = 24 * 60 * 60 * 1000; // 24 giờ
const txs = await db.select()
  .from(walletTransactions)
  .where(
    and(
      eq(walletTransactions.primaryTokenAddress, mint),
      gte(walletTransactions.blockTimestamp, 
          new Date(Date.now() - timeWindow))
    )
  )
  .limit(5000);
```

---

### Problem: Null/undefined values

**Nguyên Nhân:**
Dữ liệu không đầy đủ hoặc schema không khớp

**Giải Pháp:**
```typescript
// ❌ SAI
const amount = tx.primaryTokenAmount; // undefined?

// ✅ ĐÚNG - Với default value
const amount = tx.primaryTokenAmount ?? 0;

// ✅ ĐÚNG - Với null coalescing
const amounts = txs.map(t => t.primaryTokenAmount || 0);
```

---

### Problem: Type Casting Error

**Nguyên Nhân:**
```typescript
// ❌ SAI - amount có thể là string trong database
const sum = txs.reduce((a, b) => a + b.primaryTokenAmount, 0);
```

**Giải Pháp:**
```typescript
// ✅ ĐÚNG - Convert to number
const sum = txs.reduce((a, b) => {
  const amount = Number(b.primaryTokenAmount) || 0;
  return a + amount;
}, 0);
```

---

## 🐍 Vấn Đề GNN Service

### Problem: GNN service not responding

**Triệu Chứng:**
```
Error: GNN service unavailable
```

**Checklist:**
1. ✅ GNN service có chạy?
   ```bash
   curl http://localhost:5000/api/gnn/analyze
   ```

2. ✅ Port 5000 có sẵn?
   ```bash
   netstat -an | grep 5000
   ```

3. ✅ URL đúng?
   ```typescript
   // Kiểm tra URL trong service
   fetch('http://localhost:5000/api/gnn/analyze', ...)
   ```

**Giải Pháp:**
```bash
# 1. Khởi động lại GNN service
cd server/scripts
pkill -f "python gnn_wash_trading_service.py"
python gnn_wash_trading_service.py

# 2. Check logs
tail -f gnn_service.log

# 3. Test endpoint
curl -X POST http://localhost:5000/api/gnn/analyze \
  -H "Content-Type: application/json" \
  -d '{"mint": "test", "wallets": ["addr1", "addr2"]}'
```

---

### Problem: GNN returns empty scores

**Giải Pháp:**
```python
# server/scripts/gnn_wash_trading_service.py
@app.route('/api/gnn/analyze', methods=['POST'])
def analyze():
    data = request.json
    mint = data.get('mint')
    wallets = data.get('wallets', [])
    
    # Debug log
    print(f"Analyzing {len(wallets)} wallets for {mint}")
    
    # Validate input
    if not wallets:
        return jsonify({'scores': {}})
    
    scores = gnn.analyze(mint, wallets)
    
    # Ensure all wallets have scores
    result = {w: scores.get(w, 0.5) for w in wallets}
    
    return jsonify({'scores': result})
```

---

### Problem: GNN Memory out of bound

**Giải Pháp:**
```python
# Giảm batch size
MAX_WALLETS_PER_REQUEST = 100

@app.route('/api/gnn/analyze', methods=['POST'])
def analyze():
    data = request.json
    wallets = data.get('wallets', [])
    
    if len(wallets) > MAX_WALLETS_PER_REQUEST:
        # Process in batches
        all_scores = {}
        for i in range(0, len(wallets), MAX_WALLETS_PER_REQUEST):
            batch = wallets[i:i+MAX_WALLETS_PER_REQUEST]
            batch_scores = gnn.analyze(data['mint'], batch)
            all_scores.update(batch_scores)
        return jsonify({'scores': all_scores})
    
    scores = gnn.analyze(data['mint'], wallets)
    return jsonify({'scores': scores})
```

---

## 🎨 Vấn Đề Frontend

### Problem: Results không hiển thị

**Checklist:**
1. ✅ API trả về data?
   ```javascript
   // Kiểm tra trong DevTools
   console.log(results);
   ```

2. ✅ Component có render?
   ```typescript
   {results && (
     <div className="results">
       {/* Render results */}
     </div>
   )}
   ```

3. ✅ Data structure đúng?
   ```typescript
   // Validate interface
   if (!results.riskScore || !results.suspiciousWallets) {
     console.error('Invalid results:', results);
   }
   ```

**Giải Pháp:**
```typescript
// Thêm debugging
console.log('Analysis started');

try {
  const data = await analyzeWashTrading(tokenMint);
  console.log('Results received:', data);
  
  // Validate
  if (!data.riskScore) {
    throw new Error('Invalid response structure');
  }
  
  setResults(data);
} catch (error) {
  console.error('Analysis failed:', error);
  // Show user-friendly error
}
```

---

### Problem: Chart không vẽ

**Checklist:**
1. ✅ ECharts library đã import?
   ```typescript
   import * as echarts from 'echarts';
   ```

2. ✅ DOM element tồn tại?
   ```html
   <div id="chart-container"></div>
   ```

3. ✅ Data format đúng cho chart?
   ```typescript
   // ECharts format
   {
     xAxis: { type: 'category', data: [...] },
     yAxis: { type: 'value' },
     series: [{ data: [...], type: 'line' }]
   }
   ```

**Giải Pháp:**
```typescript
// Helper function
function prepareChartData(results: WashTradeAnalysis) {
  const wallets = results.suspiciousWallets.map(w => w.wallet.slice(0, 6));
  const scores = results.suspiciousWallets.map(w => w.confidence);
  
  return {
    xAxis: { type: 'category', data: wallets },
    yAxis: { type: 'value', min: 0, max: 1 },
    series: [{
      data: scores,
      type: 'bar',
      itemStyle: {
        color: (params: any) => params.value > 0.8 ? '#ff0000' : '#ffff00'
      }
    }]
  };
}
```

---

## ⚡ Performance Issues

### Problem: Analysis quá chậm (> 10 giây)

**Nguyên Nhân:**
1. Quá nhiều dữ liệu
2. N+1 queries
3. GNN service chậm

**Giải Pháp:**

#### A. Optimize Database
```typescript
// ❌ CHẬM - Query từng cái một
for (const wallet of wallets) {
  const txs = await db.select()
    .from(walletTransactions)
    .where(eq(walletTransactions.fromAddress, wallet));
}

// ✅ NHANH - Query một lần
const txs = await db.select()
  .from(walletTransactions)
  .where(inArray(walletTransactions.fromAddress, wallets));
```

#### B. Use Parallel Processing
```typescript
// ✅ Chạy song song
const [circular, sameAmount, star, volumeAnomalies] = await Promise.all([
  this.detectCircularTrades(mint),
  this.detectSameAmountPatterns(mint),
  this.detectStarTopology(mint),
  this.detectVolumeAnomalies(mint)
]);
```

#### C. Cache Results
```typescript
const CACHE_TTL = 3600000; // 1 giờ
const resultCache = new Map<string, { data: WashTradeAnalysis; time: number }>();

async analyzeWashTrading(mint: string): Promise<WashTradeAnalysis> {
  const cached = resultCache.get(mint);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  
  // Perform analysis...
  const result = { /* ... */ };
  
  resultCache.set(mint, { data: result, time: Date.now() });
  return result;
}
```

---

## 🐛 Debugging

### Enable Logging

```typescript
// server/src/services/wash-trading.service.ts
import logger from '../util/logger';

async detectCircularTrades(mint: string): Promise<any[]> {
  logger.info(`Starting circular trade detection for ${mint}`);
  
  try {
    const txs = await db.select()
      .from(walletTransactions)
      .where(eq(walletTransactions.primaryTokenAddress, mint))
      .limit(1000);
    
    logger.debug(`Found ${txs.length} transactions`);
    
    const patterns = [];
    // ... detection logic
    
    logger.info(`Detected ${patterns.length} circular patterns`);
    return patterns;
  } catch (error) {
    logger.error('Circular trade detection failed:', error);
    throw error;
  }
}
```

### Use DevTools

```typescript
// Chrome DevTools Console
// 1. Kiểm tra API response
const result = await fetch('/api/v1/wash-trading/analyze?mint=...')
  .then(r => r.json());
console.log(result);

// 2. Kiểm tra Network tab
// - Status: 200?
// - Response size: reasonable?
// - Time: < 5s?

// 3. Kiểm tra React DevTools
// - Component state?
// - Props values?
```

### Breakpoints

```typescript
// server/src/services/wash-trading.service.ts
async detectCircularTrades(mint: string): Promise<any[]> {
  const recentTxs = await db.select()...limit(1000);
  
  debugger; // ← Dừng ở đây khi debugging
  
  const circularPatterns: any[] = [];
  for (let i = 0; i < recentTxs.length; i++) {
    const tx1 = recentTxs[i];
    // ...
  }
}
```

Chạy:
```bash
node --inspect-brk server/dist/services/wash-trading.service.js
# Open chrome://inspect in Chrome
```

---

## 📝 Checklist Deployment

- [ ] Tất cả imports đúng
- [ ] Database indexes tạo
- [ ] GNN service chạy
- [ ] API routes đăng ký
- [ ] Environment variables set
- [ ] Error handling hoàn thiện
- [ ] Logging configured
- [ ] Tests passing
- [ ] Performance acceptable (< 5s)
- [ ] Documentation updated

---

## 📞 Hỗ Trợ

Nếu gặp lỗi không trong danh sách:
1. Check logs: `tail -f server/logs/*.log`
2. Run tests: `npm test`
3. Check database: `npm run db:studio`
