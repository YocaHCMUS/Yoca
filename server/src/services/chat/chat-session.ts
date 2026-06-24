import { db } from "@sv/db";
import { chatSessions } from "@sv/db/schema";
import { createHash } from "node:crypto";
import { desc } from "drizzle-orm";
import { and, eq } from "drizzle-orm/sql/expressions/conditions";

export type ChatSessionContextType = "wallet" | "wallet-comparison";

export interface ChatSessionContext {
  contextType: ChatSessionContextType;
  contextHash: string;
  walletAddresses: string[];
}

export interface ChatSessionRow {
  id: string;
  userId: string;
  walletAddresses: string[];
  contextType: ChatSessionContextType;
  contextHash: string;
  title: string | null;
  messages: Record<string, unknown>[];
  createdAt: Date;
  updatedAt: Date;
}


export function sanitizeSessionMessages(
  messages: Record<string, unknown>[],
): Record<string, unknown>[] {
  return messages.map((message) => {
    if (message.role !== "assistant") return message;
    const rest = { ...message };
    delete rest.data;
    return rest;
  });
}

function sanitizeSessionRow(row: ChatSessionRow): ChatSessionRow {
  return {
    ...row,
    messages: sanitizeSessionMessages(row.messages),
  };
}
export function buildSessionContext(
  addresses: string[],
  contextType: ChatSessionContextType = addresses.length > 1 ? "wallet-comparison" : "wallet",
): ChatSessionContext {
  const walletAddresses = [...new Set(
    addresses
      .map((address) => address.trim())
      .filter(Boolean),
  )];
  const normalized = walletAddresses.map((address) => address.toLowerCase()).sort();
  const contextHash = createHash("sha256")
    .update(contextType)
    .update(":")
    .update(normalized.join(","))
    .digest("hex");

  return {
    contextType,
    contextHash,
    walletAddresses,
  };
}

export async function createSession(
  userId: string,
  context: ChatSessionContext,
  title?: string,
): Promise<ChatSessionRow> {
  const [row] = await db
    .insert(chatSessions)
    .values({
      userId,
      walletAddresses: context.walletAddresses,
      contextType: context.contextType,
      contextHash: context.contextHash,
      title: title ?? null,
    })
    .returning();
  return row as ChatSessionRow;
}

export async function getUserSessions(
  userId: string,
): Promise<ChatSessionRow[]> {
  const rows = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt));
  return (rows as ChatSessionRow[]).map(sanitizeSessionRow);
}

export async function getSession(
  sessionId: string,
  userId: string,
): Promise<ChatSessionRow | null> {
  const [row] = await db
    .select()
    .from(chatSessions)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
    );
  return row ? sanitizeSessionRow(row as ChatSessionRow) : null;
}

export async function updateSession(
  sessionId: string,
  userId: string,
  data: {
    messages?: Record<string, unknown>[];
    title?: string;
    context?: ChatSessionContext;
  },
): Promise<ChatSessionRow | null> {
  const values: Partial<typeof chatSessions.$inferInsert> = {};
  if (data.messages !== undefined) {
    values.messages = sanitizeSessionMessages(data.messages);
  }
  if (data.title !== undefined) {
    values.title = data.title;
  }
  if (data.context) {
    values.walletAddresses = data.context.walletAddresses;
    values.contextType = data.context.contextType;
    values.contextHash = data.context.contextHash;
  }

  const [row] = await db
    .update(chatSessions)
    .set(values)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
    )
    .returning();
  return row ? sanitizeSessionRow(row as ChatSessionRow) : null;
}

export async function deleteSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  await db
    .delete(chatSessions)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
    );
}
