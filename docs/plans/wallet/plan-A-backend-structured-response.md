# Plan A: Backend — Structured Response Quality for Wallet Chat

## Goal

Upgrade `ChatResponse` from flat text + markers to a structured format with sections, TLDR, evidence provenance, warnings, and confidence — matching the pattern from `token-ai-chat.service.ts`. Add deterministic fallback, Zod validation, content limits, and intent classification.

---

## 1. New Shared Types

**File**: `server/src/services/chat/chat.types.ts` — Add these types:

```ts
// ─── Structured Response Types ───────────────────────────────────────────

export interface WalletChatSection {
  title: string;
  kind:
    | "market_snapshot"
    | "key_findings"
    | "pnl_summary"
    | "trading_activity"
    | "top_holdings"
    | "risk_factors"
    | "what_to_watch"
    | "conclusion"
    | "custom";
  content?: string;
  bullets?: string[];
  table?: Array<Record<string, string | number | null>>;
}

export interface WalletChatEvidence {
  type:
    | "overview"
    | "portfolio"
    | "swap"
    | "transfer"
    | "pnl"
    | "balance"
    | "volume"
    | "audit"
    | "market";
  label: string;
  value?: string;
  detail?: string;
  toolName?: string;
}

export interface WalletWarning {
  text: string;
  severity: "info" | "warning" | "error";
}

export type WalletConfidence = "Low" | "Medium" | "High";
```

**Update the existing `ChatResponse` interface** to make new fields optional (backward compat):

```ts
export interface ChatResponse {
  text: string;
  data: Record<string, unknown>;
  charts: ChartSpec[];
  tables: TableSpec[];
  actions?: ActionSpec[];
  // NEW — optional structured fields
  tldr?: string[];
  sections?: WalletChatSection[];
  evidence?: WalletChatEvidence[];
  warnings?: WalletWarning[];
  confidence?: WalletConfidence;
  asOf?: string;
  generatedAt?: string;
}
```

---

## 2. Intent Classification

**New file**: `server/src/services/chat/chat-intent.ts`

Modeled after `classifyTokenAiIntent()` in `token-ai-chat.service.ts:276`:

```ts
export type WalletChatIntent =
  | "overview"
  | "pnl"
  | "trades"
  | "risk_analysis"
  | "portfolio"
  | "balance_trend"
  | "volume_trend"
  | "audit"
  | "custom";

export function classifyWalletChatIntent(question: string): WalletChatIntent {
  const q = question.toLowerCase();

  // Vietnamese intents
  if (/\b(tổng quan|tổng|kết quả|portfolio)\b/.test(q)) return "overview";
  if (/\b(lợi nhuận|lời lỗ|pnl|win rate|thắng.*thua)\b/.test(q)) return "pnl";
  if (/\b(giao dịch|lệnh|swap|mua|bán|trade)\b/.test(q)) return "trades";
  if (/\b(rủi ro|kiểm toán|audit|hành vi|persona|độ tin cậy)\b/.test(q)) return "risk_analysis";
  if (/\b(nắm giữ|hold|token|tài sản|danh mục)\b/.test(q)) return "portfolio";
  if (/\b(số dư|balance|biến động.*số dư)\b/.test(q)) return "balance_trend";
  if (/\b(khối lượng|volume|khớp lệnh)\b/.test(q)) return "volume_trend";
  if (/\b(forensic|kiểm.*toán|đánh.*giá|phân.*tích)\b/.test(q)) return "audit";

  // English intents
  if (/\b(overview|summary|portfolio)\b/.test(q)) return "overview";
  if (/\b(pnl|profit|loss|win rate|winning)\b/.test(q)) return "pnl";
  if (/\b(trade|swap|buy|sell|transaction)\b/.test(q)) return "trades";
  if (/\b(risk|audit|scam|safe|trust|persona|behavior|forensic)\b/.test(q)) return "risk_analysis";
  if (/\b(holdings?|token|asset|position)\b/.test(q)) return "portfolio";
  if (/\b(balance|trend|history.*balance)\b/.test(q)) return "balance_trend";
  if (/\b(volume|trading.*volume)\b/.test(q)) return "volume_trend";

  return "custom";
}
```

**Language auto-detection** — Add `inferWalletChatLanguage()`:

