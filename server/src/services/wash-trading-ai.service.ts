import { GOOGLE_AI_KEY, WALLET_AUDIT_MODEL } from "@sv/config/constants.js";
import { heliusGetJson } from "@sv/services/wallet/providers/helius.client.js";
import { GoogleGenAI } from "@google/genai";

export type Timeframe = "1h" | "24h" | "7d" | "30d";

export interface RawTransaction {
  signature?: string;
  feePayer?: string;
  timestamp?: number;
  tokenTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    tokenAmount?: number;
    mint?: string;
  }>;
}

export interface NormalizedTx {
  signature: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  mint: string;
}

export interface CircularPattern {
  cycle: string[];
  hops: number;
  amounts: number[];
  timestamps: number[];
  intervalMs: number;
  confidence: number;
}

export interface GNNScore {
  wallet: string;
  score: number;
  features: {
    circularPattern: number;
    timeRegularity: number;
    amountSimilarity: number;
    selfLoopDegree: number;
    hubness: number;
  };
  riskLevel: "High" | "Medium" | "Low";
  pattern: string;
  txCount: number;
  volume: number;
}

export interface WashTradingAIResult {
  mint: string;
  symbol: string;
  timeframe: Timeframe;
  analyzedAt: string;
  dataSource: "helius" | "demo-fallback";
  summary: {
    totalTransactions: number;
    uniqueWallets: number;
    totalVolume: number;
    washVolumeEstimate: number;
    washVolumePercent: number;
    circularTradeCount: number;
    suspiciousWalletCount: number;
    overallRiskScore: number;
    gnnConfidence: number;
  };
  circularPatterns: CircularPattern[];
  suspiciousWallets: GNNScore[];
  graphData: {
    nodes: Array<{ id: string; type: "wash" | "bridge" | "normal"; label: string; score?: number }>;
    edges: Array<{ from: string; to: string; amount: number; suspicious: boolean }>;
  };
  aiAnalysis: {
    verdict: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "CLEAN";
    summary: string;
    detailedFindings: string[];
    suspiciousPatterns: Array<{
      patternName: string;
      description: string;
      affectedWallets: string[];
      severity: "HIGH" | "MEDIUM" | "LOW";
    }>;
    recommendation: string;
    confidenceNote: string;
  };
  detectionLog: Array<{
    time: string;
    message: string;
    severity: "high" | "medium" | "info" | "success";
  }>;
}

function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRandom(seedInput: string): () => number {
  let seed = hashSeed(seedInput) || 1;
  return () => {
    seed = Math.imul(seed, 1664525) + 1013904223;
    return ((seed >>> 0) / 4294967296);
  };
}

function fakeWallet(prefix: string, index: number, seed: string): string {
  const base = `${prefix}${index}${seed}`.replace(/[^a-zA-Z0-9]/g, "");
  return `${base.slice(0, 8).padEnd(8, "X")}${hashSeed(base).toString(36).padEnd(24, "0")}`.slice(0, 32);
}

