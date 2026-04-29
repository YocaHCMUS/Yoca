import { z } from "zod";
import { solanaBase58Schema } from "@sv/middlewares/validation.js";

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

export type NewsEntry = z.infer<typeof newsEntrySchema>;
export type NewsWebhookPayload = z.infer<typeof newsWebhookSchema>;

export default newsWebhookSchema;