```ts
export function inferWalletChatLanguage(
  question: string,
  language?: string,
): "en" | "vi" {
  if (language === "vi" || language === "en") return language;
  const q = question.toLowerCase();
  if (
    /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(q) ||
    /\b(token này|rủi ro|không|tin tức|giải thích|nên mua|bán|giữ|tổng quan|lợi nhuận|giao dịch|số dư|khối lượng)\b/.test(q)
  ) return "vi";
  return "en";
}
```

---

## 3. Deterministic Fallback System

**New file**: `server/src/services/chat/chat-fallback.ts`

Modeled after `buildImprovedFallbackSections()` in `token-ai-chat.service.ts:960`. Maps intents to structured sections built from tool results.

### Content Limits (named constants)

```ts
export const WALLET_CHAT_RESPONSE_LIMITS = {
  tldrItems: 3,
  tldrBulletChars: 300,
  sectionItems: 6,
  sectionTitleChars: 100,
  sectionContentChars: 1000,
  sectionBulletItems: 6,
  sectionBulletChars: 500,
  evidenceItems: 8,
  evidenceLabelChars: 120,
  evidenceValueChars: 200,
  warningItems: 4,
  disclaimerChars: 400,
} as const;
```

### Intent → Field Mappings

Each fallback function receives `allResults: ChatToolResult[]` and builds sections:

| Intent | Required Tool Results | Sections Generated |
|--------|----------------------|-------------------|
| `overview` | `get_wallet_overview` [0], `get_wallet_portfolio` [1] | `market_snapshot`, `key_findings`, `what_to_watch` |
| `pnl` | `get_wallet_pnl` [0], `get_pnl_chart` [1], `get_wallet_swaps` [2] | `market_snapshot`, `pnl_summary`, `trading_activity`, `conclusion` |
| `trades` | `get_wallet_swaps` [0], `get_wallet_transfers` [1], `get_token_price` [2] for each unique token | `trading_activity`, `key_findings`, `what_to_watch` |
| `risk_analysis` | `get_wallet_overview` [0], `get_wallet_pnl` [1], `get_wallet_portfolio` [2], `get_wallet_swaps` [3] | `market_snapshot`, `risk_factors`, `top_holdings`, `what_to_watch` |
| `portfolio` | `get_wallet_portfolio` [0], `get_wallet_overview` [1] | `top_holdings`, `market_snapshot` |
| `balance_trend` | `get_balance_history` [0] | `market_snapshot`, `conclusion` |
| `volume_trend` | `get_trading_volume` [0] | `trading_activity`, `conclusion` |
| `audit` | n/a (audit is separate route) | `risk_factors`, `conclusion` |
| `custom` | All available results | `key_findings`, `what_to_watch`, `conclusion` |

### Helper Functions (exact copies from token-ai-chat pattern)

Create these utility functions:

```ts
function compactCurrency(value: unknown): string
function percent(value: unknown): string
function finiteNumber(value: unknown): number | null
function tokenLabel(toolResult: Record<string, unknown>): string
function volumeInterpretation(volumeUsd: number | null): string
function liquidityInterpretation(overview: Record<string, unknown>): string
function pnlInterpretation(pnlData: Record<string, unknown>): string
function confidenceFor(results: ChatToolResult[]): WalletConfidence
function buildEvidence(results: ChatToolResult[]): WalletChatEvidence[]
function buildWarnings(results: ChatToolResult[]): WalletWarning[]
function localizedDisclaimer(language: "en" | "vi"): string
```

### Example Fallback: `overview` intent

```ts
function buildOverviewSections(
  overview: Record<string, unknown> | null,
  portfolio: unknown[],
  language: "en" | "vi",
): WalletChatSection[] {
  // See token-ai-chat.service.ts:978 for pattern
  // Sections: market_snapshot (balance, holdings count, 24h volume),
  //           key_findings (period comparisons),
  //           what_to_watch (price/volume/liquidity signals)
}
```

The main entry point:

```ts
export function buildWalletFallbackResponse(
  query: string,
  intent: WalletChatIntent,
  allResults: ChatToolResult[],
  language: "en" | "vi",
): ChatResponse {
  // Extract results by name
  // Build sections per intent
  // Build TLDR from section bullets
  // Build evidence + warnings
  // Compute confidence
  // Return ChatResponse
}
```

---

## 4. Zod Validation

**Add to `chat.orchestrator.ts`** after Gemini response (line ~226, before `sanitizeResponse`):