function createDemoTransactions(mint: string, symbol: string, limit: number): NormalizedTx[] {
  const rand = createRandom(`${mint}:${symbol}`);
  const now = Math.floor(Date.now() / 1000);
  const txs: NormalizedTx[] = [];

  const washA = [0, 1, 2, 3].map((i) => fakeWallet("washA", i, mint));
  const washB = [0, 1, 2].map((i) => fakeWallet("washB", i, mint));
  const normal = Array.from({ length: 18 }, (_, i) => fakeWallet("normal", i, mint));

  let sigCounter = 0;
  const pushTx = (from: string, to: string, amount: number, timestamp: number) => {
    txs.push({
      signature: `demo_${hashSeed(`${mint}_${sigCounter}_${from}_${to}`).toString(36)}`,
      from,
      to,
      amount,
      timestamp,
      mint,
    });
    sigCounter++;
  };

  // Cluster A: circular flow with very similar amount and regular interval.
  for (let round = 0; round < 14; round++) {
    const start = now - 3600 + round * 185;
    const baseAmount = 42_000 + Math.round(rand() * 1800);
    for (let i = 0; i < washA.length; i++) {
      pushTx(
        washA[i],
        washA[(i + 1) % washA.length],
        baseAmount + Math.round((rand() - 0.5) * 500),
        start + i * 7,
      );
    }
  }

  // Cluster B: 3-hop round trips.
  for (let round = 0; round < 9; round++) {
    const start = now - 7200 + round * 260;
    const baseAmount = 17_500 + Math.round(rand() * 900);
    for (let i = 0; i < washB.length; i++) {
      pushTx(
        washB[i],
        washB[(i + 1) % washB.length],
        baseAmount + Math.round((rand() - 0.5) * 250),
        start + i * 11,
      );
    }
  }

  // Bridge and normal traffic.
  for (let i = 0; i < Math.max(25, limit - txs.length); i++) {
    const from = rand() > 0.22 ? normal[Math.floor(rand() * normal.length)] : washA[Math.floor(rand() * washA.length)];
    const to = normal[Math.floor(rand() * normal.length)];
    const amount = 600 + Math.round(rand() * 8_000);
    const timestamp = now - Math.round(rand() * 24 * 3600);
    pushTx(from, to, amount, timestamp);
  }

  return txs.sort((a, b) => a.timestamp - b.timestamp).slice(0, limit);
}

async function fetchTokenTransactions(mint: string, symbol: string, limit: number): Promise<{ txs: NormalizedTx[]; source: "helius" | "demo-fallback" }> {
  try {
    const raw = await heliusGetJson<RawTransaction[]>(`/v0/addresses/${mint}/transactions`, {
      limit: Math.min(limit, 100),
      type: "SWAP",
    });

    const normalized: NormalizedTx[] = [];
    for (const tx of Array.isArray(raw) ? raw : []) {
      for (const transfer of tx.tokenTransfers ?? []) {
        const amount = Number(transfer.tokenAmount ?? 0);
        if (
          transfer.mint === mint &&
          transfer.fromUserAccount &&
          transfer.toUserAccount &&
          amount > 0
        ) {
          normalized.push({
            signature: tx.signature ?? `unknown_${normalized.length}`,
            from: transfer.fromUserAccount,
            to: transfer.toUserAccount,
            amount,
            timestamp: Number(tx.timestamp ?? Math.floor(Date.now() / 1000)),
            mint,
          });
        }
      }
    }

    if (normalized.length >= 10) {
      return { txs: normalized.slice(0, limit), source: "helius" };
    }
  } catch (error) {
    console.warn("[WashTradingAI] Helius unavailable, using demo fallback:", error instanceof Error ? error.message : error);
  }

  return { txs: createDemoTransactions(mint, symbol, limit), source: "demo-fallback" };
}

