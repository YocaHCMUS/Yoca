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
