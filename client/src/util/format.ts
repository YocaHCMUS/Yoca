export function formatNumber(num: number): string {
  if (num === 0) return "0";

  if (Math.abs(num) < 1) {
    // Show up to 8 decimal places but trim trailing zeros
    return parseFloat(num.toFixed(8)).toString();
  }

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAddress(address: string): string {
  if (!address || address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export const DEX_LABELS: Record<string, string> = {
  raydium: "Raydium",
  raydium_clmm: "Raydium CLMM",
  raydium_cpmm: "Raydium CPMM",
  orca: "Orca",
  orca_whirlpools: "Orca Whirlpools",
  meteora: "Meteora",
  meteora_dlmm: "Meteora DLMM",
  lifinity_v2: "Lifinity V2",
  pancakeswap_v3: "Pancakeswap V3",
};

export function dexLabel(dexId: string | null | undefined): string {
  if (!dexId) return "\u2013";
  return (
    DEX_LABELS[dexId] ??
    dexId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
