// Zod schemas for request/response validation
import { z } from 'zod';

// Example: Birdeye price endpoint
export const birdeyePriceRequestSchema = z.object({
    tokenAddress: z.string(),
});

export const birdeyePriceResponseSchema = z.object({
    price: z.number(),
    symbol: z.string(),
    timestamp: z.number(),
});

// Example: Helius transaction endpoint
export const heliusTxRequestSchema = z.object({
    address: z.string(),
    limit: z.number().optional(),
});

export const heliusTxResponseSchema = z.object({
    transactions: z.array(z.object({
        signature: z.string(),
        blockTime: z.number(),
        amount: z.number(),
    })),
});
