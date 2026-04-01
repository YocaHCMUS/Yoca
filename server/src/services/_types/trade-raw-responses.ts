import { z } from "zod";

export type BDS_TopTraders = {
  data: {
    items: Array<{
      network: string;
      address: string;
      pnl: number;
      volume: number;
      trade_count: number;
    }>;
  };
  success: boolean;
};
export const bds_TopTradersSchema = z.object({
  data: z.object({
    items: z.array(
      z.object({
        network: z.string(),
        address: z.string(),
        pnl: z.number(),
        volume: z.number(),
        trade_count: z.number(),
      }),
    ),
  }),
  success: z.boolean(),
});
