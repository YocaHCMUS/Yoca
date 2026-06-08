import type {
  ChatResponse,
  ChatToolResult,
  WalletChatSection,
  WalletChatEvidence,
  WalletWarning,
  WalletConfidence,
} from "./chat.types.js";
import type { WalletChatIntent } from "./chat-intent.js";
import { toolNameToEvidenceType } from "./chat-intent.js";

export const WALLET_CHAT_RESPONSE_LIMITS = {
  tldrItems: 3,
  tldrBulletChars: 300,
  sectionItems: 6,
  sectionTitleChars: 100,
  sectionContentChars: 1000,
  sectionBulletItems: 6,
  sectionBulletChars: 500,
  evidenceItems: 8,
  evidenceLabelChars: 120,
  evidenceValueChars: 200,
  warningItems: 4,
  disclaimerChars: 400,
} as const;

function compactCurrency(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(number) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(number) >= 1 ? 2 : 8,
  }).format(number);
}

function percent(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "unavailable";
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function findResult(
  results: ChatToolResult[],
  name: string,
): Record<string, unknown> | null {
  const r = results.find((res) => res.name === name);
  if (!r || r.error || r.data == null) return null;
  if (typeof r.data === "object" && !Array.isArray(r.data)) {
    return r.data as Record<string, unknown>;
  }
  return null;
}

function findResultArray(
  results: ChatToolResult[],
  name: string,
): unknown[] {
  const r = results.find((res) => res.name === name);
  if (!r || r.error) return [];
  if (Array.isArray(r.data)) return r.data;
  if (r.data && typeof r.data === "object") {
    const d = r.data as Record<string, unknown>;
    if (Array.isArray(d.points)) return d.points;
    if (Array.isArray(d.swaps)) return d.swaps;
    if (Array.isArray(d.transfers)) return d.transfers;
  }
  return [];
}

function topPortfolioLabel(portfolio: unknown[]): string {
  if (portfolio.length === 0) return "none";
  const top = portfolio[0] as Record<string, unknown> | undefined;
  if (!top) return "none";
  return String(top.token ?? top.symbol ?? top.name ?? "unknown");
}

function winRateText(
  pnlData: Record<string, unknown> | null,
  language: "en" | "vi",
): string {
  if (!pnlData) return language === "vi" ? "chưa có dữ liệu" : "no PnL data";
  const rate = finiteNumber(pnlData.winRate);
  const trades = finiteNumber(pnlData.tradeCount);
  if (rate == null || trades == null) {
    return language === "vi" ? "chưa có dữ liệu PnL" : "PnL data unavailable";
  }
  if (language === "vi") {
    return `${trades} giao d?ch, t? l? th?ng ${percent(rate)}`;
  }
  return `${trades} trades, ${percent(rate)} win rate`;
}

function pnlValueText(
  pnlData: Record<string, unknown> | null,
  language: "en" | "vi",
): string {
  if (!pnlData) return language === "vi" ? "chưa có" : "unavailable";
  const realized = finiteNumber(pnlData.realizedPnlUsd);
  if (realized == null) return language === "vi" ? "chưa có" : "unavailable";
  return compactCurrency(realized);
}

function buildOverviewSections(
  overview: Record<string, unknown> | null,
  portfolio: unknown[],
  language: "en" | "vi",
): WalletChatSection[] {
  const balance = compactCurrency(overview?.totalBalance);
  const holdings = overview?.holdingsCount ?? "?";
  const volume = compactCurrency(overview?.tradingVolume24h);
  const pnl = compactCurrency(overview?.pnlTotal);
  const topToken = topPortfolioLabel(portfolio);

  const snapshotBullets = [
    language === "vi"
      ? `S? d? ví: ${balance}, n?m gi? ${holdings} token.`
      : `Wallet balance: ${balance}, holding ${holdings} tokens.`,
    language === "vi"
      ? `Kh?i l??ng giao d?ch 24h: ${volume}.`
      : `24h trading volume: ${volume}.`,
    language === "vi"
      ? `T?ng PnL th?c t?: ${pnl}.`
      : `Total realized PnL: ${pnl}.`,
  ];

  const topTokenText =
    portfolio.length > 0
      ? language === "vi"
        ? `Token l?n nh?t: ${topToken}.`
        : `Top token by value: ${topToken}.`
      : language === "vi"
        ? "Ch?a có d? li?u danh m?c token."
        : "No portfolio breakdown available.";

  return [
    {
      title: language === "vi" ? "T?ng Quan" : "Market Snapshot",
      kind: "market_snapshot",
      bullets: snapshotBullets,
    },
    {
      title: language === "vi" ? "Phát Hi?n Chính" : "Key Findings",
      kind: "key_findings",
      bullets: [topTokenText],
    },
    {
      title: language === "vi" ? "Theo Dõi" : "What To Watch",
      kind: "what_to_watch",
      bullets: [
        language === "vi"
          ? "Giám sát kh?i l??ng và s? d? thay ??i theo th?i gian."
          : "Monitor volume and balance changes over time.",
        language === "vi"
          ? "Ki?m tra các token m?i xu?t hi?n trong danh m?c."
          : "Watch for new tokens appearing in the portfolio.",
      ],
    },
  ];
}

function buildPnlSections(
  pnlData: Record<string, unknown> | null,
  overview: Record<string, unknown> | null,
  language: "en" | "vi",
): WalletChatSection[] {
  const realized = pnlValueText(pnlData, language);
  const winRate = winRateText(pnlData, language);
  const topProfitable = pnlData?.topProfitable
    ? String((pnlData.topProfitable as Record<string, unknown>).token ?? "?")
    : null;
  const topLoser = pnlData?.topLoser
    ? String((pnlData.topLoser as Record<string, unknown>).token ?? "?")
    : null;
  const totalBought = compactCurrency(pnlData?.totalBoughtUsd);
  const totalSold = compactCurrency(pnlData?.totalSoldUsd);
  const tradeCount = finiteNumber(pnlData?.tradeCount);

  const summaryBullets = [
    language === "vi"
      ? `PnL th?c t?: ${realized}.`
      : `Realized PnL: ${realized}.`,
    language === "vi" ? `Th?ng kê: ${winRate}.` : `Stats: ${winRate}.`,
    language === "vi"
      ? `T?ng mua: ${totalBought}, t?ng bán: ${totalSold}.`
      : `Total bought: ${totalBought}, total sold: ${totalSold}.`,
  ];

  const bestWorst: string[] = [];
  if (topProfitable) {
    bestWorst.push(
      language === "vi"
        ? `Sinh l?i nh?t: ${topProfitable}.`
        : `Most profitable: ${topProfitable}.`,
    );
  }
  if (topLoser) {
    bestWorst.push(
      language === "vi"
        ? `L? l?n nh?t: ${topLoser}.`
        : `Biggest loser: ${topLoser}.`,
    );
  }

  let balanceChange: string | null = null;
  if (overview?.totalBalance != null) {
    balanceChange = language === "vi"
      ? `S? d? hi?n t?i: ${compactCurrency(overview.totalBalance)}.`
      : `Current balance: ${compactCurrency(overview.totalBalance)}.`;
  }

  return [
    {
      title: language === "vi" ? "T?ng Quan PnL" : "PnL Summary",
      kind: "pnl_summary",
      bullets: summaryBullets,
    },
    ...(bestWorst.length > 0
      ? [
          {
            title: language === "vi" ? "T?t Nh?t / T? Nh?t" : "Best & Worst",
            kind: "key_findings" as const,
            bullets: bestWorst,
          },
        ]
      : []),
    ...(balanceChange
      ? [
          {
            title: language === "vi" ? "K?t Lu?n" : "Conclusion",
            kind: "conclusion" as const,
            content: language === "vi"
              ? `T?ng s? giao d?ch: ${tradeCount ?? "?"}. ${balanceChange}`
              : `Total trades: ${tradeCount ?? "?"}. ${balanceChange}`,
          },
        ]
      : []),
  ];
}

function buildTradesSections(
  swaps: unknown[],
  transfers: unknown[],
  language: "en" | "vi",
): WalletChatSection[] {
  const swapCount = swaps.length;
  const transferCount = transfers.length;
  const totalValue = swaps.reduce<number>((sum: number, s) => {
    const v = finiteNumber((s as Record<string, unknown>).totalValueUsd);
    return sum + (v ?? 0);
  }, 0);

  const recentSwaps = swaps.slice(0, 5).map((s) => {
    const swap = s as Record<string, unknown>;
    return language === "vi"
      ? `${swap.dex ?? "?"}: ${compactCurrency(swap.totalValueUsd)} (${swap.timestamp ?? ""})`
      : `${swap.dex ?? "?"} swap ${compactCurrency(swap.totalValueUsd)} (${swap.timestamp ?? ""})`;
  });

  return [
    {
      title: language === "vi" ? "Ho?t ??ng Giao D?ch" : "Trading Activity",
      kind: "trading_activity",
      bullets: [
        language === "vi"
          ? `${swapCount} swap, ${transferCount} transfer, t?ng giá tr? ${compactCurrency(totalValue)}.`
          : `${swapCount} swaps, ${transferCount} transfers, total value ${compactCurrency(totalValue)}.`,
        ...recentSwaps,
      ],
    },
    {
      title: language === "vi" ? "Phát Hi?n Chính" : "Key Findings",
      kind: "key_findings",
      bullets: [
        swapCount === 0
          ? (language === "vi" ? "Không có swap nào g?n ?ây." : "No recent swaps found.")
          : (language === "vi"
              ? `${swapCount} swap g?n ?ây v?i t?ng giá tr? ${compactCurrency(totalValue)}.`
              : `${swapCount} recent swaps totaling ${compactCurrency(totalValue)}.`),
      ],
    },
  ];
}

function buildPortfolioSections(
  portfolio: unknown[],
  overview: Record<string, unknown> | null,
  language: "en" | "vi",
): WalletChatSection[] {
  const top = portfolio.slice(0, 5).map((item) => {
    const p = item as Record<string, unknown>;
    return `${p.token ?? p.symbol ?? "?"}: ${compactCurrency(p.valueUsd)}${p.change24h != null ? ` (${percent(p.change24h)})` : ""}`;
  });

  const totalValue = portfolio.reduce<number>((sum: number, item) => {
    const v = finiteNumber((item as Record<string, unknown>).valueUsd);
    return sum + (v ?? 0);
  }, 0);

  return [
    {
      title: language === "vi" ? "Top N?m Gi?" : "Top Holdings",
      kind: "top_holdings",
      bullets:
        top.length > 0
          ? top
          : [
              language === "vi"
                ? "Không có token nào trong danh m?c."
                : "No tokens in portfolio.",
            ],
    },
    ...(overview
      ? [
          {
            title: language === "vi" ? "T?ng Quan" : "Market Snapshot",
            kind: "market_snapshot" as const,
            bullets: [
              language === "vi"
                ? `T?ng s? d? danh m?c: ${compactCurrency(overview.totalBalance)}.`
                : `Total portfolio balance: ${compactCurrency(overview.totalBalance)}.`,
              language === "vi"
                ? `S? token: ${portfolio.length}.`
                : `Token count: ${portfolio.length}.`,
            ],
          },
        ]
      : []),
  ];
}

function buildBalanceTrendSections(
  points: unknown[],
  language: "en" | "vi",
): WalletChatSection[] {
  if (points.length === 0) {
    return [
      {
        title: language === "vi" ? "Xu H??ng S? D?" : "Balance Trend",
        kind: "market_snapshot",
        bullets: [
          language === "vi"
            ? "Ch?a có d? li?u l?ch s? s? d?."
            : "No balance history data available.",
        ],
      },
    ];
  }

  const first = points[0] as Record<string, unknown> | undefined;
  const last = points[points.length - 1] as Record<string, unknown> | undefined;
  const startVal = finiteNumber(first?.value);
  const endVal = finiteNumber(last?.value);
  const change =
    startVal != null && endVal != null ? endVal - startVal : null;

  return [
    {
      title: language === "vi" ? "Xu H??ng S? D?" : "Balance Trend",
      kind: "market_snapshot",
      bullets: [
        language === "vi"
          ? `${points.length} ?i?m d? li?u t? ${first?.date ?? "?"} ??n ${last?.date ?? "?"}.`
          : `${points.length} data points from ${first?.date ?? "?"} to ${last?.date ?? "?"}.`,
        change != null
          ? (language === "vi"
              ? `Bi?n ??ng: ${compactCurrency(endVal)} (${change >= 0 ? "+" : ""}${compactCurrency(change)}).`
              : `Change: ${compactCurrency(endVal)} (${change >= 0 ? "+" : ""}${compactCurrency(change)}).`)
          : (language === "vi" ? "Không th? tính bi?n ??ng." : "Change unavailable."),
      ],
    },
    {
      title: language === "vi" ? "K?t Lu?n" : "Conclusion",
      kind: "conclusion",
      content: language === "vi"
        ? `S? d? ?i t? ${compactCurrency(startVal)} ??n ${compactCurrency(endVal)} qua ${points.length} ?i?m.`
        : `Balance moved from ${compactCurrency(startVal)} to ${compactCurrency(endVal)} over ${points.length} points.`,
    },
  ];
}

function buildVolumeTrendSections(
  volumeData: unknown[],
  language: "en" | "vi",
): WalletChatSection[] {
  if (volumeData.length === 0) {
    return [
      {
        title: language === "vi" ? "Kh?i L??ng Giao D?ch" : "Trading Volume",
        kind: "trading_activity",
        bullets: [
          language === "vi"
            ? "Ch?a có d? li?u kh?i l??ng."
            : "No volume data available.",
        ],
      },
    ];
  }

  const totalVolume = volumeData.reduce<number>((sum: number, item) => {
    const v = finiteNumber((item as Record<string, unknown>).volume);
    return sum + (v ?? 0);
  }, 0);

  return [
    {
      title: language === "vi" ? "Kh?i L??ng Giao D?ch" : "Trading Volume",
      kind: "trading_activity",
      bullets: [
        language === "vi"
          ? `${volumeData.length} ngày d? li?u, t?ng kh?i l??ng ${compactCurrency(totalVolume)}.`
          : `${volumeData.length} days of data, total volume ${compactCurrency(totalVolume)}.`,
      ],
    },
    {
      title: language === "vi" ? "K?t Lu?n" : "Conclusion",
      kind: "conclusion",
      content: language === "vi"
        ? `Trung bình ${compactCurrency(totalVolume / volumeData.length)}/ngày.`
        : `Average ${compactCurrency(totalVolume / volumeData.length)}/day.`,
    },
  ];
}

function buildRiskSections(
  overview: Record<string, unknown> | null,
  pnlData: Record<string, unknown> | null,
  portfolio: unknown[],
  swaps: unknown[],
  language: "en" | "vi",
): WalletChatSection[] {
  const concentration =
    portfolio.length > 0
      ? (() => {
          const total = portfolio.reduce<number>((sum: number, item) => {
            const v = finiteNumber((item as Record<string, unknown>).valueUsd);
            return sum + (v ?? 0);
          }, 0);
          if (total <= 0) return null;
          const top = portfolio[0] as Record<string, unknown> | undefined;
          const topVal = finiteNumber(top?.valueUsd);
          if (topVal == null) return null;
          return percent((topVal / total) * 100);
        })()
      : null;

  const riskBullets: string[] = [];
  if (concentration) {
    riskBullets.push(
      language === "vi"
        ? `T?p trung cao: token l?n nh?t chi?m ${concentration} danh m?c.`
        : `Concentration risk: top token is ${concentration} of portfolio.`,
    );
  }
  const realized = finiteNumber(pnlData?.realizedPnlUsd);
  if (realized != null && realized < 0) {
    riskBullets.push(
      language === "vi"
        ? `PnL ?m: l? ${compactCurrency(Math.abs(realized))}.`
        : `Negative PnL: loss of ${compactCurrency(Math.abs(realized))}.`,
    );
  }
  if (swaps.length === 0 && portfolio.length > 0) {
    riskBullets.push(
      language === "vi"
        ? "Không có ho?t ??ng swap g?n ?ây — có th? là ví không ho?t ??ng."
        : "No recent swap activity — wallet may be inactive.",
    );
  }
  if (riskBullets.length === 0) {
    riskBullets.push(
      language === "vi"
        ? "Không phát hi?n r?i ro ??ng k? t? d? li?u hi?n có."
        : "No significant risk signals detected from available data.",
    );
  }

  return [
    {
      title: language === "vi" ? "Y?u T? R?i Ro" : "Risk Factors",
      kind: "risk_factors",
      bullets: riskBullets,
    },
    {
      title: language === "vi" ? "Theo Dõi" : "What To Watch",
      kind: "what_to_watch",
      bullets: [
        language === "vi"
          ? "Giám sát thay ??i t?p trung danh m?c và t?n su?t giao d?ch."
          : "Monitor concentration changes and trading frequency.",
        language === "vi"
          ? "Ki?m tra PnL và kh?i l??ng ?? phát hi?n xu h??ng."
          : "Check PnL and volume trends for direction changes.",
      ],
    },
  ];
}

function computeConfidence(results: ChatToolResult[]): WalletConfidence {
  const total = results.length;
  if (total === 0) return "Low";
  const succeeded = results.filter((r) => !r.error).length;
  const ratio = succeeded / total;
  if (ratio >= 0.8 && total >= 2) return "High";
  if (ratio >= 0.5) return "Medium";
  return "Low";
}

function buildEvidence(results: ChatToolResult[]): WalletChatEvidence[] {
  const evidence: WalletChatEvidence[] = [];

  for (const r of results) {
    if (evidence.length >= WALLET_CHAT_RESPONSE_LIMITS.evidenceItems) break;
    if (r.error || r.data == null) continue;

    let label = r.name.replace(/_/g, " ");
    let value: string | undefined;
    let detail: string | undefined;

    const data = r.data as Record<string, unknown>;
    if (r.name === "get_wallet_overview") {
      label = "Wallet Overview";
      value = compactCurrency(data.totalBalance);
      detail = `${data.holdingsCount ?? "?"} holdings, 24h volume ${compactCurrency(data.tradingVolume24h)}`;
    } else if (r.name === "get_wallet_swaps") {
      const arr = Array.isArray(r.data) ? r.data : [];
      label = "Recent Swaps";
      value = `${arr.length} swaps`;
      const total = arr.reduce<number>(
        (s, item) => s + (finiteNumber((item as Record<string, unknown>).totalValueUsd) ?? 0),
        0,
      );
      detail = `Total value ${compactCurrency(total)}`;
    } else if (r.name === "get_wallet_transfers") {
      const arr = Array.isArray(r.data) ? r.data : [];
      label = "Transfers";
      value = `${arr.length} transfers`;
    } else if (r.name === "get_wallet_pnl") {
      label = "PnL";
      value = compactCurrency(data.realizedPnlUsd);
      detail = `${data.tradeCount ?? "?"} trades, ${percent(data.winRate)} win rate`;
    } else if (r.name === "get_balance_history") {
      const points = Array.isArray(data.points) ? data.points : [];
      label = "Balance History";
      value = `${points.length} data points`;
    } else if (r.name === "get_trading_volume") {
      const arr = Array.isArray(r.data) ? r.data : [];
      label = "Trading Volume";
      value = `${arr.length} days`;
    } else if (r.name === "get_wallet_portfolio") {
      const arr = Array.isArray(r.data) ? r.data : [];
      label = "Portfolio";
      value = `${arr.length} tokens`;
    }

    evidence.push({
      type: toolNameToEvidenceType(r.name),
      label,
      ...(value ? { value } : {}),
      ...(detail ? { detail } : {}),
      toolName: r.name,
    });
  }

  return evidence;
}

function buildWarnings(results: ChatToolResult[]): WalletWarning[] {
  const warnings: WalletWarning[] = [];

  for (const r of results) {
    if (warnings.length >= WALLET_CHAT_RESPONSE_LIMITS.warningItems) break;
    if (r.error && r.data == null) {
      warnings.push({
        text: `"${r.name}" failed: ${r.error}. Data for this area is unavailable.`,
        severity: "warning",
      });
    }
  }

  if (warnings.length === 0) {
    const succeeded = results.filter((r) => !r.error).length;
    if (succeeded < results.length) {
      warnings.push({
        text: `${results.length - succeeded} of ${results.length} data sources had errors. Results may be incomplete.`,
        severity: "info",
      });
    }
  }

  return warnings;
}

function buildTldr(sections: WalletChatSection[]): string[] {
  const tldr: string[] = [];
  for (const section of sections) {
    if (tldr.length >= WALLET_CHAT_RESPONSE_LIMITS.tldrItems) break;
    if (section.bullets && section.bullets.length > 0) {
      const first = section.bullets[0];
      if (first.length <= WALLET_CHAT_RESPONSE_LIMITS.tldrBulletChars) {
        tldr.push(first);
      }
    }
  }
  return tldr;
}

export function buildWalletFallbackResponse(
  query: string,
  intent: WalletChatIntent,
  allResults: ChatToolResult[],
  language: "en" | "vi",
): ChatResponse {
  const overview = findResult(allResults, "get_wallet_overview");
  const pnlData = findResult(allResults, "get_wallet_pnl");
  const portfolio = findResultArray(allResults, "get_wallet_portfolio");
  const swaps = findResultArray(allResults, "get_wallet_swaps");
  const transfers = findResultArray(allResults, "get_wallet_transfers");
  const balancePoints = findResultArray(allResults, "get_balance_history");
  const volumeData = findResultArray(allResults, "get_trading_volume");

  let sections: WalletChatSection[] = [];

  switch (intent) {
    case "overview":
      sections = buildOverviewSections(overview, portfolio, language);
      break;
    case "pnl":
      sections = buildPnlSections(pnlData, overview, language);
      break;
    case "trades":
      sections = buildTradesSections(swaps, transfers, language);
      break;
    case "portfolio":
      sections = buildPortfolioSections(portfolio, overview, language);
      break;
    case "balance_trend":
      sections = buildBalanceTrendSections(balancePoints, language);
      break;
    case "volume_trend":
      sections = buildVolumeTrendSections(volumeData, language);
      break;
    case "risk_analysis":
      sections = buildRiskSections(overview, pnlData, portfolio, swaps, language);
      break;
    default:
      sections = buildOverviewSections(overview, portfolio, language);
  }

  const evidence = buildEvidence(allResults);
  const warnings = buildWarnings(allResults);
  const confidence = computeConfidence(allResults);
  const tldr = buildTldr(sections);

  const text = sections
    .map((s) => s.bullets?.join("\n") ?? s.content ?? "")
    .filter(Boolean)
    .join("\n\n");

  return {
    text: text || (language === "vi" ? "Không có d? li?u." : "No data available."),
    data: {},
    charts: [],
    tables: [],
    tldr,
    sections,
    evidence,
    warnings,
    confidence,
    asOf: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
  };
}
