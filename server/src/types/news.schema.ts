import { z } from "zod";
import { solanaBase58Schema } from "@sv/middlewares/validation.js";

export const newsContentHashSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[a-f0-9]{64}$/i, "content_hash must be sha256 hex");

export const newsArticleExpandParamSchema = z.object({
    contentHash: newsContentHashSchema,
});

export const newsEntrySchema = z.object({
    title: z.string().min(1),
    url: z.string().min(1),
    description: z.string().optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    extra_snippets: z.array(z.string()).optional(),
});

export const newsWebhookSchema = z.object({
    address: solanaBase58Schema,
    symbol: z.string().trim().min(1),
    name: z.string().trim().min(1),
    entries: newsEntrySchema.array().optional().default([]),
});

export const newsTokenContextPointSchema = z.object({
    dateStr: z.string().min(1),
    price: z.number().nullable(),
    marketCap: z.number().nullable(),
});

export const newsTokenContextSchema = z.object({
    labels: z.array(z.string()),
    priceSeries: z.array(z.number().nullable()),
    marketCapSeries: z.array(z.number().nullable()),
});

export const newsArticleExpansionSchema = z.object({
    article: z.object({
        contentHash: newsContentHashSchema,
        title: z.string(),
        url: z.string(),
        description: z.string().nullable(),
        publishedAt: z.string().nullable(),
        sourceName: z.string().nullable(),
        faviconUrl: z.string().nullable(),
    }),
    token: z.object({
        address: solanaBase58Schema,
        symbol: z.string(),
        name: z.string(),
    }),
    extraSnippets: z.array(z.string()),
    context: newsTokenContextSchema.nullable(),
});

export type NewsEntry = z.infer<typeof newsEntrySchema>;
export type NewsWebhookPayload = z.infer<typeof newsWebhookSchema>;
export type NewsArticleExpandParam = z.infer<typeof newsArticleExpandParamSchema>;
export type NewsTokenContextPoint = z.infer<typeof newsTokenContextPointSchema>;
export type NewsTokenContext = z.infer<typeof newsTokenContextSchema>;
export type NewsArticleExpansion = z.infer<typeof newsArticleExpansionSchema>;

export default newsWebhookSchema;
