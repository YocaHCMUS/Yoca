import React, { useState } from 'react';
import styles from './wash-trading.module.scss';
import { PageWrapper } from '@/components/wrapper/PageWrapper';
import { useUserTheme } from '@/contexts/ThemeContext';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_RESULT = {
  riskScore: 0.873,
  suspiciousWallets: [
    { wallet: '7xKp...mN3q', volume: 1_200_000, confidence: 94, pattern: 'Circular Trading' },
    { wallet: '3Rtz...pQ8w', volume: 870_000,   confidence: 87, pattern: 'Circular Trading' },
    { wallet: '9mWs...kL2x', volume: 540_000,   confidence: 76, pattern: 'Volume Spike' },
    { wallet: '2Fjn...hY5c', volume: 310_000,   confidence: 71, pattern: 'Time Pattern' },
    { wallet: '5Bqr...tW9m', volume: 280_000,   confidence: 68, pattern: 'Amount Mirror' },
    { wallet: '8Kzt...nP4v', volume: 195_000,   confidence: 64, pattern: 'Volume Spike' },
  ],
  transactions: [
    { hash: '4xK9pLmQrBw8nZtY', from: '7xKp...mN3q', to: '3Rtz...pQ8w', amount: 45200,  timestamp: '2024-01-15T13:05:00Z', anomalyScore: 0.92 },
    { hash: '7nRtBqwKpMx3vZsL', from: '3Rtz...pQ8w', to: '9mWs...kL2x', amount: 44800,  timestamp: '2024-01-15T13:08:18Z', anomalyScore: 0.89 },
    { hash: '2mVxKprNtWb5qLjP', from: '9mWs...kL2x', to: '7xKp...mN3q', amount: 45100,  timestamp: '2024-01-15T13:11:22Z', anomalyScore: 0.91 },
    { hash: '9pLtNvwQmBr4kZxW', from: '2Fjn...hY5c', to: '5Bqr...tW9m', amount: 28300,  timestamp: '2024-01-15T13:32:05Z', anomalyScore: 0.74 },
    { hash: '3kBmQrxPsNv6tLwJ', from: '5Bqr...tW9m', to: '8Kzt...nP4v', amount: 27900,  timestamp: '2024-01-15T13:35:12Z', anomalyScore: 0.71 },
    { hash: '8wZjPltVrKb2nMxQ', from: '8Kzt...nP4v', to: '2Fjn...hY5c', amount: 28100,  timestamp: '2024-01-15T13:38:44Z', anomalyScore: 0.73 },
    { hash: '1xCvMnpRtWq7kZbL', from: '7xKp...mN3q', to: '3Rtz...pQ8w', amount: 61400,  timestamp: '2024-01-15T14:15:03Z', anomalyScore: 0.96 },
    { hash: '6tRkWsxBnPm3vZqJ', from: '3Rtz...pQ8w', to: '7xKp...mN3q', amount: 61200,  timestamp: '2024-01-15T14:18:27Z', anomalyScore: 0.95 },
    { hash: '5nBvLqmKtWr8pZxN', from: '4Hvx...jL7b', to: '6Mds...cR2n', amount: 12800,  timestamp: '2024-01-15T14:42:18Z', anomalyScore: 0.62 },
    { hash: '0pKtRwzQmBn4vZsL', from: '7xKp...mN3q', to: '3Rtz...pQ8w', amount: 58900,  timestamp: '2024-01-15T15:10:55Z', anomalyScore: 0.88 },
  ],
  summary: { totalVolume: 14_830_000, volumeAnomalies: 2_400_000, circularTrades: 34 },
  gnnConfidence: 0.914,
  f1Score: 0.89,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface WashTradeResult {
  riskScore: number;
  suspiciousWallets: Array<{ wallet: string; volume: number; confidence: number; pattern: string }>;
  transactions: Array<{ hash: string; from: string; to: string; amount: number; timestamp: string; anomalyScore: number }>;
  summary: { totalVolume: number; volumeAnomalies: number; circularTrades: number };
  gnnConfidence: number;
  f1Score: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const RiskGauge: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  return (
    <div className={styles.gaugeWrap}>
      <svg width="140" height="82" viewBox="0 0 140 82">
        <path d="M16,70 A54,54 0 0,1 124,70" fill="none" stroke="var(--border-light)" strokeWidth="10" strokeLinecap="round"/>
        <path d="M16,70 A54,54 0 0,1 124,70" fill="none" stroke="#e24b4a" strokeWidth="10" strokeLinecap="round" strokeDasharray="170" strokeDashoffset="17"/>
        <text x="70" y="62" textAnchor="middle" fontSize="24" fontWeight="500" fill="#e24b4a">{score}</text>
        <text x="70" y="76" textAnchor="middle" fontSize="10" fill="var(--text-secondary)">/100</text>
      </svg>
      <span className={`${styles.riskBadge} ${styles.riskHigh}`} style={{ fontSize: '12px', padding: '4px 14px', marginTop: '4px' }}>
        {label}
      </span>
    </div>
  );
};

const FeatureBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const color = value >= 0.85 ? '#e24b4a' : value >= 0.7 ? '#ef9f27' : '#639922';
  return (
    <div className={styles.featureRow}>
      <span className={styles.featureLabel}>{label}</span>
      <div className={styles.featureBarBg}>
        <div className={styles.featureBarFill} style={{ width: `${value * 100}%`, background: color }} />
      </div>
      <span className={styles.featureScore} style={{ color }}>{value.toFixed(2)}</span>
    </div>
  );
};

