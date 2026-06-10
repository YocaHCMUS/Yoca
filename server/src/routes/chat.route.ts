import { Hono } from "hono";
import { z } from "zod";
import { answerChatQuery } from "@sv/services/chat/index.js";
import { honoJwt } from "@sv/middlewares/validation.js";
import userExtract from "@sv/middlewares/user-extract.js";
import { setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import {
  buildSessionContext,
  createSession,
  deleteSession,
  getSession,
  getUserSessions,
  updateSession,
  type ChatSessionContextType,
} from "@sv/services/chat/chat-session.js";

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(2000),
});

const chatRequestSchema = z.object({
  addresses: z.array(z.string().min(32).max(48)).min(1).max(10),
  query: z.string().min(1).max(2000),
  language: z.string().optional(),
  history: z.array(historyMessageSchema).max(20).optional(),
  sessionId: z.string().optional(),
  contextType: z.enum(["wallet", "wallet-comparison"]).optional(),
});

const createSessionSchema = z.object({
  addresses: z.array(z.string().min(32).max(48)).min(1).max(10),
  contextType: z.enum(["wallet", "wallet-comparison"]).optional(),
  title: z.string().max(255).optional(),
});

const updateSessionSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        data: z.any().optional(),
        charts: z.any().optional(),
        tables: z.any().optional(),
        actions: z.any().optional(),
        tldr: z.array(z.string()).optional(),
        sections: z.any().optional(),
        evidence: z.any().optional(),
        warnings: z.any().optional(),
        confidence: z.string().optional(),
      }),
    )
    .optional(),
  title: z.string().max(255).optional(),
});

// ─── Protected chat route (POST /) ──────────────────────────────────────
const chatRoute = new Hono().post("/", honoJwt, userExtract, async (c) => {
  try {
    const { id: userId } = c.get("userPayload")!;

    const body = await c.req.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation error", details: parsed.error.issues },
        400,
      );
    }

    const { addresses, query, language, history, sessionId, contextType } = parsed.data;
    const response = await answerChatQuery(addresses, query, language, history);

    // Persist to session
    let activeSessionId = sessionId;

    const userMsg: Record<string, unknown> = {
      role: "user",
      content: query,
    };
    const assistantMsg: Record<string, unknown> = {
      role: "assistant",
      content: response.text,
      data: response.data,
      charts: response.charts,
      tables: response.tables,
      actions: response.actions,
      tldr: response.tldr,
      sections: response.sections,
      evidence: response.evidence,
      warnings: response.warnings,
      confidence: response.confidence,
    };

    if (activeSessionId) {
      const existing = await getSession(activeSessionId, userId);
      if (existing) {
        const updatedMessages = [
          ...existing.messages,
          userMsg,
          assistantMsg,
        ];
        const title = existing.title ?? query.slice(0, 50);

        // Check if incoming addresses introduce new wallets
        const existingLower = existing.walletAddresses.map((a: string) => a.toLowerCase());
        const incomingLower = addresses.map((a: string) => a.toLowerCase());
        const allCovered = incomingLower.every((a: string) =>
          existingLower.includes(a),
        );

        if (!allCovered) {
          const mergedAddrs = [...new Set([...existing.walletAddresses, ...addresses])];
          const mergedContext = buildSessionContext(mergedAddrs, contextType);
          await updateSession(activeSessionId, userId, {
            messages: updatedMessages,
            title,
            context: mergedContext,
          });
        } else {
          await updateSession(activeSessionId, userId, {
            messages: updatedMessages,
            title,
          });
        }
      }
    } else {
      const title = query.slice(0, 50);
      const sessionContext = buildSessionContext(addresses, contextType);
      const session = await createSession(userId, sessionContext, title);
      activeSessionId = session.id;
      await updateSession(session.id, userId, {
        messages: [userMsg, assistantMsg],
      });
    }

    return c.json(
      { ...response, sessionId: activeSessionId },
      200,
    );
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

// ─── Session CRUD sub-routes ────────────────────────────────────────────
const sessionRoutes = new Hono()
  .get("/", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload")!;
    const sessions = await getUserSessions(userId);
    return c.json(sessions, 200);
  })
  .post("/", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload")!;
    const body = await c.req.json();
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation error", details: parsed.error.issues },
        400,
      );
    }

    const context = buildSessionContext(parsed.data.addresses, parsed.data.contextType);
    const session = await createSession(userId, context, parsed.data.title);
    return c.json(session, 201);
  })
  .get("/:id", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload")!;
    const sessionId = c.req.param("id")!;
    const session = await getSession(sessionId, userId);

    if (!session) {
      return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
    }

    return c.json(session, 200);
  })
  .put("/:id", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload")!;
    const sessionId = c.req.param("id")!;
    const body = await c.req.json();
    const parsed = updateSessionSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation error", details: parsed.error.issues },
        400,
      );
    }

    const session = await updateSession(sessionId, userId, {
      messages: parsed.data.messages,
      title: parsed.data.title,
    });

    if (!session) {
      return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
    }

    return c.json(session, 200);
  })
  .delete("/:id", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload")!;
    const sessionId = c.req.param("id")!;

    const existing = await getSession(sessionId, userId);
    if (!existing) {
      return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
    }

    await deleteSession(sessionId, userId);
    return c.json({ success: true }, 200);
  });

const app = chatRoute.route("/sessions", sessionRoutes);

export default app;
export type ChatAppType = typeof app;
