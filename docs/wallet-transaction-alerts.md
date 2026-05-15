# Wallet transaction alerts — implementation record

This document describes how **Helius-driven wallet alerts** are implemented in Yoca: multi-tenant follow lists, user-defined **predicate rules**, and fan-out to **Discord** and **email (Resend)**.

---

## 1. High-level architecture

| Layer | Role |
|--------|------|
| **Helius** | One global enhanced webhook tracks a merged list of Solana addresses. It POSTs batches of enhanced transactions to your server. |
| **Hono `/webhook`** | Authenticates the request, normalizes each transaction, loads matching **`alert_rules`**, evaluates **predicates** (action type, volume band, expiry, ONCE vs ALWAYS), then sends notifications only when rules pass. |
| **PostgreSQL + Drizzle** | Stores users, followed wallets, notification defaults, and granular `alert_rules`. |
| **React `/alerts`** | Lets signed-in users configure Discord/email defaults, follow wallets (Helius address list), and create advanced rules via a two-step modal. |

**Design framing (for documentation or reviews):** *Observer pattern with predicate filtering* — Helius provides a single observable event stream; the server applies per-user, per-wallet boolean predicates before any side effect (Discord/email).

---

## 2. Database schema (`server/src/db/schema.ts`)

### 2.1 `users` (notification defaults)

- `discord_webhook_url` — optional Discord incoming webhook URL.
- `email_alerts_enabled` — toggle for email alerts.
- `email_alerts_address` — optional override; otherwise registered `email` is used when enabled.

### 2.2 `followed_wallets`

- `id` (serial), `user_id` (FK → `users.id`, cascade), `address` (text), `label`, `created_at`.
- **Unique:** `(user_id, address)` — same chain address can be followed by many users.

### 2.3 `alert_rules` (advanced predicates)

| Column | Purpose |
|--------|---------|
| `id` | Serial PK |
| `user_id` | Owner |
| `name` | Optional display name |
| `wallet_address` | Watched Solana address (must appear in tx involvement for a match) |
| `action_type` | Enum: `SWAP`, `TRANSFER`, `ALL` (matched against Helius `type` string) |
| `min_volume`, `max_volume` | Numeric band (`max_volume` null = no upper cap) |
| `volume_unit` | `USD` or `SOL` (USD uses implied rate; see env) |
| `trigger_type` | `ONCE` or `ALWAYS` |
| `expiry_date` | Rule ignored after this time |
| `one_shot_fired_at` | Set after a successful notify when `trigger_type = ONCE` |
| `use_default_delivery` | If true, use `users` Discord + email settings |
| `discord_webhook_override`, `email_override` | Used when `use_default_delivery` is false |

Enums in Postgres: `alert_rule_action`, `alert_rule_trigger`, `alert_rule_volume_unit`.

### 2.4 Migrations

- **`postgresdb/migrations/0003_illegal_tag.sql`** (name from Drizzle; content trimmed for safety) creates the alert-rule enums and `alert_rules` table + FK.
- Earlier migrations cover `followed_wallets` and user email/Discord columns.
- Apply with: `cd server && npm run db:migrate` (requires `POSTGRES_DB_URL` in `.env`).

---

## 3. Helius address list sync

**Service:** `server/src/services/followedWallets.service.ts`

- **`getFollowedWalletAddresses()`** returns the **union** of:
  - all `followed_wallets.address`, and  
  - all `alert_rules.wallet_address`.
- **`syncHeliusWebhookAccountAddresses()`** GETs the existing Helius webhook (to preserve encoding/txnStatus if present), then PUTs:
  - `webhookURL`, `transactionTypes: ["ANY"]`, `accountAddresses` (merged list, may be `[]`), `webhookType: "enhanced"`, `authHeader` matching the webhook route.

**When sync runs:** after adding/removing a **followed wallet**, and after creating/deleting an **alert rule**.

**Important:** An empty DB list sends **`[]`** to Helius so tracking of old addresses stops (full list replacement).

---

## 4. Webhook receiver (`server/src/routes/webhook.ts`)

### 4.1 Authentication

- Header **`Authorization`** must equal the configured secret (e.g. `thisisphuonglekey`), aligned with Helius `authHeader`.

### 4.2 Processing flow

1. Parse body as an array of Helius enhanced transactions.
2. **Deduplicate** by `signature` (in-memory cache, bounded size) to soften Helius retries.
3. **Normalize** amounts: SOL from swaps (incl. wSOL mint) and native transfers; compute totals / max native legs.
4. **Involved addresses:** fee payer, `accountData`, native + token transfer endpoints.
5. **Load candidates:** `findActiveRulesForAddresses(involved)` — not expired, and either `ALWAYS` or `ONCE` with `one_shot_fired_at` still null.
6. For each rule:
   - Require `rule.wallet_address` ∈ involved set.
   - Match **action type** (substring / equality on Helius `type`).
   - Compute a **SOL notional** (depends on rule action: swap-heavy vs transfer vs ALL).
   - **USD band:** multiply SOL notional by **`WEBHOOK_SOL_PRICE_USD`** (default `150` if unset).
   - Check **min/max volume** against the chosen unit.
7. **Dispatch:** `resolveRuleDelivery(rule)` → default user settings or overrides; POST Discord JSON embed; send email via Resend.
8. If **at least one channel succeeds** and `trigger_type = ONCE`, set **`one_shot_fired_at`**.

### 4.3 Response