const NetworkGraph: React.FC = () => (
  <div className={styles.graphContainer}>
    <svg viewBox="0 0 560 260" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <defs>
        <marker id="arr-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#e24b4a" opacity=".85" />
        </marker>
        <marker id="arr-gray" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--graph-node-stroke)" opacity=".7" />
        </marker>
      </defs>

      <ellipse cx="190" cy="130" rx="95" ry="75" fill="rgba(226,75,74,0.07)" stroke="#e24b4a" strokeWidth="1" strokeDasharray="5,3" opacity=".8" />
      <text x="190" y="218" textAnchor="middle" fontSize="10" fill="#a32d2d">Wash Cluster A</text>

      {[
        ['M128,100','Q158,78','190,88'],
        ['M190,88','Q232,82','252,112'],
        ['M252,112','Q245,155','222,170'],
        ['M222,170','Q180,180','155,162'],
        ['M155,162','Q128,140','128,100'],
      ].map(([m, q, e], i) => (
        <path key={i} d={`${m} ${q} ${e}`} fill="none" stroke="#e24b4a" strokeWidth="1.8" markerEnd="url(#arr-red)" />
      ))}
      <line x1="190" y1="88" x2="222" y2="170" stroke="#e24b4a" strokeWidth="1.2" strokeDasharray="4,3" opacity=".45" />

      <line x1="252" y1="112" x2="330" y2="148" stroke="#ef9f27" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#arr-gray)" />

      {[
        [370,110,430,88],[430,88,484,115],[484,115,462,168],[462,168,370,110],
        [330,148,370,110],[330,148,462,168],
      ].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--graph-line)" strokeWidth="1.2" opacity=".8" markerEnd="url(#arr-gray)" />
      ))}

      {[
        [128,100,'W1','#f0958b','#e24b4a','#501313'],
        [190,88,'W2','#e24b4a','#a32d2d','#fcebeb'],
        [252,112,'W3','#f0958b','#e24b4a','#501313'],
        [222,170,'W4','#f7c1c1','#e24b4a','#501313'],
        [155,162,'W5','#f7c1c1','#e24b4a','#501313'],
      ].map(([cx,cy,label,fill,stroke,textFill]) => (
        <g key={String(label)}>
          <circle cx={Number(cx)} cy={Number(cy)} r={label==='W2'?18:14} fill={String(fill)} stroke={String(stroke)} strokeWidth="2" />
          <text x={Number(cx)} y={Number(cy)+4} textAnchor="middle" fontSize="9" fill={String(textFill)} fontWeight="500">{String(label)}</text>
        </g>
      ))}

      <circle cx="330" cy="148" r="12" fill="#fac775" stroke="#ba7517" strokeWidth="1.5" />
      <text x="330" y="152" textAnchor="middle" fontSize="9" fill="#412402">B</text>

      {[[370,110,'N1'],[430,88,'N2'],[484,115,'N3'],[462,168,'N4']].map(([cx,cy,lbl])=>(
        <g key={String(lbl)}>
          <circle cx={Number(cx)} cy={Number(cy)} r="12" fill="var(--graph-node-normal)" stroke="var(--graph-node-stroke)" strokeWidth="1.5"/>
          <text x={Number(cx)} y={Number(cy)+4} textAnchor="middle" fontSize="9" fill="var(--graph-text)">{String(lbl)}</text>
        </g>
      ))}

      <text x="14" y="250" fontSize="10" fill="var(--text-muted)">⏱ Giao dịch vòng tròn phát hiện lúc 14:32:18 UTC</text>
    </svg>
    <div className={styles.graphLegend}>
      {[
        { color: '#e24b4a', label: 'Ví wash trading' },
        { color: '#ef9f27', label: 'Ví trung gian' },
        { color: 'var(--graph-node-stroke)', label: 'Ví bình thường' },
      ].map(({ color, label }) => (
        <span key={label} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: color }} />
          {label}
        </span>
      ))}
      <span className={styles.legendItem}>
        <span className={styles.legendLine} />
        Circular flow
      </span>
    </div>
  </div>
);

