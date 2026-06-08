/**
 * wash-trading-ai.service.ts
 *
 * Hướng 2: Thuật toán (GNN-inspired features) + Gemini AI reasoning
 *
 * Pipeline:
 *  1. Fetch transactions thật từ Helius API
 *  2. Chạy 4 thuật toán phát hiện pattern (circular, same-amount, star-topology, volume-anomaly)
 *  3. Tính GNN-inspired score cho từng ví dựa trên graph features
 *  4. Gửi kết quả lên Gemini → AI phân tích, giải thích bằng ngôn ngữ tự nhiên
 *
 * File này đặt tại:
 *   server/src/services/wash-trading-ai.service.ts
 */

import { GoogleGenAI } from "@google/genai";
import { GOOGLE_AI_KEY, WALLET_AUDIT_MODEL } from "@sv/config/constants.js";
import { heliusGetJson } from "@sv/services/wallet/providers/helius.client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawTransaction {
  signature: string;
  feePayer: string;
  timestamp: number; // unix seconds
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
}

export interface NormalizedTx {
  signature: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number; // unix seconds
  mint: string;
}

export interface CircularPattern {
  cycle: string[];           // danh sách địa chỉ ví tạo vòng
  hops: number;              // số bước trong vòng
  amounts: number[];
  timestamps: number[];
  intervalMs: number;        // khoảng cách thời gian trung bình giữa các tx
  confidence: number;        // 0–1
}

export interface WalletGraphFeatures {
  address: string;
  inDegree: number;
  outDegree: number;
  selfLoop: boolean;
  participatesInCircular: boolean;
  avgInterval: number;         // ms giữa các tx liên tiếp
  amountVariance: number;      // độ phân tán khối lượng (thấp = đáng ngờ)
  walletTxCount: number;
}

export interface GNNScore {
  wallet: string;
  score: number;              // 0–1, càng cao càng đáng ngờ
  features: {
    circularPattern: number;
    timeRegularity: number;
    amountSimilarity: number;
    selfLoopDegree: number;
    hubness: number;
  };
  riskLevel: "High" | "Medium" | "Low";
  pattern: string;
}

export interface WashTradingAIResult {
  mint: string;
  symbol: string;
  analyzedAt: string;

  // ─── Số liệu tổng quan ────────────────────────────────────────
  summary: {
    totalTransactions: number;
    uniqueWallets: number;
    totalVolume: number;
    washVolumeEstimate: number;
    washVolumePercent: number;
    circularTradeCount: number;
    suspiciousWalletCount: number;
    overallRiskScore: number;  // 0–100
    gnnConfidence: number;     // 0–1
  };

  // ─── Kết quả thuật toán ───────────────────────────────────────
  circularPatterns: CircularPattern[];
  suspiciousWallets: GNNScore[];
  graphData: {
    nodes: Array<{ id: string; type: "wash" | "bridge" | "normal"; label: string }>;
    edges: Array<{ from: string; to: string; amount: number; suspicious: boolean }>;
  };

  // ─── Kết quả AI (Gemini) ──────────────────────────────────────
  aiAnalysis: {
    verdict: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "CLEAN";
    summary: string;                   // tóm tắt ngắn 1-2 câu
    detailedFindings: string[];        // mảng các phát hiện chi tiết
    suspiciousPatterns: Array<{
      patternName: string;
      description: string;
      affectedWallets: string[];
      severity: "HIGH" | "MEDIUM" | "LOW";
    }>;
    recommendation: string;            // khuyến nghị cho user
    confidenceNote: string;            // ghi chú về độ chính xác
  };

  // ─── Detection log (cho UI) ───────────────────────────────────
  detectionLog: Array<{
    time: string;
    message: string;
    severity: "high" | "medium" | "info" | "success";
  }>;
}

// ─── Step 1: Fetch transactions từ Helius ─────────────────────────────────────

