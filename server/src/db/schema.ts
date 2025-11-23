import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  decimal,
  varchar,
  serial,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const posts = pgTable("posts_table", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const posts_users_relations = relations(posts, ({ one }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
}));

export const tokenMeta = pgTable("token_meta", {
  address: varchar("address", { length: 44 }).primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  isNative: boolean("is_native").notNull().default(false),
  isWrapped: boolean("is_wrapped").notNull().default(false),
  imageUrl: text("image_url"),
  description: text("description"),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenMarketData = pgTable("token_market_data", {
  address: varchar("address", { length: 44 }),
  priceUsd: decimal().notNull(),
  marketCap: decimal().notNull(),
  usd24hVol: decimal().notNull(),
  usd24hChange: decimal().notNull(),
  high24h: decimal().notNull(),
  low24h: decimal().notNull(),
  fullyDilutedValuation: decimal().notNull(),
  totalVolume: decimal().notNull(),
  circulatingSupply: decimal().notNull(),
  totalSupply: decimal().notNull(),
  maxSupply: decimal().notNull(),
  ath: decimal().notNull(),
  athChangePercentage: decimal().notNull(),
  atl: decimal().notNull(),
  atlChangePercentage: decimal().notNull(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenTransfers = pgTable("token_transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromAddress: varchar("from_address", { length: 44 }).notNull(),
  toAddress: varchar("to_address", { length: 44 }).notNull(),
  amount: decimal().notNull(),
  amountUsd: decimal().notNull(),
  time: integer("time").notNull(),
  tokenAddress: varchar("token_address", { length: 44 }).notNull(),
});

export const wallets = pgTable("wallets", {
  address: varchar("address", { length: 44 }).primaryKey(),
  balanceCount: integer().notNull().default(0),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenMarketData_tokenMeta_relation = relations(
  tokenMarketData,
  ({ one }) => ({
    tokenMeta: one(tokenMeta, {
      fields: [tokenMarketData.address],
      references: [tokenMeta.address],
    }),
  }),
);

function merge<A extends object, B extends object>(a: A, b: B): A & B {
  return { ...a, ...b } as A & B;
}

const dbSelectSchemas = {
  user: users.$inferSelect,
  tokenMeta: tokenMeta.$inferSelect,
  tokenTransfers: tokenTransfers.$inferSelect,
  wallet: wallets.$inferSelect,
  tokenMarketData: merge(tokenMarketData.$inferSelect, {
    tokenMeta: tokenMeta.$inferSelect,
  }),
  post: posts.$inferSelect,
} as const;

type PickFields<Table, Fields extends keyof Table> = {
  [K in Fields]: Table[K];
};

export type DbSelectSchema = typeof dbSelectSchemas;

// Some dark magic chatGPT told me
export type DbSelect<
  Table extends keyof DbSelectSchema,
  Fields extends keyof DbSelectSchema[Table] = keyof DbSelectSchema[Table],
  Relations extends Record<string, any> = {},
> = PickFields<DbSelectSchema[Table], Fields> & {
  [K in keyof Relations]: Relations[K];
};
