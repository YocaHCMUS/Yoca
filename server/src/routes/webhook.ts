import { Hono } from "hono";

interface HeliusEnhancedTransaction {
  signature: string;
  type: string;
  description: string;
}

const WEBHOOK_AUTH_KEY = "thisisphuonglekey";

const app = new Hono().post("/", async (c) => {
  const authorization = c.req.header("Authorization");
  if (authorization !== WEBHOOK_AUTH_KEY) {
    return c.text("Unauthorized", 401);
  }

  try {
    const transactions = await c.req.json<HeliusEnhancedTransaction[]>();
    if (Array.isArray(transactions)) {
      for (const tx of transactions) {
        console.log(
          "[helius-webhook]",
          "signature:",
          tx.signature,
          "type:",
          tx.type,
          "description:",
          tx.description,
        );
      }
    }
  } catch (error) {
    console.error("[helius-webhook] failed to parse payload:", error);
  }

  return c.text("Webhook received", 200);
});

export default app;