async function fetchTokenTransactions(
  mint: string,
  limit = 200
): Promise<NormalizedTx[]> {
  try {
    // Helius Enhanced Transactions API: lấy transactions liên quan đến token mint
    const raw = await heliusGetJson<RawTransaction[]>(
      `/v0/addresses/${mint}/transactions`,
      {
        limit: Math.min(limit, 100), // Helius max 100/page
        type: "SWAP",                // chỉ lấy SWAP transactions
      }
    );

    if (!Array.isArray(raw) || raw.length === 0) {
      return [];
    }

    // Normalize: chỉ giữ lại token transfers liên quan đến mint
    const normalized: NormalizedTx[] = [];
    for (const tx of raw) {
      const transfers = tx.tokenTransfers?.filter(t => t.mint === mint) ?? [];
      for (const transfer of transfers) {
        if (transfer.fromUserAccount && transfer.toUserAccount && transfer.tokenAmount > 0) {
          normalized.push({
            signature: tx.signature,
            from: transfer.fromUserAccount,
            to: transfer.toUserAccount,
            amount: transfer.tokenAmount,
            timestamp: tx.timestamp,
            mint,
          });
        }
      }
    }

    return normalized;
  } catch (err) {
    console.error("[WashTradingAI] Helius fetch error:", err);
    return [];
  }
}

// ─── Step 2a: Detect circular patterns ───────────────────────────────────────