function detectCircularPatterns(txs: NormalizedTx[]): CircularPattern[] {
  const patterns: CircularPattern[] = [];
  const byFrom = new Map<string, NormalizedTx[]>();

  for (const tx of txs) {
    const list = byFrom.get(tx.from) ?? [];
    list.push(tx);
    byFrom.set(tx.from, list);
  }

  const TIME_WINDOW_SECONDS = 3600;
  const AMOUNT_TOLERANCE = 0.08;

  const dfs = (
    start: string,
    current: string,
    path: string[],
    amounts: number[],
    timestamps: number[],
    startAmount: number,
    startTime: number,
    visited: Set<string>,
  ) => {
    if (path.length > 6) return;

    const outgoing = byFrom.get(current) ?? [];
    for (const tx of outgoing) {
      if (tx.timestamp < startTime) continue;
      if (tx.timestamp - startTime > TIME_WINDOW_SECONDS) continue;
      const diff = Math.abs(tx.amount - startAmount) / Math.max(startAmount, 1);
      if (diff > AMOUNT_TOLERANCE) continue;

      if (tx.to === start && path.length >= 3) {
        const hopCount = path.length;
        const allTimestamps = [...timestamps, tx.timestamp];
        const intervalMs = ((allTimestamps[allTimestamps.length - 1] - allTimestamps[0]) / Math.max(hopCount, 1)) * 1000;
        const confidence = Math.min(0.99, Math.max(0.55, 1 - diff * 4 - Math.max(0, intervalMs - 60_000) / 600_000));
        patterns.push({
          cycle: [...path, start],
          hops: hopCount,
          amounts: [...amounts, tx.amount],
          timestamps: allTimestamps,
          intervalMs,
          confidence,
        });
        continue;
      }

      if (!visited.has(tx.to)) {
        visited.add(tx.to);
        dfs(start, tx.to, [...path, tx.to], [...amounts, tx.amount], [...timestamps, tx.timestamp], startAmount, startTime, visited);
        visited.delete(tx.to);
      }
    }
  };

  const topWallets = [...byFrom.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 60);

  for (const [wallet, outgoing] of topWallets) {
    for (const tx of outgoing.slice(0, 12)) {
      const visited = new Set<string>([wallet, tx.to]);
      dfs(wallet, tx.to, [wallet, tx.to], [tx.amount], [tx.timestamp], tx.amount, tx.timestamp, visited);
    }
  }

  const seen = new Set<string>();
  return patterns
    .sort((a, b) => b.confidence - a.confidence)
    .filter((p) => {
      const key = p.cycle.slice(0, -1).sort().join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

function computeGNNScores(txs: NormalizedTx[], circularPatterns: CircularPattern[]): GNNScore[] {
  const wallets = new Map<string, {
    inDegree: number;
    outDegree: number;
    txCount: number;
    volume: number;
    timestamps: number[];
    amounts: number[];
    selfLoop: boolean;
    circular: boolean;
  }>();

  const ensure = (wallet: string) => {
    const existing = wallets.get(wallet);
    if (existing) return existing;
    const created = { inDegree: 0, outDegree: 0, txCount: 0, volume: 0, timestamps: [], amounts: [], selfLoop: false, circular: false };
    wallets.set(wallet, created);
    return created;
  };

  for (const tx of txs) {
    const from = ensure(tx.from);
    const to = ensure(tx.to);
    from.outDegree++;
    from.txCount++;
    from.volume += tx.amount;
    from.timestamps.push(tx.timestamp);
    from.amounts.push(tx.amount);
    to.inDegree++;
    if (tx.from === tx.to) from.selfLoop = true;
  }

  const circularWallets = new Set(circularPatterns.flatMap((p) => p.cycle));
  for (const wallet of circularWallets) ensure(wallet).circular = true;

  const maxDegree = Math.max(1, ...[...wallets.values()].map((w) => w.inDegree + w.outDegree));
  const scores: GNNScore[] = [];

  for (const [wallet, f] of wallets) {
    if (f.txCount < 2 && !f.circular) continue;

    const sortedTimes = [...f.timestamps].sort((a, b) => a - b);
    const intervals: number[] = [];
    for (let i = 1; i < sortedTimes.length; i++) intervals.push((sortedTimes[i] - sortedTimes[i - 1]) * 1000);
    const avgInterval = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 600_000;

    const mean = f.amounts.length ? f.amounts.reduce((a, b) => a + b, 0) / f.amounts.length : 0;
    const variance = f.amounts.length ? f.amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / f.amounts.length : 0;
    const coeffVar = mean > 0 ? Math.sqrt(variance) / mean : 1;

    const circularScore = f.circular ? 0.95 : 0;
    const timeRegularity = Math.max(0, Math.min(1, 1 - avgInterval / 600_000));
    const amountSimilarity = Math.max(0, Math.min(1, 1 - coeffVar));
    const selfLoopDegree = f.selfLoop ? 0.85 : 0;
    const hubness = Math.min(1, (f.inDegree + f.outDegree) / Math.max(1, maxDegree * 0.45));

    const score = Math.min(0.99,
      circularScore * 0.34 +
      timeRegularity * 0.22 +
      amountSimilarity * 0.22 +
      selfLoopDegree * 0.08 +
      hubness * 0.14,
    );

    if (score < 0.18 && !f.circular) continue;

    const riskLevel: GNNScore["riskLevel"] = score >= 0.7 ? "High" : score >= 0.4 ? "Medium" : "Low";
    const pattern = f.circular ? "Circular Trade" : hubness > 0.7 ? "Hub Wallet" : timeRegularity > 0.65 ? "Bot-like Timing" : amountSimilarity > 0.75 ? "Amount Mirror" : "Anomalous Activity";

    scores.push({
      wallet,
      score,
      riskLevel,
      pattern,
      txCount: f.txCount,
      volume: f.volume,
      features: { circularPattern: circularScore, timeRegularity, amountSimilarity, selfLoopDegree, hubness },
    });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, 25);
}

function buildGraphData(txs: NormalizedTx[], suspiciousWallets: GNNScore[]): WashTradingAIResult["graphData"] {
  const suspiciousSet = new Set(suspiciousWallets.slice(0, 12).map((w) => w.wallet));
  const highRiskSet = new Set(suspiciousWallets.filter((w) => w.riskLevel === "High").map((w) => w.wallet));
  const scoreMap = new Map(suspiciousWallets.map((w) => [w.wallet, w.score]));

  const relevant = txs
    .filter((tx) => suspiciousSet.has(tx.from) || suspiciousSet.has(tx.to))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 60);

  const walletSet = new Set<string>();
  for (const tx of relevant) {
    walletSet.add(tx.from);
    walletSet.add(tx.to);
  }

  return {
    nodes: [...walletSet].slice(0, 35).map((id) => ({
      id,
      label: shortAddress(id),
      type: highRiskSet.has(id) ? "wash" : suspiciousSet.has(id) ? "bridge" : "normal",
      score: scoreMap.get(id),
    })),
    edges: relevant.map((tx) => ({
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      suspicious: suspiciousSet.has(tx.from) && suspiciousSet.has(tx.to),
    })),
  };
}

function buildLocalAIAnalysis(symbol: string, circularPatterns: CircularPattern[], suspiciousWallets: GNNScore[], riskScore: number, dataSource: WashTradingAIResult["dataSource"]): WashTradingAIResult["aiAnalysis"] {
  const verdict: WashTradingAIResult["aiAnalysis"]["verdict"] = riskScore >= 75 ? "HIGH_RISK" : riskScore >= 45 ? "MEDIUM_RISK" : riskScore >= 20 ? "LOW_RISK" : "CLEAN";
  const highRisk = suspiciousWallets.filter((w) => w.riskLevel === "High");

  return {
    verdict,
    summary: `Token ${symbol} có risk score ${riskScore}/100. Hệ thống phát hiện ${circularPatterns.length} circular cluster và ${suspiciousWallets.length} ví có hành vi bất thường theo mô hình GNN-inspired.`,
    detailedFindings: [
      circularPatterns.length > 0
        ? `Circular trading: phát hiện ${circularPatterns.length} vòng giao dịch 3-6 hop với amount tương đồng và khoảng thời gian đều.`
        : "Circular trading: chưa phát hiện vòng giao dịch rõ ràng trong tập dữ liệu hiện tại.",
      highRisk.length > 0
        ? `GNN score: ${highRisk.length} ví đạt mức High risk, nổi bật là ${shortAddress(highRisk[0].wallet)} với score ${(highRisk[0].score * 100).toFixed(0)}/100.`
        : "GNN score: chưa có ví nào vượt ngưỡng High risk.",
      dataSource === "demo-fallback"
        ? "Data source: đang dùng dữ liệu demo fallback vì chưa có/không lấy được Helius API. Phù hợp demo UX, chưa nên xem là kết luận on-chain thật."
        : "Data source: dữ liệu lấy từ Helius Enhanced Transactions API và được chuẩn hóa theo token transfer.",
    ],
    suspiciousPatterns: suspiciousWallets.slice(0, 6).map((w) => ({
      patternName: w.pattern,
      description: `Ví ${shortAddress(w.wallet)} có ${w.txCount} giao dịch, volume ${Math.round(w.volume).toLocaleString()} token, GNN score ${(w.score * 100).toFixed(0)}/100.`,
      affectedWallets: [w.wallet],
      severity: w.riskLevel.toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
    })),
    recommendation: verdict === "HIGH_RISK"
      ? "Nên cảnh báo người dùng, kiểm tra thêm thanh khoản/pool và hạn chế ra quyết định dựa trên volume 24h của token này."
      : verdict === "MEDIUM_RISK"
      ? "Nên theo dõi thêm vì đã có một số dấu hiệu volume nhân tạo nhưng chưa đủ mạnh để kết luận chắc chắn."
      : "Chưa thấy dấu hiệu wash trading nghiêm trọng trong dữ liệu hiện tại, nhưng vẫn nên kết hợp thêm holder distribution và pool liquidity.",
    confidenceNote: "Đây là mô hình GNN-inspired dùng graph features: circularity, time regularity, amount similarity, self-loop và hubness. Kết quả là tín hiệu cảnh báo, không phải kết luận pháp lý.",
  };
}

async function tryGeminiAnalysis(base: WashTradingAIResult["aiAnalysis"], params: {
  mint: string;
  symbol: string;
  summary: WashTradingAIResult["summary"];
  circularPatterns: CircularPattern[];
  suspiciousWallets: GNNScore[];
}): Promise<WashTradingAIResult["aiAnalysis"]> {
  const apiKey = GOOGLE_AI_KEY?.trim();
  if (!apiKey) return base;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: WALLET_AUDIT_MODEL || "gemini-2.5-flash",
      contents: `Bạn là chuyên gia phân tích wash trading Solana. Hãy trả về JSON thuần theo cấu trúc: {"verdict":"HIGH_RISK|MEDIUM_RISK|LOW_RISK|CLEAN","summary":"...","detailedFindings":["..."],"suspiciousPatterns":[{"patternName":"...","description":"...","affectedWallets":["..."],"severity":"HIGH|MEDIUM|LOW"}],"recommendation":"...","confidenceNote":"..."}.\n\nDữ liệu: ${JSON.stringify({ mint: params.mint, symbol: params.symbol, summary: params.summary, circularPatterns: params.circularPatterns.slice(0, 5), suspiciousWallets: params.suspiciousWallets.slice(0, 8) })}`,
      config: { temperature: 0.2, responseMimeType: "application/json" },
    });

    const text = response.text?.replace(/```json|```/g, "").trim() ?? "";
    const parsed = JSON.parse(text) as Partial<WashTradingAIResult["aiAnalysis"]>;
    return {
      verdict: parsed.verdict ?? base.verdict,
      summary: typeof parsed.summary === "string" ? parsed.summary : base.summary,
      detailedFindings: Array.isArray(parsed.detailedFindings) ? parsed.detailedFindings.filter((x): x is string => typeof x === "string") : base.detailedFindings,
      suspiciousPatterns: Array.isArray(parsed.suspiciousPatterns) ? parsed.suspiciousPatterns as WashTradingAIResult["aiAnalysis"]["suspiciousPatterns"] : base.suspiciousPatterns,
      recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : base.recommendation,
      confidenceNote: typeof parsed.confidenceNote === "string" ? parsed.confidenceNote : base.confidenceNote,
    };
  } catch (error) {
    console.warn("[WashTradingAI] Gemini failed, using local analysis:", error instanceof Error ? error.message : error);
    return base;
  }
}

