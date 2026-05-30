/**
 * Debug with 30D period
 */

const TRACKED_WALLETS = [
  "EG8XbqqyNmBLHMP2Y2wyPbMX8c6J12YG8KM4GmvWvUeV",
  "GFHMc9BegxJXLdHJrABxNVoPRdnmVxXiNeoUCEpgXVHw",
  "JD38n7ynKYcgPpF7k1BhXEeREu1KqptU93fVGy3S624k",
];

const BASE = "http://localhost:4000";

const walletData: { address: string; balanceTrend: any }[] = [];

for (const address of TRACKED_WALLETS) {
  const res = await fetch(`${BASE}/api/charts/balance?wallets=${address}&timePeriod=30D`);
  const data = await res.json();
  walletData.push({ address, balanceTrend: data });
}

// Simulate parsing
const dailyBalancePerWallet = new Map<string, Map<number, number>>();
const allDays = new Set<number>();

for (const w of walletData) {
  if (!w.balanceTrend) continue;
  const trendData = w.balanceTrend[w.address] || w.balanceTrend;
  let dataPoints: any[] = Array.isArray(trendData) ? trendData : [];
  if (!dataPoints.length) continue;

  const walletDays = new Map<number, number>();
  for (const pt of dataPoints) {
    const t = Number(pt.timestamp || pt.timestampMs);
    const v = Number(pt.value || pt.usdValue) || 0;
    if (!isNaN(t) && !isNaN(v)) {
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      walletDays.set(d.getTime(), v);
      allDays.add(d.getTime());
    }
  }
  console.log(`[${w.address.slice(0,8)}] days: ${walletDays.size}`);
  dailyBalancePerWallet.set(w.address, walletDays);
}

const sortedDays = Array.from(allDays).sort((a, b) => a - b);
const lastKnownBalance = new Map<string, number>();
const dataArr: [number, number][] = [];

for (const tDay of sortedDays) {
  let total = 0;
  for (const w of walletData) {
    const wd = dailyBalancePerWallet.get(w.address);
    if (wd?.has(tDay)) lastKnownBalance.set(w.address, wd.get(tDay)!);
    total += lastKnownBalance.get(w.address) || 0;
  }
  dataArr.push([tDay, total]);
}

const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
const filteredData = dataArr.filter(p => p[0] >= cutoff);

console.log(`\nfiltered: ${filteredData.length} points`);
filteredData.forEach(([ts, v]) => {
  console.log(`  ${new Date(ts).toISOString().slice(0,10)}  $${v.toFixed(0)}`);
});
