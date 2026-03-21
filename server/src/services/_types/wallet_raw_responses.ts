export type BDS_WalletFirstFund = {
  success: boolean;
  data: {
    [address: string]: {
      tx_hash: string;
      block_unix_time: number;
      block_number: number;
      balance_change: string;
      token_address: string;
      token_decimals: number;
    };
  };
};