```ts
import { z } from "zod";
import { WALLET_CHAT_RESPONSE_LIMITS as L } from "./chat-fallback.js";

const walletSectionSchema = z.object({
  title: z.string().trim().min(1).max(L.sectionTitleChars),
  kind: z.enum(["market_snapshot","key_findings","pnl_summary","trading_activity","top_holdings","risk_factors","what_to_watch","conclusion","custom"]),
  content: z.string().trim().max(L.sectionContentChars).optional(),
  bullets: z.array(z.string().trim().min(1).max(L.sectionBulletChars)).max(L.sectionBulletItems).optional(),
  table: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).max(8).optional(),
});

const walletResponseSchema = z.object({
  text: z.string(),
  tldr: z.array(z.string().trim().min(1).max(L.tldrBulletChars)).min(1).max(L.tldrItems).optional(),
  sections: z.array(walletSectionSchema).min(1).max(L.sectionItems).optional(),
  warnings: z.array(z.object({ text: z.string(), severity: z.enum(["info","warning","error"]) })).max(L.warningItems).optional(),
  confidence: z.enum(["Low", "Medium", "High"]).optional(),
});

function normalizeWalletResponse(raw: unknown) {
  // Like normalizeTokenAiResponseForValidation() in token-ai-chat.service.ts:1679
  // Strip empty sections, truncate oversize fields, default missing values
}
```

After `callGemini` in `generateResponse` (line ~213), parse + validate:

```ts
const parsed = extractJsonObject(raw);
if (parsed && typeof parsed === "object") {
  const normalized = normalizeWalletResponse(parsed);
  const validated = walletResponseSchema.safeParse(normalized);
  if (validated.success) {
    // Merge validated fields into sanitized response
  }
}
```

---

## 5. Prompt Changes

### `chat.prompts.ts` — `buildResponseGenerationPrompt()` changes

**After line 119** (`"You are a blockchain data analyst assistant."`), add:

```
"RESPONSE STRUCTURE (use JSON keys):",
"- 'text': your natural language answer. Include <chart>, <table>, <action> markers as before.",
"- 'tldr': array of 2-3 summary bullet strings (optional). Max 300 chars each.",
"- 'sections': array of section objects (optional). Each section:",
"  { title, kind, content?, bullets?, table? }",
"  kind must be one of: market_snapshot, key_findings, pnl_summary, trading_activity,",
"                       top_holdings, risk_factors, what_to_watch, conclusion, custom",
"- 'warnings': array of { text, severity } objects (optional). severity: info|warning|error",
"- 'confidence': 'Low' | 'Medium' | 'High' (optional)",
"",
"SECTION USAGE GUIDE:",
"- market_snapshot: wallet balance, holdings count, 24h metrics",
"- key_findings: top-level insights (most traded token, biggest PnL, unusual activity)",
"- pnl_summary: profit/loss breakdown, win rate, best/worst performers",
"- trading_activity: swap/transfer details, volume trends",
"- top_holdings: current portfolio breakdown by value",
"- risk_factors: concentration risk, volatility, trading pattern concerns",
"- what_to_watch: signals to monitor going forward",
"- conclusion: bottom-line takeaway",
"",
"MINIMUM USEFULNESS RULE:",
"- Every non-empty section must contain at least one concrete data-backed observation.",
"- Do not simply restate tool results. Explain what the numbers imply.",
"- Be concise. Answer directly. Do not restate the user's question.",
```

**Update `RESPONSE STRUCTURE` block** (around line 121-130) to mention the new optional fields.

### `buildToolSelectionPrompt()` changes

Add language auto-detect instruction after line 45:

```
"IMPORTANT: Detect language from the user query. If it contains Vietnamese characters",
"or common Vietnamese words, the user's language is 'vi'. Otherwise it's 'en'.",
"Use the detected language for ALL subsequent output (tool selection reasoning, response generation).",
```

---

## 6. Orchestrator Changes (`chat.orchestrator.ts`)

### `generateResponse()` — Add structured fields

After the existing `generateResponse` creates `response` (line ~258), add structured fields when available:

```ts
const response: ChatResponse = {
  text: text || getMessage(language, "hereData"),
  data: resolvedData,
  charts,
  tables,
  actions: actions.length > 0 ? actions : undefined,
  // NEW
  tldr: validated.tldr,
  sections: validated.sections,
  evidence: buildEvidenceFromResults(allResults),
  warnings: validated.warnings ?? buildWarningsFromResults(allResults),
  confidence: validated.confidence ?? computeConfidence(allResults),
  asOf: new Date().toISOString(),
  generatedAt: new Date().toISOString(),
};
```

