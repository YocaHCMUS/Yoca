# 🎓 Mở Rộng Wash Trading Detection - Kỹ Thuật Nâng Cao

## 📋 Mục Lục
1. [Kỹ Thuật Bổ Sung](#kỹ-thuật-bổ-sung)
2. [Machine Learning Models](#machine-learning-models)
3. [Advanced GNN](#advanced-gnn)
4. [Real-time Monitoring](#real-time-monitoring)
5. [Tích Hợp Thêm](#tích-hợp-thêm)

---

## 🔍 Kỹ Thuật Bổ Sung

### 1. **Clustering Analysis (Phân Tích Cụm)**

#### Định Nghĩa
Nhóm các ví có hành vi tương tự lại với nhau để phát hiện **cartel** (nhóm gian lận)

#### Thuật Toán
```
1. Tính similarity matrix giữa các ví
2. Áp dụng K-means hoặc DBSCAN
3. Tìm các cluster có hành vi nghi ngờ
```

#### Triển Khai
```typescript
async detectCartels(mint: string): Promise<Cartel[]> {
  // 1. Lấy giao dịch
  const txs = await db.select()
    .from(walletTransactions)
    .where(eq(walletTransactions.primaryTokenAddress, mint));
  
  // 2. Tính feature vector cho mỗi ví
  const wallets = new Set(txs.flatMap(t => [t.fromAddress, t.toAddress]));
  const features = new Map<string, number[]>();
  
  for (const wallet of wallets) {
    const walletTxs = txs.filter(t => 
      t.fromAddress === wallet || t.toAddress === wallet
    );
    
    features.set(wallet, [
      walletTxs.length,                    // Transaction count
      walletTxs.reduce((s, t) => s + (t.primaryTokenAmount || 0), 0), // Total volume
      walletTxs.filter(t => t.fromAddress === wallet).length, // Out-degree
      walletTxs.filter(t => t.toAddress === wallet).length,   // In-degree
    ]);
  }
  
  // 3. Clustering (sử dụng library như mljs)
  const clustering = new KMeans({ k: 5 });
  const clusters = clustering.predict(Array.from(features.values()));
  
  // 4. Phân tích các cluster
  const cartels: Cartel[] = [];
  for (let i = 0; i < clustering.centroids.length; i++) {
    const clusterWallets = Array.from(wallets)
      .filter((_, idx) => clusters[idx] === i);
    
    // Tính risk score cho cluster
    const risk = calculateClusterRisk(clusterWallets, txs);
    
    if (risk > 0.7) {
      cartels.push({
        id: i,
        wallets: clusterWallets,
        riskScore: risk,
        pattern: 'Coordinated Activity'
      });
    }
  }
  
  return cartels;
}

function calculateClusterRisk(wallets: string[], txs: any[]): number {
  // Tính số giao dịch nội cluster
  const internalTxs = txs.filter(t =>
    wallets.includes(t.fromAddress) && wallets.includes(t.toAddress)
  );
  
  const totalTxs = txs.filter(t =>
    wallets.includes(t.fromAddress) || wallets.includes(t.toAddress)
  );
  
  const internalRatio = internalTxs.length / (totalTxs.length || 1);
  
  // Cluster có > 80% giao dịch nội bộ → nghi ngờ
  return internalRatio > 0.8 ? 0.9 : internalRatio * 0.5;
}
```

---

### 2. **Time Series Anomaly Detection**

#### Định Nghĩa
Phát hiện những thay đổi đột ngột trong mô hình giao dịch theo thời gian

#### Phương Pháp: Isolation Forest
```python
# server/scripts/anomaly_detection.py
from sklearn.ensemble import IsolationForest
import numpy as np

def detect_time_series_anomalies(transactions, window_size=24):
    """
    Phát hiện dị thường dựa trên chuỗi thời gian
    
    Args:
        transactions: List of transaction data
        window_size: Hours to aggregate (default 24h)
    """
    
    # Aggregate by time windows
    hourly_volumes = {}
    for tx in transactions:
        hour = int(tx['timestamp'] / 3600) * 3600
        hourly_volumes[hour] = hourly_volumes.get(hour, 0) + tx['amount']
    
    # Prepare data
    X = np.array(list(hourly_volumes.values())).reshape(-1, 1)
    
    # Train Isolation Forest
    clf = IsolationForest(contamination=0.1, random_state=42)
    predictions = clf.fit_predict(X)
    
    # Extract anomalies
    anomalies = []
    for idx, pred in enumerate(predictions):
        if pred == -1:  # Anomaly
            hour = sorted(hourly_volumes.keys())[idx]
            anomalies.append({
                'timestamp': hour,
                'volume': hourly_volumes[hour],
                'anomaly_score': abs(clf.offset_[0])
            })
    
    return anomalies
```

#### Gọi từ Node.js
```typescript
async detectTimeSeriesAnomalies(mint: string): Promise<any[]> {
  const txs = await db.select()
    .from(walletTransactions)
    .where(eq(walletTransactions.primaryTokenAddress, mint));
  
  // Call Python service
  const response = await fetch('http://localhost:5000/api/anomaly/timeseries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mint,
      transactions: txs.map(t => ({
        timestamp: t.blockTimestamp.getTime(),
        amount: t.primaryTokenAmount || 0
      }))
    })
  });
  
  return response.json();
}
```

---

### 3. **Network Motif Detection (Phát Hiện Mô Hình Mạng)**

#### Định Nghĩa
Tìm các mô hình mạng lặp lại (feedforward loops, feedback loops, etc.) thường liên quan đến gian lận

#### Các Motif Thường Gặp
```
1. Feedback Loop: A → B → C → A
2. Feedforward Loop: A → B, A → C, B → C
3. Star: Hub → Spoke1, Hub → Spoke2, ...
4. Triangle: A ↔ B ↔ C ↔ A (mutual transfers)
```

#### Triển Khai
```typescript
async detectMotifs(mint: string): Promise<Motif[]> {
  const txs = await db.select()
    .from(walletTransactions)
    .where(eq(walletTransactions.primaryTokenAddress, mint));
  
  // Build adjacency list
  const graph = new Map<string, Set<string>>();
  for (const tx of txs) {
    if (!graph.has(tx.fromAddress)) {
      graph.set(tx.fromAddress, new Set());
    }
    graph.get(tx.fromAddress)!.add(tx.toAddress);
  }
  
  const motifs: Motif[] = [];
  
  // Find triangles (A ↔ B ↔ C ↔ A)
  for (const [a, neighbors] of graph) {
    for (const b of neighbors) {
      const bNeighbors = graph.get(b) || new Set();
      for (const c of bNeighbors) {
        const cNeighbors = graph.get(c) || new Set();
        
        // Check if triangle exists
        if (cNeighbors.has(a) && bNeighbors.has(c) && neighbors.has(b)) {
          motifs.push({
            type: 'triangle',
            nodes: [a, b, c],
            confidence: 0.85
          });
        }
      }
    }
  }
  
  return motifs;
}
```

---

## 🤖 Machine Learning Models

### 1. **Random Forest Classifier**

Dùng để phân loại ví là "bình thường" hay "nghi ngờ"

```python
# server/scripts/ml_models.py
from sklearn.ensemble import RandomForestClassifier
import pickle
import numpy as np

class WashTradingClassifier:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.loaded = False
    
    def train(self, X_train, y_train):
        """
        X_train: Features [transaction_count, total_volume, in_degree, out_degree, ...]
        y_train: Labels [0=normal, 1=suspicious]
        """
        self.model.fit(X_train, y_train)
        
        # Save model
        with open('models/wash_trading_model.pkl', 'wb') as f:
            pickle.dump(self.model, f)
    
    def predict(self, wallets_features):
        """
        wallets_features: List of feature vectors
        Returns: Probabilities of being suspicious
        """
        if not self.loaded:
            with open('models/wash_trading_model.pkl', 'rb') as f:
                self.model = pickle.load(f)
            self.loaded = True
        
        return self.model.predict_proba(wallets_features)[:, 1]
    
    def get_feature_importance(self):
        """
        Return which features are most important
        """
        features = [
            'transaction_count',
            'total_volume',
            'in_degree',
            'out_degree',
            'avg_transaction_value',
            'time_concentration',  # Are txs clustered?
            'amount_uniformity'    # Are amounts similar?
        ]
        
        return {
            features[i]: importance 
            for i, importance in enumerate(self.model.feature_importances_)
        }

# Initialize
classifier = WashTradingClassifier()

@app.route('/api/ml/predict', methods=['POST'])
def predict():
    data = request.json
    wallets = data['wallets']
    features = compute_wallet_features(wallets)  # Extract features
    
    scores = classifier.predict(features)
    
    return jsonify({
        'predictions': {w: float(s) for w, s in zip(wallets, scores)},
        'feature_importance': classifier.get_feature_importance()
    })
```

#### Integrate to Node.js
```typescript
async predictWalletRisk(wallets: string[]): Promise<Map<string, number>> {
  const features = wallets.map(w => this.extractWalletFeatures(w));
  
  const response = await fetch('http://localhost:5000/api/ml/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallets, features })
  });
  
  const { predictions } = await response.json();
  return new Map(Object.entries(predictions) as [string, number][]);
}

private async extractWalletFeatures(wallet: string): Promise<number[]> {
  const txs = await db.select()
    .from(walletTransactions)
    .where(or(
      eq(walletTransactions.fromAddress, wallet),
      eq(walletTransactions.toAddress, wallet)
    ));
  
  const inTxs = txs.filter(t => t.toAddress === wallet);
  const outTxs = txs.filter(t => t.fromAddress === wallet);
  
  const totalVolume = txs.reduce((s, t) => s + (t.primaryTokenAmount || 0), 0);
  const avgAmount = totalVolume / (txs.length || 1);
  
  // Time concentration: variance in transaction times
  const times = txs.map(t => t.blockTimestamp.getTime());
  const timeMean = times.reduce((a, b) => a + b, 0) / times.length;
  const timeVariance = times.reduce((s, t) => s + Math.pow(t - timeMean, 2), 0) / times.length;
  const timeConcentration = Math.sqrt(timeVariance);
  
  // Amount uniformity: std dev of amounts
  const amounts = txs.map(t => t.primaryTokenAmount || 0);
  const amountVariance = amounts.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / amounts.length;
  const amountUniformity = Math.sqrt(amountVariance);
  
  return [
    txs.length,                    // transaction_count
    totalVolume,                   // total_volume
    inTxs.length,                  // in_degree
    outTxs.length,                 // out_degree
    avgAmount,                     // avg_transaction_value
    timeConcentration,             // time_concentration
    amountUniformity              // amount_uniformity
  ];
}
```

---

### 2. **LSTM for Temporal Patterns**

```python
# server/scripts/lstm_model.py
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

class TemporalAnomalyDetector:
    def __init__(self, sequence_length=24):
        self.sequence_length = sequence_length
        self.model = self._build_model()
    
    def _build_model(self):
        model = Sequential([
            LSTM(64, input_shape=(self.sequence_length, 1), return_sequences=True),
            Dropout(0.2),
            LSTM(32),
            Dropout(0.2),
            Dense(16, activation='relu'),
            Dense(1, activation='sigmoid')
        ])
        model.compile(optimizer='adam', loss='mse')
        return model
    
    def train(self, X_train):
        """
        X_train: Shape (samples, sequence_length, 1)
        Normal transaction volumes
        """
        self.model.fit(X_train, X_train, epochs=50, batch_size=32)
        self.model.save('models/lstm_anomaly_detector.h5')
    
    def detect_anomaly(self, sequence):
        """
        sequence: 24 hourly volumes
        Returns: Reconstruction error (higher = more anomalous)
        """
        X = np.array(sequence).reshape(1, -1, 1)
        prediction = self.model.predict(X)[0][0]
        
        # Calculate MSE between input and reconstruction
        error = np.mean((X.flatten() - prediction) ** 2)
        return error
```

---

## 🧠 Advanced GNN

### 1. **GraphSAGE (Graph Sample and AggregatE)**

```python
# server/scripts/advanced_gnn.py
import torch
import torch.nn as nn
from torch_geometric.nn import GraphSAGE

class AdvancedWashTradingGNN(nn.Module):
    def __init__(self, in_channels=10, hidden_channels=64, out_channels=2):
        super().__init__()
        self.sage = GraphSAGE(in_channels, hidden_channels, out_channels, num_layers=3)
    
    def forward(self, x, edge_index):
        """
        x: Node features (wallet embeddings)
        edge_index: Edge connections (transactions)
        """
        return self.sage(x, edge_index)

def compute_graph_features(transactions):
    """
    Compute features for each wallet node
    """
    features = {}
    
    for tx in transactions:
        for wallet in [tx['from'], tx['to']]:
            if wallet not in features:
                features[wallet] = {
                    'out_degree': 0,
                    'in_degree': 0,
                    'total_volume': 0,
                    'avg_amount': 0,
                    'neighbor_diversity': 0
                }
            
            if wallet == tx['from']:
                features[wallet]['out_degree'] += 1
                features[wallet]['total_volume'] += tx['amount']
            else:
                features[wallet]['in_degree'] += 1
    
    return features
```

### 2. **Attention-based GNN**

```python
import torch.nn.functional as F
from torch_geometric.nn import GATConv

class AttentionBasedGNN(nn.Module):
    def __init__(self, in_channels=10, hidden_channels=64):
        super().__init__()
        self.conv1 = GATConv(in_channels, hidden_channels, heads=8, dropout=0.6)
        self.conv2 = GATConv(hidden_channels * 8, 2, heads=1, concat=False, dropout=0.6)
    
    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = self.conv2(x, edge_index)
        return F.log_softmax(x, dim=1)
```

---

## 📊 Real-time Monitoring

### 1. **Streaming Analysis**

```typescript
// Backend: Monitor new transactions
import { EventEmitter } from 'events';

class WashTradingMonitor extends EventEmitter {
  private walletScores = new Map<string, number>();
  
  async monitorTokenStream(mint: string) {
    // Subscribe to transaction stream (using Helius API or similar)
    const stream = subscribeToTokenTransactions(mint);
    
    stream.on('transaction', async (tx) => {
      // Update wallet scores incrementally
      const score1 = await this.updateWalletScore(tx.fromAddress);
      const score2 = await this.updateWalletScore(tx.toAddress);
      
      // Emit alert if risk increases
      if (score1 > 0.8 || score2 > 0.8) {
        this.emit('suspicious_activity', { tx, scores: { [tx.fromAddress]: score1, [tx.toAddress]: score2 } });
      }
    });
  }
  
  private async updateWalletScore(wallet: string): Promise<number> {
    const history = this.walletScores.get(wallet) || 0.5;
    
    // Get latest transactions
    const recentTxs = await db.select()
      .from(walletTransactions)
      .where(or(
        eq(walletTransactions.fromAddress, wallet),
        eq(walletTransactions.toAddress, wallet)
      ))
      .orderBy(desc(walletTransactions.blockTimestamp))
      .limit(20);
    
    // Recalculate score
    const newScore = await this.calculateScore(recentTxs);
    
    // Exponential moving average
    const ewmaScore = 0.7 * history + 0.3 * newScore;
    this.walletScores.set(wallet, ewmaScore);
    
    return ewmaScore;
  }
}
```

### 2. **Webhook Alerts**

```typescript
// Send alerts to external systems
async function sendAlert(alert: SuspiciousActivity) {
  // Discord webhook
  await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: 'Wash Trading Alert',
        description: `${alert.wallet} - Risk Score: ${alert.score}`,
        color: alert.score > 0.9 ? 0xFF0000 : 0xFFFF00,
        fields: [
          { name: 'Pattern', value: alert.pattern },
          { name: 'Confidence', value: `${(alert.confidence * 100).toFixed(1)}%` }
        ]
      }]
    })
  });
  
  // Email notification
  await emailService.send({
    to: 'moderators@exchange.com',
    subject: `Wash Trading Alert: ${alert.wallet}`,
    html: renderAlertEmail(alert)
  });
}
```

---

## 🔗 Tích Hợp Thêm

### 1. **On-Chain Risk Scores**

Kết hợp với các on-chain data providers:

```typescript
async enrichWithExternalRiskScores(wallet: string) {
  // Get scores from multiple providers
  const [chainalysis, elliptic, trm] = await Promise.all([
    getChainalysisScore(wallet),
    getEllipticScore(wallet),
    getTRMScore(wallet)
  ]);
  
  // Weighted average
  return (chainalysis * 0.3 + elliptic * 0.3 + trm * 0.4);
}
```

### 2. **Historical Analysis**

```typescript
// Compare with historical patterns
async analyzeHistoricalTrends(mint: string) {
  const pastAnalyses = await db.select()
    .from(washTradingAnalysisHistory)
    .where(eq(washTradingAnalysisHistory.tokenMint, mint))
    .orderBy(desc(washTradingAnalysisHistory.createdAt))
    .limit(30);
  
  // Find similar patterns
  return findSimilarPatterns(pastAnalyses);
}
```

---

## 📚 Tài Liệu Tham Khảo Thêm

- [Graph Neural Networks for Fraud Detection](https://arxiv.org/search/?query=gnn+fraud)
- [Temporal Anomaly Detection](https://arxiv.org/search/?query=temporal+anomaly)
- [Market Manipulation Detection](https://arxiv.org/search/?query=market+manipulation)