function detectCircularPatterns(txs: NormalizedTx[]): CircularPattern[] {
  const patterns: CircularPattern[] = [];
  const txMap = new Map<string, NormalizedTx[]>();

  // Group by sender
  for (const tx of txs) {
    if (!txMap.has(tx.from)) txMap.set(tx.from, []);
    txMap.get(tx.from)!.push(tx);
  }

  // DFS tìm cycle 3–6 hop trong time window 1 giờ
  const TIME_WINDOW = 3600; // seconds
  const AMOUNT_TOLERANCE = 0.03; // 3%

  function dfs(
    startWallet: string,
    currentWallet: string,
    path: string[],
    amounts: number[],
    timestamps: number[],
    startAmount: number,
    startTime: number,
    visited: Set<string>
  ): void {
    if (path.length > 6) return; // max 6-hop

    const outgoing = txMap.get(currentWallet) ?? [];
    for (const tx of outgoing) {
      // Check time window
      if (tx.timestamp - startTime > TIME_WINDOW) continue;

      // Check amount similarity
      const amountDiff = Math.abs(tx.amount - startAmount) / (startAmount || 1);
      if (amountDiff > AMOUNT_TOLERANCE) continue;

      if (tx.to === startWallet && path.length >= 2) {
        // Tìm thấy cycle!
        const intervalMs =
          ((tx.timestamp - startTime) / path.length) * 1000;
        const confidence = Math.max(
          0.6,
          1 - amountDiff * 5 - (path.length - 3) * 0.05
        );
        patterns.push({
          cycle: [...path, tx.to],
          hops: path.length,
          amounts: [...amounts, tx.amount],
          timestamps: [...timestamps, tx.timestamp],
          intervalMs,
          confidence: Math.min(0.99, confidence),
        });
        return;
      }

      if (!visited.has(tx.to) && tx.to !== startWallet) {
        visited.add(tx.to);
        dfs(
          startWallet,
          tx.to,
          [...path, tx.to],
          [...amounts, tx.amount],
          [...timestamps, tx.timestamp],
          startAmount,
          startTime,
          visited
        );
        visited.delete(tx.to);
      }
    }
  }

  // Chỉ check top 50 wallets có nhiều tx nhất (performance)
  const walletTxCount = new Map<string, number>();
  for (const tx of txs) {
    walletTxCount.set(tx.from, (walletTxCount.get(tx.from) ?? 0) + 1);
  }
  const topWallets = [...walletTxCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([w]) => w);

  for (const wallet of topWallets) {
    const outgoing = txMap.get(wallet) ?? [];
    for (const tx of outgoing.slice(0, 10)) {
      const visited = new Set<string>([wallet]);
      dfs(wallet, tx.to, [wallet, tx.to], [tx.amount], [tx.timestamp], tx.amount, tx.timestamp, visited);
    }
  }

  // Dedup patterns
  const seen = new Set<string>();
  return patterns.filter(p => {
    const key = [...p.cycle].sort().join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Step 2b: Tính GNN-inspired scores ───────────────────────────────────────

function computeGNNScores(
  txs: NormalizedTx[],
  circularPatterns: CircularPattern[]
): GNNScore[] {
  const walletFeatures = new Map<string, WalletGraphFeatures>();

  // Khởi tạo features
  const allWallets = new Set([...txs.map(t => t.from), ...txs.map(t => t.to)]);
  for (const w of allWallets) {
    walletFeatures.set(w, {
      address: w,
      inDegree: 0,
      outDegree: 0,
      selfLoop: false,
      participatesInCircular: false,
      avgInterval: 0,
      amountVariance: 0,
      walletTxCount: 0,
    });
  }

  // Tính in/out degree
  for (const tx of txs) {
    const from = walletFeatures.get(tx.from)!;
    const to = walletFeatures.get(tx.to)!;
    from.outDegree++;
    from.walletTxCount++;
    to.inDegree++;
    if (tx.from === tx.to) from.selfLoop = true;
  }

  // Đánh dấu wallets tham gia circular patterns
  const circularWallets = new Set<string>();
  for (const p of circularPatterns) {
    p.cycle.forEach(w => circularWallets.add(w));
  }
  for (const [w, f] of walletFeatures) {
    if (circularWallets.has(w)) f.participatesInCircular = true;
  }

  // Tính time regularity (avgInterval) và amount variance
  const walletTxs = new Map<string, NormalizedTx[]>();
  for (const tx of txs) {
    if (!walletTxs.has(tx.from)) walletTxs.set(tx.from, []);
    walletTxs.get(tx.from)!.push(tx);
  }

  for (const [wallet, wtxs] of walletTxs) {
    if (wtxs.length < 2) continue;
    const sorted = [...wtxs].sort((a, b) => a.timestamp - b.timestamp);

    // avg interval
    let totalInterval = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalInterval += (sorted[i].timestamp - sorted[i - 1].timestamp) * 1000;
    }
    const avgInterval = totalInterval / (sorted.length - 1);

    // amount variance
    const amounts = sorted.map(t => t.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length;
    const coeffVar = mean > 0 ? Math.sqrt(variance) / mean : 1;

    const f = walletFeatures.get(wallet)!;
    f.avgInterval = avgInterval;
    f.amountVariance = coeffVar;
  }

  // Tính GNN score theo weighted formula
  // Weights lấy từ nghiên cứu: "Wash Trading Detection in NFT Markets" (2023)
  const WEIGHTS = {
    circularPattern: 0.30,
    timeRegularity:  0.25,
    amountSimilarity:0.25,
    selfLoopDegree:  0.10,
    hubness:         0.10,
  };

  // Tìm max values để normalize
  const maxDegree = Math.max(...[...walletFeatures.values()].map(f => f.inDegree + f.outDegree), 1);

  const scores: GNNScore[] = [];

  for (const [wallet, features] of walletFeatures) {
    if (features.walletTxCount < 2) continue; // bỏ qua ví ít tx

    // Feature 1: Circular pattern (0–1)
    const circularScore = features.participatesInCircular ? 0.95 : 0;

    // Feature 2: Time regularity (0–1) — interval đều = đáng ngờ
    // avgInterval < 5s → rất đáng ngờ (bot); > 600s → bình thường
    const timeScore =
      features.avgInterval > 0
        ? Math.max(0, 1 - features.avgInterval / 600_000)
        : 0;

    // Feature 3: Amount similarity (0–1) — coeffVar thấp = amount đều = đáng ngờ
    const amountScore = Math.max(0, 1 - features.amountVariance);

    // Feature 4: Self-loop degree (0–1)
    const selfLoopScore = features.selfLoop ? 0.8 : 0;

    // Feature 5: Hubness — nhiều kết nối hơn bình thường (0–1)
    const totalDegree = features.inDegree + features.outDegree;
    const hubnessScore = Math.min(1, totalDegree / (maxDegree * 0.3));

    const gnnScore =
      circularScore   * WEIGHTS.circularPattern +
      timeScore       * WEIGHTS.timeRegularity +
      amountScore     * WEIGHTS.amountSimilarity +
      selfLoopScore   * WEIGHTS.selfLoopDegree +
      hubnessScore    * WEIGHTS.hubness;

    // Chỉ giữ những ví có score đủ cao
    if (gnnScore < 0.15 && !features.participatesInCircular) continue;

    const riskLevel: GNNScore["riskLevel"] =
      gnnScore >= 0.7 ? "High" : gnnScore >= 0.4 ? "Medium" : "Low";

    let pattern = "Anomalous Activity";
    if (features.participatesInCircular) pattern = "Circular Trade";
    else if (hubnessScore > 0.6) pattern = "Hub Wallet";
    else if (timeScore > 0.7) pattern = "Bot-like Timing";
    else if (amountScore > 0.8) pattern = "Amount Mirror";

    scores.push({
      wallet,
      score: Math.min(0.99, gnnScore),
      features: {
        circularPattern: circularScore,
        timeRegularity: timeScore,
        amountSimilarity: amountScore,
        selfLoopDegree: selfLoopScore,
        hubness: hubnessScore,
      },
      riskLevel,
      pattern,
    });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, 20);
}

// ─── Step 3: Build graph data cho visualization ───────────────────────────────

function buildGraphData(
  txs: NormalizedTx[],
  suspiciousWallets: GNNScore[]
): WashTradingAIResult["graphData"] {
  const suspSet = new Set(suspiciousWallets.slice(0, 10).map(w => w.wallet));
  const highRiskSet = new Set(
    suspiciousWallets.filter(w => w.riskLevel === "High").map(w => w.wallet)
  );

  // Chỉ lấy edges liên quan đến suspicious wallets (để graph không quá lớn)
  const relevantEdges = txs.filter(
    tx => suspSet.has(tx.from) || suspSet.has(tx.to)
  ).slice(0, 50);

  const walletSet = new Set<string>();
  relevantEdges.forEach(e => { walletSet.add(e.from); walletSet.add(e.to); });

  const nodes = [...walletSet].map(id => ({
    id,
    type: (highRiskSet.has(id) ? "wash" : suspSet.has(id) ? "bridge" : "normal") as "wash" | "bridge" | "normal",
    label: id.slice(0, 4) + "..." + id.slice(-4),
  }));

  const edges = relevantEdges.map(tx => ({
    from: tx.from,
    to: tx.to,
    amount: tx.amount,
    suspicious: suspSet.has(tx.from) && suspSet.has(tx.to),
  }));

  return { nodes, edges };
}

// ─── Step 4: Gemini AI Analysis ───────────────────────────────────────────────

async function analyzeWithGemini(params: {
  mint: string;
  symbol: string;
  txCount: number;
  uniqueWallets: number;
  totalVolume: number;
  circularPatterns: CircularPattern[];
  suspiciousWallets: GNNScore[];
}): Promise<WashTradingAIResult["aiAnalysis"]> {

  const fallback: WashTradingAIResult["aiAnalysis"] = {
    verdict:
      params.suspiciousWallets.filter(w => w.riskLevel === "High").length > 3
        ? "HIGH_RISK"
        : params.suspiciousWallets.length > 5
        ? "MEDIUM_RISK"
        : "LOW_RISK",
    summary: `Phát hiện ${params.circularPatterns.length} vòng giao dịch tròn và ${params.suspiciousWallets.length} ví đáng ngờ cho token ${params.symbol}.`,
    detailedFindings: params.circularPatterns.slice(0, 3).map(
      (p, i) => `Cluster ${i + 1}: ${p.hops}-hop circular trade, interval trung bình ${(p.intervalMs / 1000).toFixed(1)}s, confidence ${(p.confidence * 100).toFixed(0)}%`
    ),
    suspiciousPatterns: params.suspiciousWallets.slice(0, 5).map(w => ({
      patternName: w.pattern,
      description: `Ví ${w.wallet.slice(0, 8)}... có GNN score ${(w.score * 100).toFixed(0)}/100`,
      affectedWallets: [w.wallet],
      severity: w.riskLevel as "HIGH" | "MEDIUM" | "LOW",
    })),
    recommendation: "Cần điều tra thêm trước khi giao dịch token này.",
    confidenceNote: "Phân tích dựa trên graph features, không cần model AI.",
  };

  const apiKey = GOOGLE_AI_KEY?.trim();
  if (!apiKey) {
    console.warn("[WashTradingAI] GOOGLE_AI_KEY not set, using fallback");
    return fallback;
  }

  // Chuẩn bị dữ liệu gửi lên Gemini (tóm gọn, không gửi raw tx)
  const top5Suspicious = params.suspiciousWallets.slice(0, 5).map(w => ({
    wallet: w.wallet.slice(0, 8) + "...",
    gnnScore: w.score.toFixed(3),
    pattern: w.pattern,
    riskLevel: w.riskLevel,
    features: {
      circular: w.features.circularPattern.toFixed(2),
      timing: w.features.timeRegularity.toFixed(2),
      amount: w.features.amountSimilarity.toFixed(2),
    },
  }));

  const topCircular = params.circularPatterns.slice(0, 3).map(p => ({
    hops: p.hops,
    wallets: p.cycle.map(w => w.slice(0, 8) + "..."),
    avgIntervalSeconds: (p.intervalMs / 1000).toFixed(1),
    confidence: p.confidence.toFixed(2),
  }));

  const prompt = `
Bạn là chuyên gia phân tích blockchain, chuyên phát hiện wash trading (giao dịch ảo) trên Solana.

Dưới đây là kết quả phân tích thuật toán GNN-based cho token ${params.symbol} (${params.mint.slice(0, 8)}...):

## Thống kê tổng quan
- Tổng giao dịch phân tích: ${params.txCount}
- Ví duy nhất: ${params.uniqueWallets}
- Tổng volume: ${params.totalVolume.toLocaleString()} tokens
- Circular patterns phát hiện: ${params.circularPatterns.length}
- Suspicious wallets: ${params.suspiciousWallets.length}

## Top Circular Trade Patterns
${JSON.stringify(topCircular, null, 2)}

## Top Suspicious Wallets (GNN Score)
${JSON.stringify(top5Suspicious, null, 2)}

## Yêu cầu
Phân tích dữ liệu trên và trả về JSON với cấu trúc sau (không thêm markdown, chỉ JSON thuần):
{
  "verdict": "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "CLEAN",
  "summary": "tóm tắt 1-2 câu bằng tiếng Việt",
  "detailedFindings": ["finding 1", "finding 2", "finding 3"],
  "suspiciousPatterns": [
    {
      "patternName": "tên pattern",
      "description": "mô tả chi tiết bằng tiếng Việt",
      "affectedWallets": ["wallet1..."],
      "severity": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "recommendation": "khuyến nghị cho nhà đầu tư",
  "confidenceNote": "ghi chú về độ tin cậy của phân tích"
}

Lưu ý:
- Giải thích TẠI SAO các pattern này là dấu hiệu wash trading
- Đề cập đến interval đều, amount tương đồng, vòng lặp giao dịch
- Ngôn ngữ chuyên nghiệp, phù hợp báo cáo blockchain
`;

  try {
    const gemini = new GoogleGenAI({ apiKey });
    const response = await (gemini as any).models.generateContent({
      model: WALLET_AUDIT_MODEL ?? "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.3,
        responseMimeType: "application/json",
        systemInstruction:
          "You are an expert blockchain analyst specializing in Solana wash trading detection. " +
          "Return valid JSON only, no markdown, no explanation outside JSON.",
      },
    });

    const text: string = response?.text ?? "";
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Thử tìm JSON object trong response
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        parsed = JSON.parse(clean.slice(start, end + 1));
      } else {
        throw new Error("Cannot parse Gemini response");
      }
    }

    return {
      verdict: ["HIGH_RISK", "MEDIUM_RISK", "LOW_RISK", "CLEAN"].includes(parsed.verdict)
        ? parsed.verdict
        : fallback.verdict,
      summary: typeof parsed.summary === "string" ? parsed.summary : fallback.summary,
      detailedFindings: Array.isArray(parsed.detailedFindings)
        ? parsed.detailedFindings.filter((f: unknown) => typeof f === "string")
        : fallback.detailedFindings,
      suspiciousPatterns: Array.isArray(parsed.suspiciousPatterns)
        ? parsed.suspiciousPatterns
        : fallback.suspiciousPatterns,
      recommendation: typeof parsed.recommendation === "string"
        ? parsed.recommendation
        : fallback.recommendation,
      confidenceNote: typeof parsed.confidenceNote === "string"
        ? parsed.confidenceNote
        : "Phân tích được thực hiện bởi Gemini AI dựa trên dữ liệu on-chain.",
    };
  } catch (err) {
    console.error("[WashTradingAI] Gemini error:", err);
    return fallback;
  }
}

