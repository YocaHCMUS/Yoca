import { db } from "@sv/db";
import { chatPrompts } from "@sv/db/schema";
import { and, desc, eq, isNull, or, sql, type SQL } from "drizzle-orm";

export type PromptContextType = "wallet" | "wallet-comparison";

export interface ChatPromptData {
  id: string;
  userId: string;
  label: string;
  query: string;
  contextTypes: string[];
  walletAddress: string | null;
  forkedFrom: string | null;
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PromptScope = "mine" | "public" | "popular";

export interface ListPromptsOptions {
  userId: string;
  scope: PromptScope;
  walletAddress?: string;
  contextType?: PromptContextType;
  sort?: "usage" | "recent" | "trending";
  page?: number;
  limit?: number;
}

export interface ListPromptsResult {
  items: ChatPromptData[];
  total: number;
  page: number;
  limit: number;
}

function toData(row: typeof chatPrompts.$inferSelect): ChatPromptData {
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    query: row.query,
    contextTypes: row.contextTypes,
    walletAddress: row.walletAddress ?? null,
    forkedFrom: row.forkedFrom ?? null,
    isPublic: row.isPublic,
    usageCount: row.usageCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listPrompts(opts: ListPromptsOptions): Promise<ListPromptsResult> {
  const { userId, scope, walletAddress, contextType, sort, page = 1, limit = 50 } = opts;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  if (scope === "mine") {
    conditions.push(eq(chatPrompts.userId, userId));
  } else if (scope === "public" || scope === "popular") {
    conditions.push(eq(chatPrompts.isPublic, true));
  }

  if (walletAddress) {
    conditions.push(
      or(
        eq(chatPrompts.walletAddress, walletAddress),
        isNull(chatPrompts.walletAddress),
      )!,
    );
  }

  if (contextType) {
    conditions.push(sql`${chatPrompts.contextTypes} @> ${sql`ARRAY[${contextType}]::text[]`}`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy = sort === "usage"
    ? desc(chatPrompts.usageCount)
    : sort === "trending"
      ? desc(chatPrompts.usageCount)
      : desc(chatPrompts.createdAt);

  const rows = await db
    .select()
    .from(chatPrompts)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(chatPrompts)
    .where(where);

  return {
    items: rows.map(toData),
    total: Number(count),
    page,
    limit,
  };
}

export async function getPrompt(id: string): Promise<ChatPromptData | null> {
  const [row] = await db
    .select()
    .from(chatPrompts)
    .where(eq(chatPrompts.id, id));
  return row ? toData(row) : null;
}

export async function createPrompt(data: {
  userId: string;
  label: string;
  query: string;
  contextTypes?: string[];
  walletAddress?: string | null;
  isPublic?: boolean;
  forkedFrom?: string | null;
}): Promise<ChatPromptData> {
  const [row] = await db
    .insert(chatPrompts)
    .values({
      userId: data.userId,
      label: data.label,
      query: data.query,
      contextTypes: data.contextTypes ?? ["wallet"],
      walletAddress: data.walletAddress ?? null,
      isPublic: data.isPublic ?? false,
      forkedFrom: data.forkedFrom ?? null,
    })
    .returning();
  return toData(row);
}

export async function updatePrompt(
  id: string,
  userId: string,
  data: {
    label?: string;
    query?: string;
    contextTypes?: string[];
    walletAddress?: string | null;
    isPublic?: boolean;
  },
): Promise<ChatPromptData | null> {
  const values: Partial<typeof chatPrompts.$inferInsert> = {};
  if (data.label !== undefined) values.label = data.label;
  if (data.query !== undefined) values.query = data.query;
  if (data.contextTypes !== undefined) values.contextTypes = data.contextTypes;
  if (data.walletAddress !== undefined) values.walletAddress = data.walletAddress ?? null;
  if (data.isPublic !== undefined) values.isPublic = data.isPublic;

  const [row] = await db
    .update(chatPrompts)
    .set(values)
    .where(and(eq(chatPrompts.id, id), eq(chatPrompts.userId, userId)))
    .returning();
  return row ? toData(row) : null;
}

export async function deletePrompt(id: string, userId: string): Promise<void> {
  await db
    .delete(chatPrompts)
    .where(and(eq(chatPrompts.id, id), eq(chatPrompts.userId, userId)));
}

export async function forkPrompt(
  id: string,
  userId: string,
  overrides?: { label?: string; query?: string; isPublic?: boolean },
): Promise<ChatPromptData | null> {
  const original = await getPrompt(id);
  if (!original) return null;

  return createPrompt({
    userId,
    label: overrides?.label ?? original.label,
    query: overrides?.query ?? original.query,
    contextTypes: original.contextTypes,
    walletAddress: original.walletAddress,
    isPublic: overrides?.isPublic ?? false,
    forkedFrom: original.id,
  });
}

export async function incrementPromptUsage(id: string): Promise<void> {
  await db
    .update(chatPrompts)
    .set({ usageCount: sql`${chatPrompts.usageCount} + 1` })
    .where(eq(chatPrompts.id, id));
}
