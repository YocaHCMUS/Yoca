import { useState, useEffect } from "react";
import client from "@/api/main";

export interface WalletWinrateStats {
  winRate: number;
  winCount: number;
  lossCount: number;
  breakEvenCount: number;
  unrealizedLossCount: number;
  closedCount: number;
  totalTraded: number;
  avgWinUsd: number;
  avgLossUsd: number;
  totalWinUsd: number;
  totalLossUsd: number;
  classifiedRealizedPnlUsd: number;
  realizedPnlUsd: number;
  unclassifiedRealizedPnlUsd: number;
  classifiedTokenCount: number;
}

export function useWalletWinrate(walletAddress: string, period: string) {
  const [stats, setStats] = useState<WalletWinrateStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress || walletAddress === "null") return;

    setLoading(true);
    console.log(
      "Đang gọi API Winrate với address:",
      walletAddress,
      "và period:",
      period,
    );

    client.api.charts.winrate
      .$get({
        query: {
          wallets: walletAddress,
          period: period as any,
        },
      })
      .then(async (res) => {
        if (!res.ok) throw new Error("API call failed");
        const data = await res.json();

        console.log("Backend response for WinRate:", data);

        const walletStats = data.wallets?.find(
          (w: any) => w.walletAddress === walletAddress,
        );
        if (walletStats) {
          setStats({
            winRate: Number(walletStats.winrate ?? 0),
            winCount: Number(walletStats.winningTrades ?? 0),
            lossCount: Number(walletStats.losingTrades ?? 0),
            breakEvenCount: Number(walletStats.breakEvenTrades ?? 0),
            unrealizedLossCount: Number(walletStats.unrealizedLossTrades ?? 0),
            closedCount: Number(walletStats.closedTrades ?? 0),
            totalTraded: Number(walletStats.totalTrades ?? 0),
            avgWinUsd: Number(walletStats.avgWinUsd ?? 0),
            avgLossUsd: Number(walletStats.avgLossUsd ?? 0),
            totalWinUsd: Number(walletStats.totalWinUsd ?? 0),
            totalLossUsd: Number(walletStats.totalLossUsd ?? 0),
            classifiedRealizedPnlUsd: Number(
              walletStats.classifiedRealizedPnlUsd ?? 0,
            ),
            realizedPnlUsd: Number(walletStats.realizedPnlUsd ?? 0),
            unclassifiedRealizedPnlUsd: Number(
              walletStats.unclassifiedRealizedPnlUsd ?? 0,
            ),
            classifiedTokenCount: Number(walletStats.classifiedTokenCount ?? 0),
          });
        } else {
          console.warn("Không tìm thấy stats cho ví:", walletAddress);
          setStats(null);
        }
      })
      .catch((err) => {
        console.error("Error fetching winrate:", err);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [walletAddress, period]);

  return { stats, loading };
}
