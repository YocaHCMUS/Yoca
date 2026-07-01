import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const enumAuthProvider = pgEnum("auth_provider", [
  "password",
  "google",
  "github",
  "solana",
  "other",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: varchar("display_name"),
    // Email is not needed for wallet users, see it as contact
    email: varchar("email"),
    avatarUrl: varchar("avatar_url"),
    discordWebhookUrl: text("discord_webhook_url"),
    emailAlertsEnabled: boolean("email_alerts_enabled")
      .notNull()
      .default(false),
    /** Optional override: if set, alerts go here instead of users.email */
    emailAlertsAddress: text("email_alerts_address"),
    /** Stripe Customer ID — created lazily on first payment attempt */
    stripeCustomerId: varchar("stripe_customer_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_uq")
      .on(table.email)
      .where(sql`${table.email} IS NOT NULL`),
  ],
);

export const userLinkedWallets = pgTable(
  "user_linked_wallets",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletAddress: varchar("wallet_address", { length: 44 }).notNull(),
    isAuthWallet: boolean("is_auth_wallet").notNull().default(false),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.walletAddress],
    }),
  ],
);

export const userTokenWatchlist = pgTable(
  "user_token_watch_list",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tokenAddress] })],
);

export const userWalletWatchlist = pgTable(
  "user_wallet_watch_list",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletAddress: varchar("wallet_address", { length: 44 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.walletAddress] })],
);

export const userWalletLabels = pgTable(
  "user_wallet_labels",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletAddress: varchar("wallet_address", { length: 44 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.walletAddress] })],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: enumAuthProvider("provider").notNull(),
    providerUserId: varchar("provider_user_id").notNull(),
    hashedPassword: varchar("hashed_password"),
    loginNounce: varchar("login_nounce"),
    nounceExpiredAt: timestamp("nounce_expired_at"),
  },
  (table) => [
    primaryKey({
      columns: [table.provider, table.providerUserId],
    }),
    uniqueIndex("auth_accounts_user_provider_uq").on(
      table.userId,
      table.provider,
    ),
    check(
      "provider_password",
      sql`(${table.provider} = 'password' AND ${table.hashedPassword} IS NOT NULL)
          OR
          (${table.provider} <> 'password' AND ${table.hashedPassword} IS NULL)`,
    ),
  ],
);

export const passwordResetCodes = pgTable(
  "password_reset_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email").notNull(),
    codeHash: varchar("code_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("password_reset_codes_email_created_at_idx").on(
      table.email,
      table.createdAt,
    ),
    index("password_reset_codes_user_id_idx").on(table.userId),
  ],
);

// #region Types
export type UserInsert = typeof users.$inferInsert;
export type UserSelect = typeof users.$inferSelect;
export type UserLinkedWalletInsert = typeof userLinkedWallets.$inferInsert;
export type UserLinkedWalletSelect = typeof userLinkedWallets.$inferSelect;
export type UserTokenWatchlistInsert = typeof userTokenWatchlist.$inferInsert;
export type UserTokenWatchlistSelect = typeof userTokenWatchlist.$inferSelect;
export type UserWalletWatchlistInsert = typeof userWalletWatchlist.$inferInsert;
export type UserWalletWatchlistSelect = typeof userWalletWatchlist.$inferSelect;
export type UserWalletLabelInsert = typeof userWalletLabels.$inferInsert;
export type UserWalletLabelSelect = typeof userWalletLabels.$inferSelect;
export type AuthAccountInsert = typeof authAccounts.$inferInsert;
export type AuthAccountSelect = typeof authAccounts.$inferSelect;
export type PasswordResetCodeInsert = typeof passwordResetCodes.$inferInsert;
export type PasswordResetCodeSelect = typeof passwordResetCodes.$inferSelect;
// #endregion
