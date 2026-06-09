import { useState, useEffect } from "react";
import client from "@/api/main"; // Import client chuẩn của project

export function useWalletWinrate(walletAddress: string, period: string) {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!walletAddress || walletAddress === "null") return;
        
        setLoading(true);
        console.log("Đang gọi API Winrate với address:", walletAddress, "và period:", period);
        
        // Dùng client RPC của hệ thống thay vì fetch thuần
        client.api.charts.winrate.$get({
            query: {
                wallets: walletAddress,
                period: period as any
            }
        })
        .then(async (res) => {
            if (!res.ok) throw new Error("API call failed");
            const data = await res.json();
            
            console.log("Backend response for WinRate:", data);
            
            const walletStats = data.wallets?.find((w: any) => w.walletAddress === walletAddress);
            if (walletStats) {
                setStats({
                     winRate: walletStats.winrate,
                     winCount: walletStats.winningTrades,
                     lossCount: walletStats.losingTrades,
                     totalTraded: walletStats.totalTrades,
                     avgWinUsd: walletStats.avgWinUsd || 0,
                     avgLossUsd: walletStats.avgLossUsd || 0 
                });
            } else {
                console.warn("Không tìm thấy stats cho ví:", walletAddress);
                setStats(null);
            }
        })
        .catch(err => {
            console.error("Error fetching winrate:", err);
            setStats(null);
        })
        .finally(() => setLoading(false));
    }, [walletAddress, period]);

    return { stats, loading };
}