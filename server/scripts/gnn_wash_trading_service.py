"""
Wash Trading Detection GNN Service
Flask API for Graph Neural Network-based anomaly detection on Solana transactions
"""

from flask import Flask, request, jsonify
from typing import Dict, List, Set, Tuple
import numpy as np
import networkx as nx
from datetime import datetime, timedelta
import logging

# Optional: Uncomment if using PyTorch for GNN
# import torch
# from torch_geometric.nn import GraphSAGE, GAT

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SolanaTransactionGraph:
    """Build and analyze transaction graphs for anomaly detection"""
    
    def __init__(self):
        self.graph = nx.DiGraph()
        self.node_features = {}
        self.edge_features = {}
    
    def build_graph(self, transactions: List[Dict]) -> None:
        """
        Build transaction graph from transaction data
        
        Args:
            transactions: List of transaction dicts with:
                - from_address, to_address, amount, timestamp, hash
        """
        for tx in transactions:
            from_addr = tx['from_address']
            to_addr = tx['to_address']
            amount = tx['amount']
            timestamp = tx['timestamp']
            
            # Add nodes
            if from_addr not in self.graph:
                self.node_features[from_addr] = self._extract_node_features(from_addr, transactions)
                self.graph.add_node(from_addr)
            
            if to_addr not in self.graph:
                self.node_features[to_addr] = self._extract_node_features(to_addr, transactions)
                self.graph.add_node(to_addr)
            
            # Add edge with features
            self.graph.add_edge(from_addr, to_addr)
            edge_key = (from_addr, to_addr)
            if edge_key not in self.edge_features:
                self.edge_features[edge_key] = []
            
            self.edge_features[edge_key].append({
                'amount': amount,
                'timestamp': timestamp,
                'hash': tx.get('hash', '')
            })
    
    def _extract_node_features(self, wallet: str, transactions: List[Dict]) -> Dict:
        """Extract statistical features for a wallet node"""
        wallet_txs = [t for t in transactions 
                     if t['from_address'] == wallet or t['to_address'] == wallet]
        
        amounts = [t['amount'] for t in wallet_txs]
        
        return {
            'in_degree': sum(1 for t in wallet_txs if t['to_address'] == wallet),
            'out_degree': sum(1 for t in wallet_txs if t['from_address'] == wallet),
            'volume': sum(amounts),
            'avg_amount': np.mean(amounts) if amounts else 0,
            'std_amount': np.std(amounts) if amounts else 0,
            'tx_count': len(wallet_txs),
            'is_bot': False  # Will be set by ML model
        }
    
    def detect_circular_patterns(self) -> List[Tuple]:
        """Find circular payment patterns (A→B→C→A)"""
        cycles = []
        
        # Find all simple cycles of length 3
        for node in self.graph.nodes():
            for cycle in nx.simple_cycles(self.graph, length_bound=4):
                if len(cycle) >= 3 and node in cycle:
                    # Verify amounts are similar (within tolerance)
                    edges = [(cycle[i], cycle[(i+1) % len(cycle)]) 
                            for i in range(len(cycle))]
                    amounts = []
                    
                    for from_n, to_n in edges:
                        if (from_n, to_n) in self.edge_features:
                            edge_data = self.edge_features[(from_n, to_n)]
                            if edge_data:
                                amounts.append(edge_data[0]['amount'])
                    
                    if amounts and len(set(amounts)) <= 2:  # Similar amounts
                        cycles.append(cycle)
        
        return list(set(tuple(sorted(c)) for c in cycles))  # Deduplicate
    
    def detect_star_topology(self) -> List[Tuple[str, int, int]]:
        """Detect star topology: hub wallet with many spokes"""
        stars = []
        
        for node in self.graph.nodes():
            in_degree = self.graph.in_degree(node)
            out_degree = self.graph.out_degree(node)
            total_degree = in_degree + out_degree
            
            # A hub has many connections
            if total_degree > 20:
                stars.append((node, in_degree, out_degree))
        
        return sorted(stars, key=lambda x: x[1] + x[2], reverse=True)
    
    def anomaly_score_gnn(self) -> Dict[str, float]:
        """
        Compute anomaly scores using GNN principles
        
        Returns:
            Dict mapping wallet addresses to anomaly scores (0-1)
        """
        scores = {}
        
        # Method 1: PageRank-based anomaly
        pagerank = nx.pagerank(self.graph)
        
        # Method 2: Local clustering coefficient
        clustering = nx.clustering(self.graph.to_undirected())
        
        # Method 3: Node degree anomaly
        degrees = dict(self.graph.degree())
        mean_degree = np.mean(list(degrees.values())) if degrees else 0
        
        for node in self.graph.nodes():
            features = self.node_features.get(node, {})
            
            # Combine signals
            degree_anomaly = abs(degrees[node] - mean_degree) / (mean_degree + 1)
            clustering_anomaly = clustering.get(node, 0)  # High clustering = anomalous
            pagerank_anomaly = 1 - pagerank.get(node, 0)  # Low pagerank = anomalous
            
            # Volume anomaly (standard deviation from mean)
            volumes = [f['volume'] for f in self.node_features.values()]
            vol_mean = np.mean(volumes) if volumes else 0
            vol_std = np.std(volumes) if volumes else 1
            volume_anomaly = abs(features.get('volume', 0) - vol_mean) / (vol_std + 1) / 3
            
            # Weighted combination
            composite_score = (
                0.3 * degree_anomaly +
                0.3 * clustering_anomaly +
                0.2 * pagerank_anomaly +
                0.2 * volume_anomaly
            )
            
            scores[node] = min(1.0, max(0.0, composite_score))
        
        return scores
    
    def get_suspicious_wallets(self, threshold: float = 0.7) -> List[Dict]:
        """Get wallets with anomaly score above threshold"""
        scores = self.anomaly_score_gnn()
        
        suspicious = []
        for wallet, score in scores.items():
            if score >= threshold:
                suspicious.append({
                    'wallet': wallet,
                    'anomaly_score': float(score),
                    'features': self.node_features.get(wallet, {}),
                    'confidence': float(score)
                })
        
        return sorted(suspicious, key=lambda x: x['anomaly_score'], reverse=True)


# API Endpoints

@app.route('/api/gnn/analyze', methods=['POST'])
def analyze_wash_trading():
    """Main analysis endpoint"""
    try:
        data = request.json
        transactions = data.get('transactions', [])
        mint = data.get('mint', 'unknown')
        
        logger.info(f"Analyzing {len(transactions)} transactions for {mint}")
        
        # Build graph
        graph = SolanaTransactionGraph()
        graph.build_graph(transactions)
        
        # Detect patterns
        circular = graph.detect_circular_patterns()
        stars = graph.detect_star_topology()
        suspicious = graph.get_suspicious_wallets(threshold=0.6)
        
        return jsonify({
            'success': True,
            'mint': mint,
            'circular_trades': len(circular),
            'star_topologies': len(stars),
            'suspicious_wallets': suspicious,
            'circular_patterns': [list(c) for c in circular[:10]],
            'star_hubs': [{'wallet': s[0], 'in_degree': s[1], 'out_degree': s[2]} 
                         for s in stars[:5]]
        })
    
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/gnn/scores', methods=['POST'])
def get_anomaly_scores():
    """Get individual anomaly scores"""
    try:
        data = request.json
        transactions = data.get('transactions', [])
        
        graph = SolanaTransactionGraph()
        graph.build_graph(transactions)
        scores = graph.anomaly_score_gnn()
        
        return jsonify({
            'success': True,
            'scores': scores
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'wash-trading-gnn'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
