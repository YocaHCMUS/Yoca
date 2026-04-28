export type SummaryFlow = {
  id: string;
  sequenceNo: number;
  rawIndex: number;
  fromAddr: string;
  toAddr: string;
  fromTokenAddr?: string;
  toTokenAddr?: string;
  amount: number;
  valueUsd: number;
  valueUsdSource: "historical" | "inferred" | "none";
  symbol: string;
  tokenMint: string;
  isNative: boolean;
  color: string;
  pairKey: string;
};
