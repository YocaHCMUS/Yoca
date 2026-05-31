import React, { useState, useEffect } from 'react';
import styles from './wash-trading.module.scss';
import { PageWrapper } from '@/components/wrapper/PageWrapper';
import { SearchBar } from '@/components/search/SearchBar';
import { Table } from '@/components/tables/Table';
import ReactECharts from 'echarts-for-react';

interface WashTradeResult {
  riskScore: number;
  suspiciousWallets: Array<{
    wallet: string;
    volume: number;
    confidence: number;
    pattern: string;
  }>;
  transactions: Array<{
    hash: string;
    from: string;
    to: string;
    amount: number;
    timestamp: string;
    anomalyScore: number;
  }>;
  summary: {
    totalVolume: number;
    volumeAnomalies: number;
    circularTrades: number;
  };
}

const WashTradingPage: React.FC = () => {
  const [targetAddress, setTargetAddress] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<WashTradeResult | null>(null);
  const [selectedTab, setSelectedTab] = useState<'network' | 'patterns' | 'timeline'>('network');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const handleAnalyze = async (address: string) => {
    setTargetAddress(address);
    setIsAnalyzing(true);
    try {
      // API call to backend: GET /api/v1/wash-trading/analyze?token=address
      const response = await fetch(`/api/v1/wash-trading/analyze?token=${address}`);
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      setAnalysisResult(data);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Network graph configuration for transaction topology
  const getNetworkGraph = () => {
    if (!analysisResult) return {};

    const nodes = analysisResult.suspiciousWallets.map((w, i) => ({
      name: w.wallet,
      symbolSize: Math.min(50, 20 + w.confidence),
      itemStyle: {
        color: w.confidence > 90 ? '#ff4d4f' : w.confidence > 70 ? '#faad14' : '#1890ff'
      },
      value: w.volume
    }));

    const links = analysisResult.transactions
      .filter(t => t.anomalyScore > 0.7)
      .map(t => ({
        source: t.from,
        target: t.to,
        value: t.amount,
        lineStyle: { color: `rgba(255, ${Math.round(77 * (1 - t.anomalyScore))}, 79, 0.5)` }
      }));

    return {
      tooltip: { 
        formatter: (p: any) => p.name ? `${p.name}<br/>Score: ${p.value}` : `${p.data?.value || 0} SOL`
      },
      series: [{
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: links,
        force: { repulsion: 300, edgeLength: 120 },
        lineStyle: { width: 2, curveness: 0.2 },
        roam: true,
        label: { show: true, position: 'right', fontSize: 12 }
      }]
    };
  };

  // Risk score timeline chart
  const getTimelineChart = () => {
    if (!analysisResult) return {};

    const txByTime = analysisResult.transactions
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'time', boundaryGap: false },
      yAxis: { name: 'Anomaly Score', max: 1 },
      series: [{
        data: txByTime.map(t => [t.timestamp, t.anomalyScore]),
        type: 'line',
        smooth: true,
        areaStyle: { color: 'rgba(255, 77, 79, 0.3)' },
        lineStyle: { color: '#ff4d4f', width: 2 }
      }],
      grid: { left: '3%', right: '3%', bottom: '3%', containLabel: true }
    };
  };

  // Pattern frequency distribution
  const getPatternChart = () => {
    if (!analysisResult) return {};

    const patterns = analysisResult.suspiciousWallets.reduce((acc, w) => {
      acc[w.pattern] = (acc[w.pattern] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      tooltip: { trigger: 'item' },
      series: [{
        data: Object.entries(patterns).map(([name, value]) => ({ name, value })),
        type: 'pie',
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
      }]
    };
  };

  const getFilteredWallets = () => {
    if (!analysisResult) return [];
    return analysisResult.suspiciousWallets.filter(w => {
      if (riskFilter === 'all') return true;
      if (riskFilter === 'high') return w.confidence > 85;
      if (riskFilter === 'medium') return w.confidence >= 70 && w.confidence <= 85;
      if (riskFilter === 'low') return w.confidence < 70;
      return true;
    });
  };

  return (
    <PageWrapper>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className="text-3xl font-bold mb-2">🔍 AI Wash Trading Detection</h1>
          <p className="text-gray-600 mb-6">
            Phát hiện hành vi thao túng khối lượng giao dịch sử dụng Graph Neural Networks và phân tích mô hình giao dịch
          </p>
          
          <div className="max-w-3xl">
            <div className="flex items-center w-full max-w-2xl bg-white border border-gray-200 rounded-lg px-4 py-2">
               <input 
               type="text" 
               className="w-full outline-none text-sm text-gray-700 bg-transparent"
               placeholder="Nhập địa chỉ Token Mint hoặc Pool Address..."
               value={targetAddress}
               onChange={(e) => setTargetAddress(e.target.value)}
               onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAnalyze(targetAddress);
               }}
               />
               <button 
               onClick={() => handleAnalyze(targetAddress)}
               className="ml-2 text-blue-600 font-medium hover:text-blue-800"
               >
               Phân tích
               </button>
               </div>
          </div>
        </div>

        {/* Risk Summary Cards */}
        {analysisResult && (
          <div className={styles.summaryCards}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Risk Score</div>
              <div className={`${styles.cardValue} ${analysisResult.riskScore > 70 ? 'text-red-600' : 'text-yellow-600'}`}>
                {(analysisResult.riskScore * 100).toFixed(1)}%
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Suspicious Wallets</div>
              <div className={styles.cardValue}>{analysisResult.suspiciousWallets.length}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Circular Trades</div>
              <div className={styles.cardValue}>{analysisResult.summary.circularTrades}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Total Volume Analyzed</div>
              <div className={styles.cardValue}>${(analysisResult.summary.totalVolume / 1e6).toFixed(2)}M</div>
            </div>
          </div>
        )}

        {isAnalyzing && (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p className="text-gray-600 mt-4">Phân tích giao dịch & xây dựng mô hình mạng lưới...</p>
          </div>
        )}

        {analysisResult && targetAddress && (
          <div className={styles.analysisSection}>
            {/* Tab Navigation */}
            <div className={styles.tabs}>
              <button 
                className={`${styles.tab} ${selectedTab === 'network' ? styles.active : ''}`}
                onClick={() => setSelectedTab('network')}
              >
                📊 Topology Mạng
              </button>
              <button 
                className={`${styles.tab} ${selectedTab === 'patterns' ? styles.active : ''}`}
                onClick={() => setSelectedTab('patterns')}
              >
                🎯 Mô Hình Gian Lận
              </button>
              <button 
                className={`${styles.tab} ${selectedTab === 'timeline' ? styles.active : ''}`}
                onClick={() => setSelectedTab('timeline')}
              >
                ⏱️ Timeline Bất Thường
              </button>
            </div>

            {/* Network Graph Tab */}
            {selectedTab === 'network' && (
              <div className={styles.chartSection}>
                <h2 className="text-lg font-semibold mb-4">Topology Mạng Lưới Giao Dịch</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Kích thước nút = độ tin cậy | Màu đỏ = cao nguy hiểm | Màu vàng = trung bình | Màu xanh = thấp
                </p>
                <div className={styles.chartContainer}>
                  <ReactECharts 
                    option={getNetworkGraph()} 
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'canvas' }}
                  />
                </div>
              </div>
            )}

            {/* Patterns Tab */}
            {selectedTab === 'patterns' && (
              <div className={styles.patternsSection}>
                <div className={styles.chartSmall}>
                  <h3 className="text-lg font-semibold mb-4">Phân Bố Mô Hình Gian Lận</h3>
                  <ReactECharts option={getPatternChart()} style={{ height: '300px' }} />
                </div>

                {/* Wallets Table */}
                <div className={styles.tableSection}>
                  <div className={styles.tableHeader}>
                    <h3 className="text-lg font-semibold">Ví Tình Nghi</h3>
                    <div className={styles.filterButtons}>
                      {(['all', 'high', 'medium', 'low'] as const).map(filter => (
                        <button 
                          key={filter}
                          className={`${styles.filterBtn} ${riskFilter === filter ? styles.active : ''}`}
                          onClick={() => setRiskFilter(filter)}
                        >
                          {filter === 'all' ? 'Tất Cả' : filter === 'high' ? 'Cao' : filter === 'medium' ? 'Trung' : 'Thấp'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Table 
                    columns={[
                      { key: 'wallet', title: 'Địa Chỉ Ví', dataIndex: 'wallet' },
                      { key: 'volume', title: 'Volume ($)', dataIndex: 'volume' },
                      { key: 'pattern', title: 'Mô Hình', dataIndex: 'pattern' },
                      { key: 'confidence', title: 'Độ Tin Cậy (%)', dataIndex: 'confidence' }
                    ]}
                    dataSource={getFilteredWallets().map(w => ({
                      ...w,
                      volume: `$${(w.volume / 1e6).toFixed(2)}M`,
                      confidence: `${(w.confidence * 100).toFixed(1)}%`
                    }))}
                  />
                </div>
              </div>
            )}

            {/* Timeline Tab */}
            {selectedTab === 'timeline' && (
              <div className={styles.chartSection}>
                <h2 className="text-lg font-semibold mb-4">Timeline Điểm Bất Thường Giao Dịch</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Mỗi điểm biểu thị mức độ bất thường (0-1) của giao dịch theo thời gian
                </p>
                <div className={styles.chartContainer}>
                  <ReactECharts 
                    option={getTimelineChart()} 
                    style={{ height: '400px' }}
                  />
                </div>
              </div>
            )}

            {/* Transactions Details */}
            <div className={styles.detailsSection}>
              <h3 className="text-lg font-semibold mb-4">Chi Tiết Giao Dịch Bất Thường</h3>
              <Table 
                columns={[
                  { key: 'hash', title: 'Hash', dataIndex: 'hash' },
                  { key: 'from', title: 'Từ', dataIndex: 'from' },
                  { key: 'to', title: 'Đến', dataIndex: 'to' },
                  { key: 'amount', title: 'Amount', dataIndex: 'amount' },
                  { key: 'timestamp', title: 'Thời Gian', dataIndex: 'timestamp' },
                  { key: 'anomalyScore', title: 'Điểm Bất Thường', dataIndex: 'anomalyScore' }
                ]}
                dataSource={analysisResult.transactions.map(t => ({
                  ...t,
                  hash: t.hash.slice(0, 8) + '...',
                  anomalyScore: `${(t.anomalyScore * 100).toFixed(1)}%`
                }))}
              />
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
};

export default WashTradingPage;