const WalletRow: React.FC<{ wallet: string; txns: number; desc: string; gnnScore: number; risk: 'High' | 'Medium' | 'Low' }> = ({ wallet, txns, desc, gnnScore, risk }) => (
  <div className={styles.walletRow}>
    <div className={styles.walletInfo}>
      <span className={styles.walletAddr}>{wallet}</span>
      <span className={styles.walletDesc}>{txns} txns · {desc}</span>
    </div>
    <span className={styles.walletGnn}>GNN: {gnnScore.toFixed(2)}</span>
    <span className={`${styles.riskBadge} ${styles[`risk${risk}`]}`}>{risk}</span>
  </div>
);

const LogItem: React.FC<{ time: string; text: string; color: string }> = ({ time, text, color }) => (
  <div className={styles.logItem}>
    <span className={styles.logTime}>{time}</span>
    <span className={styles.logDot} style={{ background: color }} />
    <span className={styles.logText}>{text}</span>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const WashTradingPage: React.FC = () => {
  const { theme } = useUserTheme(); // Lấy theme từ Context
  const isLight = theme === 'light';

  const [token, setToken] = useState<string>('BONK');
  const [timeframe, setTimeframe] = useState<'Last 24h' | 'Last 7d' | 'Last 30d'>('Last 24h');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<WashTradeResult>(MOCK_RESULT);
  const [algoTab, setAlgoTab] = useState<'GCN' | 'GAT' | 'GraphSAGE'>('GCN');
  const [walletFilter, setWalletFilter] = useState<'All' | 'High risk' | 'New'>('All');

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    await new Promise(r => setTimeout(r, 1400));
    setResult(MOCK_RESULT);
    setIsAnalyzing(false);
  };

  const filteredWallets = result.suspiciousWallets.filter(w => {
    if (walletFilter === 'High risk') return w.confidence > 85;
    if (walletFilter === 'New') return w.confidence >= 70 && w.confidence < 85;
    return true;
  });

  return (
    <PageWrapper> 
      <div className={`${styles.page} ${isLight ? styles.light : ''}`} style={{ paddingTop: '1rem' }}>
      
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.pageIcon}>◎</span>
          <h1 className={styles.pageTitle}>Wash Trading Detection</h1>
          <span className={styles.suspiciousBadge}>6 Suspicious</span>
        </div>
        <div className={styles.topbarRight}>
          <select className={styles.tokenSelect} value={token} onChange={e => setToken(e.target.value)}>
            {['BONK','WIF','POPCAT','JTO'].map(t => <option key={t}>Token: {t}</option>)}
          </select>
          <button className={styles.btnSecondary} onClick={() => setTimeframe(prev => prev)}>
            <span className={styles.btnIcon}></span>
            {timeframe}
          </button>
          <button className={`${styles.btnPrimary} ${isAnalyzing ? styles.loading : ''}`} onClick={handleAnalyze} disabled={isAnalyzing}>
            <span className={styles.btnIcon}></span>
            {isAnalyzing ? 'Đang phân tích...' : 'AI Analyze ↗'}
          </button>
        </div>
      </div>

      <div className={styles.metricsGrid}>
        {[
          { label: 'Total Transactions', value: '14,832', sub: '↑ +38% so với hôm qua', subColor: '#e24b4a' },
          { label: 'Wash Volume Detected', value: `$${(result.summary.volumeAnomalies / 1e6).toFixed(1)}M`, sub: '16.2% tổng volume', subColor: '#e24b4a' },
          { label: 'Suspicious Wallets', value: String(result.suspiciousWallets.length + 17), sub: '6 mới trong 1h', subColor: '#ef9f27' },
          { label: 'GNN Confidence', value: `${(result.gnnConfidence * 100).toFixed(1)}%`, sub: `↓ F1-Score: ${result.f1Score}`, subColor: '#639922' },
        ].map(({ label, value, sub, subColor }) => (
          <div key={label} className={styles.metricCard}>
            <div className={styles.metricLabel}>{label}</div>
            <div className={styles.metricValue}>{value}</div>
            <div className={styles.metricSub} style={{ color: subColor }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.leftCol}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>🔗</span>
              <h2 className={styles.cardTitle}>Transaction Graph — GNN Cluster View</h2>
              <div className={styles.algoTabs}>
                {(['GCN','GAT','GraphSAGE'] as const).map(t => (
                  <button key={t}
                    className={`${styles.algoTab} ${algoTab === t ? styles.algoTabActive : ''}`}
                    onClick={() => setAlgoTab(t)}
                  >{t}</button>
                ))}
              </div>
            </div>
            <NetworkGraph />
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>🔍</span>
              <h2 className={styles.cardTitle}>Suspicious Wallets</h2>
              <div className={styles.walletTabs}>
                {(['All','High risk','New'] as const).map(f => (
                  <button key={f}
                    className={`${styles.walletTab} ${walletFilter === f ? styles.walletTabActive : ''}`}
                    onClick={() => setWalletFilter(f)}
                  >{f}</button>
                ))}
              </div>
            </div>
            <div className={styles.walletList}>
              {filteredWallets.map((w, i) => {
                const risk = w.confidence > 85 ? 'High' : w.confidence >= 70 ? 'Medium' : 'Low';
                const descs = ['Vòng tròn 6 hop · SOL ↔ BONK','Thời gian đều nhau · Multi-hop','Volume bất thường · DEX: Raydium','Slippage thấp bất thường'];
                return (
                  <WalletRow
                    key={w.wallet}
                    wallet={w.wallet}
                    txns={[147,89,62,34,28,21][i] || 18}
                    desc={descs[i] || 'Pattern phức tạp'}
                    gnnScore={w.confidence / 100}
                    risk={risk as 'High' | 'Medium' | 'Low'}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>🛡</span>
              <h2 className={styles.cardTitle}>Risk Score — W2</h2>
            </div>
            <RiskGauge score={94} label="Wash Trading" />
            <div className={styles.featuresSection}>
              {[
                { label: 'Circular pattern',  value: 0.95 },
                { label: 'Time regularity',   value: 0.88 },
                { label: 'Amount similarity', value: 0.92 },
                { label: 'Self-loop degree',  value: 0.78 },
                { label: 'Wallet age',        value: 0.60 },
              ].map(f => <FeatureBar key={f.label} {...f} />)}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>⏱</span>
              <h2 className={styles.cardTitle}>Detection Log</h2>
            </div>
            <div className={styles.logList}>
              {[
                { time:'14:32', text:'GNN phát hiện circular flow 6 hop — Cluster A',       color:'#e24b4a' },
                { time:'14:28', text:'Volume spike bất thường +340% trong 2 phút',           color:'#ef9f27' },
                { time:'14:15', text:'Ví W2 tạo 23 giao dịch với interval đều 3.2s',         color:'#e24b4a' },
                { time:'13:58', text:'Cluster B — false positive, đã dismiss',               color:'var(--text-muted)' },
                { time:'13:41', text:'Model retrain hoàn tất — F1: 0.89',                    color:'#639922' },
              ].map(item => <LogItem key={item.time} {...item} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
    </PageWrapper>
  );
};

export default WashTradingPage;