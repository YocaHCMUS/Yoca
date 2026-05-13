export type ExchangeInfo = {
  name: string;
  logoUri: string;
};

const EXCHANGE_REGISTRY: Record<string, ExchangeInfo> = {
  JUPITER:     { name: "Jupiter",     logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/jupiter.png" },
  JUPITER_AGGREGATOR: { name: "Jupiter", logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/jupiter.png" },
  RAYDIUM:     { name: "Raydium",     logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/raydium.png" },
  RAYDIUM_V4:  { name: "Raydium",     logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/raydium.png" },
  RAYDIUM_CLMM:{ name: "Raydium CLMM",logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/raydium.png" },
  ORCA:        { name: "Orca",        logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/orca.png" },
  ORCA_WHIRLPOOLS: { name: "Orca",    logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/orca.png" },
  PHOENIX:     { name: "Phoenix",     logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/phoenix.png" },
  METEORA:     { name: "Meteora",     logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/meteora.png" },
  METEORA_DLMM:{ name: "Meteora DLMM",logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/meteora.png" },
  OPENBOOK:    { name: "OpenBook",    logoUri: "" },
  KAMINO:      { name: "Kamino",      logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/kamino.png" },
  MARGINFI:    { name: "Marginfi",    logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/marginfi.png" },
  DRIFT:       { name: "Drift",       logoUri: "https://dd.dexscreener.com/ds-data/dexes/solana/drift.png" },
  SOLEND:      { name: "Solend",      logoUri: "" },
  SANCTUM_SOL: { name: "Sanctum",     logoUri: "" },
  LIFINITY:    { name: "Lifinity",    logoUri: "" },
  PUMPFUN:     { name: "Pump.fun",    logoUri: "" },
  MOONSHOT:    { name: "Moonshot",    logoUri: "" },
  SYSTEM_PROGRAM: { name: "System Program", logoUri: "" },
  TOKEN_PROGRAM:  { name: "Token Program",  logoUri: "" },
  ASSOCIATED_TOKEN_PROGRAM: { name: "Associated Token Program", logoUri: "" },
  COMPUTE_BUDGET: { name: "Compute Budget", logoUri: "" },
  STAKE_PROGRAM:  { name: "Stake Program",  logoUri: "" },
  VOTE_PROGRAM:   { name: "Vote Program",   logoUri: "" },
  UNKNOWN:     { name: "Unknown",     logoUri: "" },
};

export function lookupExchange(source: string | null | undefined): ExchangeInfo {
  if (!source) return EXCHANGE_REGISTRY.UNKNOWN;
  const key = source.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  return EXCHANGE_REGISTRY[key] ?? EXCHANGE_REGISTRY.UNKNOWN;
}

export function exchangeName(source: string | null | undefined): string {
  return lookupExchange(source).name;
}

export function exchangeLogo(source: string | null | undefined): string {
  return lookupExchange(source).logoUri;
}
