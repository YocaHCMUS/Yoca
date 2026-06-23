import { Hono } from "hono";
import { z } from "zod";
import { answerChatQuery, createPrompt, deletePrompt, forkPrompt, getPrompt, incrementPromptUsage, listPrompts, updatePrompt } from "@sv/services/chat/index.js";
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
  skipCache: z.boolean().optional(),
  skipSessionSave: z.boolean().optional(),
  promptId: z.string().optional(),
});

const createPromptSchema = z.object({
  label: z.string().min(1).max(255),
  query: z.string().min(1).max(2000),
  contextTypes: z.array(z.enum(["wallet", "wallet-comparison"])).min(1).optional(),
  walletAddress: z.string().min(32).max(48).optional().nullable(),
  isPublic: z.boolean().optional(),
  forkedFrom: z.string().optional().nullable(),
});

const updatePromptSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  query: z.string().min(1).max(2000).optional(),
  contextTypes: z.array(z.enum(["wallet", "wallet-comparison"])).min(1).optional(),
  walletAddress: z.string().min(32).max(48).optional().nullable(),
  isPublic: z.boolean().optional(),
});

const listPromptSchema = z.object({
  scope: z.enum(["mine", "new", "popular"]).default("new"),
  walletAddress: z.string().optional(),
  contextType: z.enum(["wallet", "wallet-comparison"]).optional(),
  sort: z.enum(["usage", "recent", "trending"]).optional(),
  search: z.string().trim().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const createSessionSchema = z.object({
  addresses: z.array(z.string().min(32).max(48)).min(1).max(10),
  contextType: z.enum(["wallet", "wallet-comparison"]).optional(),
  title: z.string().max(255).optional(),
});

const messageContextSchema = z.object({
  contextType: z.enum(["wallet", "wallet-comparison"]),
  walletAddresses: z.array(z.string()),
});

const updateSessionSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        context: messageContextSchema.optional(),
        data: z.any().optional(),
        charts: z.any().optional(),
        tables: z.any().optional(),
        actions: z.any().optional(),
        tldr: z.array(z.string()).optional(),
        sections: z.any().optional(),
        sources: z.any().optional(),
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

    const { addresses, query, language, history, sessionId, contextType, skipCache, skipSessionSave, promptId } = parsed.data;
    const response = await answerChatQuery(addresses, query, language, history, skipCache);

    if (promptId) {
      incrementPromptUsage(promptId).catch(() => {});
    }

    let activeSessionId = sessionId;

    if (!skipSessionSave) {
      // Resolve the context that will be stamped on messages
      let resolvedContext = buildSessionContext(addresses, contextType);

      if (activeSessionId) {
        const existing = await getSession(activeSessionId, userId);
        if (existing) {
          const existingLower = existing.walletAddresses.map((a: string) => a.toLowerCase());
          const incomingLower = addresses.map((a: string) => a.toLowerCase());
          const allCovered = incomingLower.every((a: string) =>
            existingLower.includes(a),
          );

          if (!allCovered) {
            const mergedAddrs = [...new Set([...existing.walletAddresses, ...addresses])];
            resolvedContext = buildSessionContext(mergedAddrs, contextType);
          }
        }
      }

      const contextInfo = {
        contextType: resolvedContext.contextType,
        walletAddresses: resolvedContext.walletAddresses,
      };

      const userMsg: Record<string, unknown> = {
        role: "user",
        content: query,
        context: contextInfo,
      };
      const assistantMsg: Record<string, unknown> = {
        role: "assistant",
        content: response.text,
        context: contextInfo,
        data: response.data,
        charts: response.charts,
        tables: response.tables,
        actions: response.actions,
        tldr: response.tldr,
        sections: response.sections,
        sources: response.sources,
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

          await updateSession(activeSessionId, userId, {
            messages: updatedMessages,
            title,
            context: resolvedContext,
          });
        }
      } else {
        const title = query.slice(0, 50);
        const session = await createSession(userId, resolvedContext, title);
        activeSessionId = session.id;
        await updateSession(session.id, userId, {
          messages: [userMsg, assistantMsg],
        });
      }
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

// ─── Prompt CRUD sub-routes ──────────────────────────────────────────────
const promptRoutes = new Hono()
  .get("/", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload")!;
    const query = c.req.query();
    const parsed = listPromptSchema.safeParse(query);

    if (!parsed.success) {
      return c.json(
        { error: "Validation error", details: parsed.error.issues },
        400,
      );
    }

    const result = await listPrompts({
      userId,
      ...parsed.data,
    });
    return c.json(result, 200);
  })
  .post("/", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload")!;
    const body = await c.req.json();
    const parsed = createPromptSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation error", details: parsed.error.issues },
        400,
      );
    }

    const prompt = await createPrompt({
      userId,
      label: parsed.data.label,
      query: parsed.data.query,
      contextTypes: parsed.data.contextTypes,
      walletAddress: parsed.data.walletAddress,
      isPublic: parsed.data.isPublic,
      forkedFrom: parsed.data.forkedFrom,
    });
    return c.json(prompt, 201);
  })
  .get("/:id", honoJwt, userExtract, async (c) => {
    const promptId = c.req.param("id")!;
    const prompt = await getPrompt(promptId);

    if (!prompt) {
      return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
    }

    return c.json(prompt, 200);
  })
  .put("/:id", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload")!;
    const promptId = c.req.param("id")!;
    const body = await c.req.json();
    const parsed = updatePromptSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation error", details: parsed.error.issues },
        400,
      );
    }

    const prompt = await updatePrompt(promptId, userId, parsed.data);

    if (!prompt) {
      return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
    }

    return c.json(prompt, 200);
  })
  .delete("/:id", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload")!;
    const promptId = c.req.param("id")!;

    const existing = await getPrompt(promptId);
    if (!existing || existing.userId !== userId) {
      return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
    }

    await deletePrompt(promptId, userId);
    return c.json({ success: true }, 200);
  })
  .post("/:id/fork", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload")!;
    const promptId = c.req.param("id")!;

    const body = await c.req.json().catch(() => ({}));
    const parsed = z.object({
      label: z.string().max(255).optional(),
      isPublic: z.boolean().optional(),
    }).safeParse(body);

    const prompt = await forkPrompt(promptId, userId, {
      label: parsed.success ? parsed.data.label : undefined,
      isPublic: parsed.success ? parsed.data.isPublic : undefined,
    });

    if (!prompt) {
      return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
    }

    return c.json(prompt, 201);
  });

const app = chatRoute
  .route("/sessions", sessionRoutes)
  .route("/prompts", promptRoutes);

export default app;
export type ChatAppType = typeof app;
