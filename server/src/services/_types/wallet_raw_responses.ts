import { z } from "zod";

export const BDS_WalletFirstFundSchema = z.object({
  success: z.boolean(),
  data: z.record(
    z.string(),
    z.object({
      tx_hash: z.string(),
      block_unix_time: z.number(),
      block_number: z.number(),
      balance_change: z.string(),
      token_address: z.string(),
      token_decimals: z.number(),
    }),
  ),
});

export const BDS_WalletTokenDetailsSchema = z.object({
  data: z.object({
    meta: z.object({
      address: z.string(),
      currency: z.string(),
      holding_check: z.boolean(),
      time: z.string(),
    }),
    tokens: z.array(
      z.object({
        address: z.string(),
        symbol: z.string(),
        decimals: z.number(),
        last_trade_unix_time: z.number(),
        counts: z.object({
          total_buy: z.number(),
          total_sell: z.number(),
          total_trade: z.number(),
        }),
        quantity: z.object({
          total_bought_amount: z.number(),
          total_sold_amount: z.number(),
          holding: z.number(),
        }),
        cashflow_usd: z.object({
          cost_of_quantity_sold: z.number(),
          total_invested: z.number(),
          total_sold: z.number(),
          current_value: z.number(),
        }),
        pnl: z.object({
          realized_profit_usd: z.number(),
          realized_profit_percent: z.number(),
          unrealized_usd: z.number(),
          unrealized_percent: z.number(),
          total_usd: z.number(),
          total_percent: z.number(),
          avg_profit_per_trade_usd: z.number(),
        }),
        pricing: z.object({
          current_price: z.number().nullable(),
          avg_buy_cost: z.number(),
          avg_sell_cost: z.number(),
        }),
      }),
    ),
    summary: z.object({
      unique_tokens: z.number(),
      counts: z.object({
        total_buy: z.number(),
        total_sell: z.number(),
        total_trade: z.number(),
        total_win: z.number(),
        total_loss: z.number(),
        win_rate: z.number(),
      }),
      cashflow_usd: z.object({
        total_invested: z.number(),
        total_sold: z.number(),
        current_value: z.number(),
      }),
      pnl: z.object({
        realized_profit_usd: z.number(),
        realized_profit_percent: z.number(),
        unrealized_usd: z.number(),
        total_usd: z.number(),
        avg_profit_per_trade_usd: z.number(),
      }),
    }),
  }),
});

export type BDS_WalletFirstFund = z.infer<typeof BDS_WalletFirstFundSchema>;
export type BDS_WalletTokenDetails = z.infer<
  typeof BDS_WalletTokenDetailsSchema
>;
