# 🎓 Hướng Dẫn Triển Khai Wash Trading Detection

## 📋 Mục Lục
1. [Tổng Quan](#tổng-quan)
2. [Kiến Trúc Hệ Thống](#kiến-trúc-hệ-thống)
3. [Nguồn Tham Khảo](#nguồn-tham-khảo)
4. [Kỹ Thuật Phát Hiện](#kỹ-thuật-phát-hiện)
5. [Triển Khai Chi Tiết](#triển-khai-chi-tiết)
6. [Kiểm Tra & Tối Ưu Hóa](#kiểm-tra--tối-ưu-hóa)

---

## 🎯 Tổng Quan

### Wash Trading là gì?

**Wash Trading** (giao dịch ảo) là hành vi tạo ra lượng giao dịch giả định để:
- Tăng volume giao dịch tối thiểu để lên sàn
- Thao túng giá token (pump & dump)
- Gây nhầm lẫn cho nhà đầu tư về tính thanh khoản

### Tại sao quan trọng?
- **Bảo vệ nhà đầu tư**: Phát hiện gian lận sớm
- **Bảo vệ hệ sinh thái**: Đảm bảo sự công bằng
- **Tuân thủ pháp luật**: SEC, FCA yêu cầu phát hiện gian lận
- **Nâng cao uy tín**: Giúp sàn giao dịch đáng tin cậy

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────┐
│              Frontend (React/TypeScript)                │
│  - Trang phân tích wash trading                         │
│  - Hiển thị network graph, biểu đồ                      │
│  - Tương tác với API backend                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│        Backend API (Node.js + Express + Hono)          │
│  - server/src/services/wash-trading.service.ts         │
│  - server/src/routes/wash-trading.route.ts             │
│  - Xử lý logic phát hiện                                │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ↓                         ↓
   ┌──────────────┐         ┌──────────────┐
   │   Database   │         │ GNN Service  │
   │  (Postgres   │         │  (Python)    │
   │  + Drizzle)  │         │  + PyTorch)  │
   └──────────────┘         └──────────────┘
```

### Các Thành Phần Chính

#### 1. **Frontend** (`client/src/pages/wash-trading/`)
- Tab 1: **Network Topology** - Hiển thị đồ thị giao dịch
- Tab 2: **Fraud Patterns** - Thống kê kiểu lừa đảo
- Tab 3: **Timeline** - Theo dõi các dị thường theo thời gian
- Các thẻ rủi ro: Điểm rủi ro, ví nghi ngờ, giao dịch vòng

#### 2. **Backend Service** (`server/src/services/wash-trading.service.ts`)
Đại diện các hàm phát hiện:
```typescript
- detectCircularTrades()      // Phát hiện A→B→C→A
- detectSameAmountPatterns()  // Phát hiện giao dịch cùng giá trị
- detectStarTopology()        // Phát hiện hub-spoke
- detectVolumeAnomalies()     // Phát hiện dị thường thống kê
- getGNNScores()              // Gọi GNN service
- analyzeWashTrading()        // Kết hợp tất cả
```

#### 3. **Database Schema** (`server/src/db/schema.ts`)
```typescript
walletTransactions: {
  address              // Địa chỉ ví
  hash                 // Hash giao dịch
  blockTimestamp       // Thời gian khối
  fromAddress          // Ví gửi
  toAddress            // Ví nhận
  primaryTokenAddress  // Token (mint address)
  primaryTokenAmount   // Số lượng token
  totalUsd            // Giá trị USD
  // ... các trường khác
}
```

---

## 📚 Nguồn Tham Khảo

### 1. **Papers & Nghiên Cứu Học Thuật**

| Tên | URL | Nội Dung |
|-----|-----|---------|
| **GNN for Fraud Detection** | https://arxiv.org/search/?query=graph+neural+network+fraud | GNN cơ bản |
| **Market Manipulation Detection** | https://arxiv.org/search/?query=market+manipulation+blockchain | Phát hiện thao túng |
| **Anomaly Detection** | https://arxiv.org/search/?query=anomaly+detection+transaction | Phát hiện dị thường |

### 2. **Framework & Library**

| Công Nghệ | URL | Mục Đích |
|-----------|-----|---------|
| **NetworkX** | https://networkx.org/documentation/stable/ | Phân tích đồ thị |
| **PyTorch Geometric** | https://pytorch-geometric.readthedocs.io/ | Triển khai GNN |
| **Drizzle ORM** | https://orm.drizzle.team/ | Truy vấn database |
| **ECharts** | https://echarts.apache.org/en/index.html | Vẽ biểu đồ |

### 3. **Blockchain APIs**

| Nguồn | URL | Dữ Liệu |
|------|-----|--------|
| **Solana RPC** | https://docs.solana.com/api | Giao dịch on-chain |
| **Helius API** | https://docs.helius.xyz/ | Giao dịch nâng cao |
| **Magic Eden** | https://docs.magiceden.io/ | Dữ liệu DEX/NFT |
| **Birdeye** | https://birdeye.so/api | Token analytics |

### 4. **Công Cụ Phân Tích On-Chain**

| Platform | URL | Tính Năng |
|----------|-----|----------|
| **Chainalysis** | https://www.chainalysis.com/ | Forensics on-chain |
| **Elliptic** | https://www.elliptic.co/ | Risk scoring |
| **TRM Labs** | https://www.trmlabs.com/ | Transaction analysis |

---

## 🔍 Kỹ Thuật Phát Hiện

### 1. **Circular Trades (Giao Dịch Vòng)**

#### Định Nghĩa
Một chuỗi giao dịch tạo thành một vòng tròn:
```
A → B (giá trị V)
B → C (giá trị ≈ V)
C → A (giá trị ≈ V)
```

#### Đặc Điểm
- ✅ Cùng token
- ✅ Cùng giá trị (sai lệch < 1%)
- ✅ Thời gian liên tiếp
- ✅ 3+ wallets tham gia

#### Mã Triển Khai
```typescript
async detectCircularTrades(mint: string): Promise<any[]> {
  const txs = await db.select()
    .from(walletTransactions)
    .where(eq(walletTransactions.primaryTokenAddress, mint))
    .limit(1000);

  const patterns: any[] = [];
  
  for (let i = 0; i < txs.length; i++) {
    const tx1 = txs[i];
    
    // Tìm tx2: từ tx1.to
    const tx2 = txs.find(t =>
      t.fromAddress === tx1.toAddress &&
      Math.abs((t.primaryTokenAmount || 0) - (tx1.primaryTokenAmount || 0)) < 
        (tx1.primaryTokenAmount || 0) * 0.01
    );
    
    if (!tx2) continue;
    
    // Tìm tx3: quay lại tx1.from
    const tx3 = txs.find(t =>
      t.fromAddress === tx2.toAddress &&
      t.toAddress === tx1.fromAddress &&
      Math.abs((t.primaryTokenAmount || 0) - (tx1.primaryTokenAmount || 0)) < 
        (tx1.primaryTokenAmount || 0) * 0.01
    );
    
    if (tx3) {
      patterns.push({
        cycle: [tx1.fromAddress, tx2.fromAddress, tx3.fromAddress],
        amounts: [tx1.primaryTokenAmount, tx2.primaryTokenAmount, tx3.primaryTokenAmount],
        timestamps: [tx1.blockTimestamp, tx2.blockTimestamp, tx3.blockTimestamp]
      });
    }
  }
  
  return patterns;
}
```

#### Risk Score
- **Cao (90-100%)**: Vòng tròn hoàn hảo, cùng token, cùng giá trị
- **Trung Bình (60-80%)**: Vòng tròn với sai lệch 2-5%
- **Thấp (20-50%)**: Nhiều ví tham gia nhưng không rõ ý định

---

### 2. **Same-Amount Patterns (Giao Dịch Cùng Giá Trị)**

#### Định Nghĩa
Nhiều giao dịch có cùng giá trị trong khoảng thời gian ngắn:
```
Ví A: gửi 1000 token
Ví B: gửi 1000 token
Ví C: gửi 1000 token
...tất cả trong 1 giờ
```

#### Công Thức Phát Hiện
```
1. Nhóm giao dịch theo giá trị (với tolerance 2%)
2. Nếu một nhóm có > 5 giao dịch → Nghi ngờ
3. Risk = min(1.0, frequency / 100)
```

#### Mã Triển Khai
```typescript
async detectSameAmountPatterns(mint: string): Promise<Map<number, any[]>> {
  const txs = await db.select()
    .from(walletTransactions)
    .where(eq(walletTransactions.primaryTokenAddress, mint))
    .limit(5000);

  const clusters = new Map<number, any[]>();
  const tolerance = 0.02; // 2%

  for (const tx of txs) {
    const amount = tx.primaryTokenAmount || 0;
    const rounded = Math.round(amount / (amount * tolerance));
    
    if (!clusters.has(rounded)) {
      clusters.set(rounded, []);
    }
    clusters.get(rounded)!.push(tx);
  }

  // Chỉ giữ những cụm có > 5 giao dịch
  const anomalous = new Map<number, any[]>();
  for (const [key, cluster] of clusters.entries()) {
    if (cluster.length > 5) {
      anomalous.set(key, cluster);
    }
  }

  return anomalous;
}
```

---

### 3. **Star Topology (Hub-Spoke Pattern)**

#### Định Nghĩa
Một ví trung tâm (hub) kết nối với nhiều ví khác (spokes):
```
    A
    ↓
B → Hub ← C
    ↑
    D
```

#### Đặc Điểm Hub
- In-degree cao (nhận từ nhiều ví)
- Out-degree cao (gửi đến nhiều ví)
- Tổng degree > 50

#### Mã Triển Khai
```typescript
async detectStarTopology(mint: string): Promise<any[]> {
  const txs = await db.select()
    .from(walletTransactions)
    .where(eq(walletTransactions.primaryTokenAddress, mint))
    .limit(10000);

  const walletDegrees = new Map<string, { in: number; out: number }>();
  
  for (const tx of txs) {
    const from = walletDegrees.get(tx.fromAddress) || { in: 0, out: 0 };
    const to = walletDegrees.get(tx.toAddress) || { in: 0, out: 0 };
    
    from.out++;
    to.in++;
    
    walletDegrees.set(tx.fromAddress, from);
    walletDegrees.set(tx.toAddress, to);
  }

  // Tìm hubs
  const hubs: any[] = [];
  for (const [wallet, degrees] of walletDegrees.entries()) {
    const totalDegree = degrees.in + degrees.out;
    if (totalDegree > 50) {
      hubs.push({
        wallet,
        inDegree: degrees.in,
        outDegree: degrees.out,
        totalDegree
      });
    }
  }

  return hubs.sort((a, b) => b.totalDegree - a.totalDegree);
}
```

---

### 4. **Volume Anomalies (Dị Thường Thống Kê)**

#### Phương Pháp: Z-Score
```
Z-Score = |X - μ| / σ

Nếu Z-Score > 2.5 → Bất thường (p < 0.01)
```

#### Mã Triển Khai
```typescript
async detectVolumeAnomalies(mint: string): Promise<any[]> {
  const txs = await db.select()
    .from(walletTransactions)
    .where(eq(walletTransactions.primaryTokenAddress, mint))
    .limit(5000);

  const amounts = txs.map(t => t.primaryTokenAmount || 0);
  
  // Tính mean
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  
  // Tính variance
  const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  // Phát hiện anomalies
  const anomalies: any[] = [];
  for (const tx of txs) {
    const amount = tx.primaryTokenAmount || 0;
    const zScore = Math.abs((amount - mean) / stdDev);
    
    if (zScore > 2.5) {
      anomalies.push({
        hash: tx.hash,
        amount,
        zScore,
        anomalyScore: Math.min(1, zScore / 5)
      });
    }
  }

  return anomalies;
}
```

---

### 5. **GNN-Based Scoring (Graph Neural Network)**

#### Khái Niệm
GNN phân tích **toàn bộ đồ thị giao dịch** để:
1. Học các mô hình cục bộ (circular trades, hubs)
2. Tính các đặc trưng toàn cộng (PageRank, betweenness)
3. Gán điểm rủi ro dựa trên vị trí trong đồ thị

#### Kiến Trúc GNN
```
Input: Đồ thị giao dịch (vertices = wallets, edges = transfers)
  ↓
[GNN Layer 1] - Học các tương tác cục bộ
  ↓
[GNN Layer 2] - Học các mô hình toàn cộng
  ↓
[Output] - Điểm rủi ro cho mỗi ví (0-1)
```

#### Triển Khai Python Backend
```python
# server/scripts/gnn_wash_trading_service.py
from flask import Flask, request, jsonify
import torch
import torch_geometric.nn as pyg_nn
from torch_geometric.data import Data
import networkx as nx

class WashTradingGNN:
    def __init__(self):
        self.model = pyg_nn.GCNConv(64, 32)
    
    def analyze(self, mint, wallets, transactions):
        # 1. Xây dựng đồ thị
        G = nx.DiGraph()
        for tx in transactions:
            G.add_edge(tx['from'], tx['to'], amount=tx['amount'])
        
        # 2. Tính đặc trưng
        features = self.compute_features(G, wallets)
        
        # 3. Dự đoán với GNN
        scores = self.model(features)
        
        return {wallet: float(score) for wallet, score in zip(wallets, scores)}
    
    def compute_features(self, G, wallets):
        # PageRank, betweenness centrality, clustering coefficient, ...
        pass

app = Flask(__name__)
gnn = WashTradingGNN()

@app.route('/api/gnn/analyze', methods=['POST'])
def analyze():
    data = request.json
    scores = gnn.analyze(
        data['mint'],
        data['wallets'],
        data['transactions']
    )
    return jsonify({'scores': scores})
```

#### Gọi từ Node.js
```typescript
async getGNNScores(mint: string, wallets: string[]): Promise<Map<string, number>> {
  try {
    const response = await fetch('http://localhost:5000/api/gnn/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint, wallets })
    });

    const data = await response.json() as { scores?: Record<string, number> };
    return new Map(Object.entries(data.scores || {}));
  } catch (error) {
    console.error('GNN error:', error);
    return new Map(); // Fallback
  }
}
```

---

## 🛠️ Triển Khai Chi Tiết

### Bước 1: Thiết Lập Backend

#### 1.1 Cài Đặt Dependencies
```bash
cd server
npm install
npm run build
```

#### 1.2 Cấu Hình Database
```bash
# Tạo bảng (nếu chưa có)
npm run db:migrate
```

#### 1.3 Đăng Ký Route
```typescript
// server/src/main.ts
import washTradingRoutes from './routes/wash-trading.route';

app.use('/api/v1/wash-trading', washTradingRoutes);
```

### Bước 2: Triển Khai Python GNN Service

#### 2.1 Cài Đặt Python Dependencies
```bash
cd server/scripts
pip install -r gnn_requirements.txt
```

**gnn_requirements.txt:**
```
flask==2.3.0
torch==2.0.0
torch-geometric==2.3.0
networkx==3.1
numpy==1.24.0
```

#### 2.2 Chạy GNN Service
```bash
python gnn_wash_trading_service.py
```

Kết quả:
```
 * Running on http://0.0.0.0:5000
```

### Bước 3: Frontend Integration

#### 3.1 Tạo Component Phân Tích
```typescript
// client/src/pages/wash-trading/index.tsx
import React, { useState } from 'react';
import { analyzeWashTrading } from '@/api/wash-trading';

export function WashTradingPage() {
  const [tokenMint, setTokenMint] = useState('');
  const [results, setResults] = useState<WashTradeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const data = await analyzeWashTrading(tokenMint);
      setResults(data);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wash-trading-container">
      <h1>Wash Trading Detection</h1>
      
      <input
        type="text"
        placeholder="Token Mint Address"
        value={tokenMint}
        onChange={e => setTokenMint(e.target.value)}
      />
      
      <button onClick={handleAnalyze} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>

      {results && (
        <>
          {/* Risk Summary Cards */}
          <div className="cards">
            <Card label="Risk Score" value={`${Math.round(results.riskScore * 100)}%`} />
            <Card label="Suspicious Wallets" value={results.suspiciousWallets.length} />
            <Card label="Circular Trades" value={results.summary.circularTrades} />
            <Card label="Total Volume" value={`$${results.summary.totalVolume.toFixed(0)}`} />
          </div>

          {/* Tabs */}
          <Tabs>
            <TabPanel label="Network" content={<NetworkGraph results={results} />} />
            <TabPanel label="Patterns" content={<PatternChart results={results} />} />
            <TabPanel label="Timeline" content={<TimelineChart results={results} />} />
          </Tabs>
        </>
      )}
    </div>
  );
}
```

#### 3.2 API Client
```typescript
// client/src/api/wash-trading.ts
import { apiUrl } from '@/config/constants';

export async function analyzeWashTrading(tokenMint: string) {
  const response = await fetch(
    `${apiUrl}/api/v1/wash-trading/analyze?mint=${tokenMint}`
  );
  
  if (!response.ok) {
    throw new Error('Analysis failed');
  }
  
  return response.json();
}
```

---

## ✅ Kiểm Tra & Tối Ưu Hóa

### Test Cases

#### Test 1: Circular Trade
```
Input:
  Ví A: gửi 1000 USDC → Ví B
  Ví B: gửi 1000 USDC → Ví C
  Ví C: gửi 1000 USDC → Ví A

Expected: Pattern phát hiện được, confidence > 90%
```

#### Test 2: Hub Wallet
```
Input:
  Ví Hub: nhận/gửi từ 100+ ví khác

Expected: Hub được xác định, inDegree/outDegree cao
```

#### Test 3: Volume Anomaly
```
Input:
  99 giao dịch: 100 token
  1 giao dịch: 10,000 token

Expected: Giao dịch lớn được phát hiện, Z-score > 2.5
```

### Performance Metrics

| Metric | Target |
|--------|--------|
| Time to analyze 1 token | < 5 giây |
| Pattern accuracy | > 85% |
| False positive rate | < 10% |
| GNN latency | < 2 giây |

### Tối Ưu Hóa

1. **Caching**
   ```typescript
   // Cache kết quả phân tích
   const cache = new Map<string, CachedResult>();
   const TTL = 3600000; // 1 giờ
   ```

2. **Batch Processing**
   ```typescript
   // Phân tích nhiều token cùng lúc
   const results = await Promise.all(
     tokens.map(t => analyzeWashTrading(t.mint))
   );
   ```

3. **Database Indexing**
   ```sql
   CREATE INDEX idx_wallet_tx_mint 
   ON wallet_transactions(primary_token_address, block_timestamp);
   ```

---

## 📊 Ví Dụ Output

```json
{
  "riskScore": 0.87,
  "suspiciousWallets": [
    {
      "wallet": "7XLR2zXYqw...",
      "volume": 5000000,
      "confidence": 0.92,
      "pattern": "Circular Trade",
      "gnnScore": 0.88
    },
    {
      "wallet": "9k7M3nR5...",
      "volume": 3200000,
      "confidence": 0.75,
      "pattern": "Hub Wallet",
      "gnnScore": 0.72
    }
  ],
  "summary": {
    "totalVolume": 50000000,
    "volumeAnomalies": 12,
    "circularTrades": 3
  },
  "patterns": {
    "circularTrades": 3,
    "sameAmountTransactions": 25,
    "tightTimingClusters": 8,
    "starTopology": true,
    "volumeAnomaly": true
  }
}
```

---

## 🔗 Tài Liệu Liên Quan

- [WASH_TRADING_QUICK_START.md](./WASH_TRADING_QUICK_START.md)
- [WASH_TRADING_TROUBLESHOOTING.md](./WASH_TRADING_TROUBLESHOOTING.md)
- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)