- Always respond **`200`** with body **`Webhook received`** on successful parse path (even if no rules fire), so Helius does not retry indefinitely for application-level “no match”.

---

## 5. Alert rules API (`server/src/routes/alerts.route.ts`)

All under **`/api/alerts`**, JWT via cookie (`AUTH_COOKIE_NAME` + `JWT_SECRET`).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/rules` | List **active** rules for the user (`expiry_date` > now) |
| `POST` | `/rules` | Create rule (Zod validated); then **Helius sync** |
| `DELETE` | `/rules/:ruleId` | Delete user’s rule; then **Helius sync** |

Existing routes (unchanged in spirit):

- `GET/POST /`, `DELETE /:id` — followed wallets  
- `GET/PATCH /settings` — Discord + email defaults  

**Service module:** `server/src/services/alertRules.service.ts` (CRUD helpers, `findActiveRulesForAddresses`, `resolveRuleDelivery`, `markRuleOneShotFired`).

---

## 6. Email (`server/src/services/email.service.ts`)

- **Resend** SDK; requires **`RESEND_API_KEY`** and **`RESEND_FROM`** in `server/.env`.
- **`sendAlertEmail`** returns `boolean` success for webhook bookkeeping.

---

## 7. Frontend (`client/src/pages/alerts/`)

### 7.1 Main page (`index.tsx`)

- Requires auth; loads **settings**, **followed wallets**, and **alert rules** table.
- Sections: Discord URL, email toggle + override, **Advanced alert rules** (table + “Create new alert”), **Follow wallet** (Helius list) with delete per row.

### 7.2 Create rule modal (`CreateAlertRuleModal.tsx`)

- **Step 1 — Criteria:** wallet, action type, min/max volume, USD vs SOL, ONCE/ALWAYS, expiry (`datetime-local`).
- **Step 2 — Delivery:** “Use default” toggle; optional Discord + email overrides; alert name; **read-only message preview** (localized template).
- Submits `POST /api/alerts/rules` with JSON; refreshes rule list on success.

### 7.3 Localization

- Strings under **`alertsPage.*`** in `client/src/config/localization/en.ts` and `vi.ts`.

### 7.4 Dev proxy (`client/vite.config.ts`)

- For **`ngrok http 3000`**, Vite proxies **`/api`** and **`/webhook`** to **`VITE_SERVER_PROXY_TARGET`** (e.g. `http://localhost:4000`) so the public URL hits the Hono app.

---

## 8. Environment variables (server)

| Variable | Role |
|----------|------|
| `JWT_SECRET`, cookie name | Auth for `/api/alerts/*` |
| `POSTGRES_DB_URL` | Drizzle / migrations |
| `HELIUS_API_KEY`, `HELIUS_WEBHOOK_ID`, `HELIUS_API_BASE` | Webhook PUT/GET (default base often `https://api-mainnet.helius-rpc.com`) |
| `WEBHOOK_PUBLIC_URL` | Full URL of **your** webhook (e.g. `https://<ngrok>/webhook`) |
| `WEBHOOK_SOL_PRICE_USD` | Implied SOL→USD for **USD** volume rules |
| `RESEND_API_KEY`, `RESEND_FROM` | Email alerts |
| `SERVER_PORT` | Hono listen port (default `4000`) |

Optional legacy / admin forward URLs were removed from the main webhook path in favor of **rule-only** notifications.

---

## 9. Local / ngrok testing

1. Run Postgres; **`npm run db:migrate`** in `server/`.
2. Start API: **`npm run dev`** (or `server:dev`) on port **4000**.
3. Either:
   - **`ngrok http 4000`** and set `WEBHOOK_PUBLIC_URL` to `https://<host>/webhook`, **or**
   - **`ngrok http 3000`** with Vite proxy enabled and same path via the dev server.
4. Add wallets and/or rules so **`syncHeliusWebhookAccountAddresses`** pushes addresses to Helius.
5. Trigger on-chain activity for a watched address; confirm logs and Discord/email.

---

## 10. Behavioural notes

- **Notifications are driven by `alert_rules`.** If a user only follows a wallet but has **no** matching rule, they will **not** get alerts from the predicate pipeline (by design).
- **Multiple users** can define **different** rules for the **same** address; Helius sends **one** POST per batch; the server evaluates **each** rule independently.
- **`ONCE`** rules stop firing after a **successful** delivery attempt (Discord OK and/or email OK).

---

## 11. File index (quick reference)

| Area | Files |
|------|--------|
| Schema | `server/src/db/schema.ts` |
| Migrations | `server/postgresdb/migrations/` (incl. `0003_*.sql` for `alert_rules`) |
| Webhook | `server/src/routes/webhook.ts` |
| Alerts API | `server/src/routes/alerts.route.ts` |
| Follow + Helius sync | `server/src/services/followedWallets.service.ts` |
| Rules + delivery resolution | `server/src/services/alertRules.service.ts` |
| Email | `server/src/services/email.service.ts` |
| App mount | `server/src/main.ts` (`/api/alerts`, `/webhook`) |
| UI | `client/src/pages/alerts/index.tsx`, `CreateAlertRuleModal.tsx` |
| i18n | `client/src/config/localization/en.ts`, `vi.ts` |
| Dev proxy | `client/vite.config.ts` |

---

*Last updated to reflect the wallet transaction alerts stack: Helius webhook, `alert_rules` predicates, Discord/Resend fan-out, and `/alerts` UI.*