### `answerChatQuery()` — Add intent + fallback

After line 300 (`const allResults: ChatToolResult[] = []`), add:

```ts
const intent = classifyWalletChatIntent(query);
const detectedLang = inferWalletChatLanguage(query, language);
```

After line 370 (`const response = await generateResponse(...)`), add a fallback layer: if response is empty or low-confidence, call `buildWalletFallbackResponse()`:

```ts
if (!response.text && response.charts.length === 0 && response.tables.length === 0) {
  chatWarn("answerChatQuery: Gemini response empty, using deterministic fallback");
  return buildWalletFallbackResponse(query, intent, allResults, detectedLang);
}
```

---

## 7. Cache Key Update

In `chat.cache.ts`, `computeCacheKey` and `getCachedResponse` — include `intent` in the hash so same query with different intent classification produces a different cache entry (line ~58):

```diff
- .update(`${address}|${query.trim().toLowerCase()}|${model}|${fingerprint}`)
+ .update(`${address}|${query.trim().toLowerCase()}|${model}|${fingerprint}|${intent}`)
```

---

## 8. Sanitizer Update (`chat-sanitizer.ts`)

`sanitizeResponse()` should preserve the new structured fields when present. Update the return type:

```ts
export function sanitizeResponse(raw: string): {
  rawText: string;
  text: string;
  charts: ChartSpec[];
  tables: TableSpec[];
  actions: ActionSpec[];
  tldr?: string[];
  sections?: WalletChatSection[];
  warnings?: WalletWarning[];
  confidence?: WalletConfidence;
}
```

Extract the new fields from the parsed JSON alongside existing fields (after line ~52).

---

## 9. Evidence Builder

**Utility in `chat.orchestrator.ts`** or new file `chat-evidence.ts`:

```ts
function buildEvidenceFromResults(results: ChatToolResult[]): WalletChatEvidence[] {
  return results
    .filter((r) => !r.error && r.data != null)
    .map((r) => ({
      type: toolNameToEvidenceType(r.name),
      label: evidenceLabelFor(r),
      value: evidenceValueFor(r),
      detail: evidenceDetailFor(r),
      toolName: r.name,
    }))
    .slice(0, WALLET_CHAT_RESPONSE_LIMITS.evidenceItems);
}

function toolNameToEvidenceType(name: string): WalletChatEvidence["type"] {
  const map: Record<string, WalletChatEvidence["type"]> = {
    get_wallet_overview: "overview",
    get_wallet_swaps: "swap",
    get_wallet_transfers: "transfer",
    get_wallet_pnl: "pnl",
    get_pnl_chart: "pnl",
    get_balance_history: "balance",
    get_trading_volume: "volume",
    get_wallet_portfolio: "portfolio",
    get_historical_portfolio: "portfolio",
    get_token_price: "market",
  };
  return map[name] ?? "overview";
}
```

---

## 10. Confidence Computation

```ts
function computeConfidence(results: ChatToolResult[]): WalletConfidence {
  const total = results.length;
  if (total === 0) return "Low";
  const succeeded = results.filter((r) => !r.error).length;
  const ratio = succeeded / total;
  if (ratio >= 0.8 && total >= 2) return "High";
  if (ratio >= 0.5) return "Medium";
  return "Low";
}
```

---

## Files Changed Summary

| File | Change |
|------|--------|
| `server/src/services/chat/chat.types.ts` | Add `WalletChatSection`, `WalletChatEvidence`, `WalletWarning`, `WalletConfidence`; extend `ChatResponse` |
| `server/src/services/chat/chat-intent.ts` | **New** — `classifyWalletChatIntent()`, `inferWalletChatLanguage()` |
| `server/src/services/chat/chat-fallback.ts` | **New** — `buildWalletFallbackResponse()`, content limits, helper formatters, per-intent builders |
| `server/src/services/chat/chat.orchestrator.ts` | Add intent classification, language detect, Zod validation, deterministic fallback, evidence/warnings/confidence |
| `server/src/services/chat/chat.prompts.ts` | Update system prompt and response generation prompt for structured output |
| `server/src/services/chat/chat-sanitizer.ts` | Preserve new structured fields in sanitize output |
| `server/src/services/chat/chat.cache.ts` | Include `intent` in cache key |
| `server/src/services/chat/chat-evidence.ts` | **New** (optional) — evidence builder utilities |