export async function analyzeWashTradingWithAI(params: {
  mint: string;
  symbol?: string;
  timeframe?: Timeframe;
  limit?: number;
}): Promise<WashTradingAIResult> {
  const mint = params.mint.trim();
  const symbol = (params.symbol ?? "TOKEN").trim() || "TOKEN";
  const timeframe = params.timeframe ?? "24h";
  const limit = Math.min(Math.max(params.limit ?? 200, 50), 500);
  const analyzedAt = new Date().toISOString();
  const detectionLog: WashTradingAIResult["detectionLog"] = [];

  const addLog = (message: string, severity: WashTradingAIResult["detectionLog"][number]["severity"]) => {
    detectionLog.push({
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      message,
      severity,
    });
  };

  addLog(`Bắt đầu phân tích AI Wash Trading cho ${symbol}`, "info");
  const { txs, source } = await fetchTokenTransactions(mint, symbol, limit);
  addLog(`Đã chuẩn hóa ${txs.length} giao dịch token transfer`, "info");

  const circularPatterns = detectCircularPatterns(txs);
  addLog(
    circularPatterns.length > 0
      ? `Phát hiện ${circularPatterns.length} circular trade cluster`
      : "Không tìm thấy circular cluster rõ ràng",
    circularPatterns.length > 0 ? "high" : "success",
  );

  const suspiciousWallets = computeGNNScores(txs, circularPatterns);
  const highRiskCount = suspiciousWallets.filter((w) => w.riskLevel === "High").length;
  addLog(`GNN-inspired scoring hoàn tất: ${suspiciousWallets.length} ví đáng ngờ`, highRiskCount > 0 ? "high" : "success");

  const graphData = buildGraphData(txs, suspiciousWallets);

  const totalVolume = txs.reduce((sum, tx) => sum + tx.amount, 0);
  const uniqueWallets = new Set(txs.flatMap((tx) => [tx.from, tx.to])).size;
  const washWalletSet = new Set(circularPatterns.flatMap((p) => p.cycle));
  const washVolumeEstimate = txs
    .filter((tx) => washWalletSet.has(tx.from) || washWalletSet.has(tx.to))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const washVolumePercent = totalVolume > 0 ? (washVolumeEstimate / totalVolume) * 100 : 0;
  const avgSuspiciousScore = suspiciousWallets.length > 0
    ? suspiciousWallets.reduce((sum, wallet) => sum + wallet.score, 0) / suspiciousWallets.length
    : 0;

  const overallRiskScore = Math.min(100, Math.round(
    circularPatterns.length * 6 +
    highRiskCount * 8 +
    suspiciousWallets.length * 1.5 +
    washVolumePercent * 0.55 +
    avgSuspiciousScore * 18,
  ));

  const summary: WashTradingAIResult["summary"] = {
    totalTransactions: txs.length,
    uniqueWallets,
    totalVolume,
    washVolumeEstimate,
    washVolumePercent,
    circularTradeCount: circularPatterns.length,
    suspiciousWalletCount: suspiciousWallets.length,
    overallRiskScore,
    gnnConfidence: avgSuspiciousScore,
  };

  const localAI = buildLocalAIAnalysis(symbol, circularPatterns, suspiciousWallets, overallRiskScore, source);
  addLog("Tạo AI explanation cho kết quả phân tích", "info");
  const aiAnalysis = await tryGeminiAnalysis(localAI, { mint, symbol, summary, circularPatterns, suspiciousWallets });
  addLog(`Hoàn tất phân tích — Verdict: ${aiAnalysis.verdict}`, aiAnalysis.verdict === "HIGH_RISK" ? "high" : aiAnalysis.verdict === "MEDIUM_RISK" ? "medium" : "success");

  return {
    mint,
    symbol,
    timeframe,
    analyzedAt,
    dataSource: source,
    summary,
    circularPatterns,
    suspiciousWallets,
    graphData,
    aiAnalysis,
    detectionLog,
  };
}
