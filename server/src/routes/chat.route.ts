import { Hono } from "hono";
import { z } from "zod";
import { answerChatQuery } from "@sv/services/chat/index.js";

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(2000),
});

const chatRequestSchema = z.object({
  address: z.string().min(32).max(48),
  query: z.string().min(1).max(2000),
  language: z.string().optional(),
  history: z.array(historyMessageSchema).max(20).optional(),
});

const app = new Hono().post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation error", details: parsed.error.issues },
        400,
      );
    }

    const { address, query, history } = parsed.data;
    const response = await answerChatQuery(address, query, history);

    return c.json(response, 200);
  } catch (err) {
    console.error("[chat.route] Error:", err);
    return c.json(
      {
        error: "Failed to process chat query",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      500,
    );
  }
});

export default app;
export type ChatAppType = typeof app;