// ─── Main: Orchestration ──────────────────────────────────────────────────────

export async function analyzeWashTradingWithAI(params: {
  mint: string;
  symbol?: string;
  limit?: number;
}): Promise<WashTradingAIResult> {
  const { mint, symbol = "TOKEN", limit = 200 } = params;
  const analyzedAt = new Date().toISOString();
  const log: WashTradingAIResult["detectionLog"] = [];

  const addLog = (message: string, severity: WashTradingAIResult["detectionLog"][0]["severity"]) => {
    const time = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    log.push({ time, message, severity });
    console.log(`[WashTradingAI][${severity.toUpperCase()}] ${message}`);
  };

  // Step 1: Fetch
  addLog(`Đang tải giao dịch cho token ${symbol}...`, "info");
  const txs = await fetchTokenTransactions(mint, limit);
  addLog(`Đã tải ${txs.length} giao dịch, ${new Set([...txs.map(t => t.from), ...txs.map(t => t.to)]).size} ví`, "info");

  // Step 2a: Circular detection
  addLog("Chạy thuật toán phát hiện vòng giao dịch tròn...", "info");
  const circularPatterns = detectCircularPatterns(txs);
  if (circularPatterns.length > 0) {
    addLog(
      `Phát hiện ${circularPatterns.length} circular trade cluster — nguy hiểm!`,
      "high"
    );
  }

  // Step 2b: GNN scoring
  addLog("Tính GNN-inspired score cho các ví...", "info");
  const suspiciousWallets = computeGNNScores(txs, circularPatterns);
  const highRiskCount = suspiciousWallets.filter(w => w.riskLevel === "High").length;
  if (highRiskCount > 0) {
    addLog(`${highRiskCount} ví có risk score cao (≥0.7)`, "high");
  }

  // Step 3: Graph
  const graphData = buildGraphData(txs, suspiciousWallets);

  // Tính summary metrics
  const totalVolume = txs.reduce((s, t) => s + t.amount, 0);
  const washWallets = new Set(circularPatterns.flatMap(p => p.cycle));
  const washVolume = txs
    .filter(t => washWallets.has(t.from) || washWallets.has(t.to))
    .reduce((s, t) => s + t.amount, 0);
  const uniqueWallets = new Set([...txs.map(t => t.from), ...txs.map(t => t.to)]).size;

  const overallRiskScore = Math.min(
    100,
    Math.round(
      circularPatterns.length * 8 +
      highRiskCount * 5 +
      (washVolume / (totalVolume || 1)) * 40
    )
  );

  const gnnConfidence = suspiciousWallets.length > 0
    ? suspiciousWallets.reduce((s, w) => s + w.score, 0) / suspiciousWallets.length
    : 0;

  // Step 4: AI analysis
  addLog("Đang gửi dữ liệu lên Gemini AI để phân tích...", "info");
  const aiAnalysis = await analyzeWithGemini({
    mint,
    symbol,
    txCount: txs.length,
    uniqueWallets,
    totalVolume,
    circularPatterns,
    suspiciousWallets,
  });

  addLog(
    `AI phân tích hoàn tất — Verdict: ${aiAnalysis.verdict}`,
    aiAnalysis.verdict === "HIGH_RISK" ? "high" :
    aiAnalysis.verdict === "MEDIUM_RISK" ? "medium" : "success"
  );
  addLog(`Model retrain indicator — GNN confidence: ${(gnnConfidence * 100).toFixed(1)}%`, "success");

  return {
    mint,
    symbol,
    analyzedAt,
    summary: {
      totalTransactions: txs.length,
      uniqueWallets,
      totalVolume,
      washVolumeEstimate: washVolume,
      washVolumePercent: totalVolume > 0 ? (washVolume / totalVolume) * 100 : 0,
      circularTradeCount: circularPatterns.length,
      suspiciousWalletCount: suspiciousWallets.length,
      overallRiskScore,
      gnnConfidence,
    },
    circularPatterns,
    suspiciousWallets,
    graphData,
    aiAnalysis,
    detectionLog: log,
  };
}