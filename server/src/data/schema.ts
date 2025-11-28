import { z } from "zod";

export const paginationSchema = z.object({
  limit: z.number(),
  offset: z.number(),
});

// Wallet address
export const addressSchema = z.object({
  address: z.string().trim().min(32).max(44),
});

export const tokenAddressListSchema = z.object({
  addresses: z.string().trim().min(1),
});

export const tokenIdSchema = z.object({
  id: z.string().trim().min(1),
});
