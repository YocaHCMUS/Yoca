# Plan B: Frontend — Rich Response Rendering for Wallet Chat

## Goal

Upgrade `WalletChatMessage.tsx` and related components to render structured responses with sections, TLDR, warnings, confidence badges, evidence grids, rich text highlighting (metrics, bold, bullets), input validation, and suggested question chips — matching the UX pattern from `TokenAIChat.tsx`.

---

## 1. New/Updated Shared Types

**File**: `client/src/components/wallet/WalletChat/types.ts` — Add:

```ts
// ─── Structured Response Types ───────────────────────────────────────────

export type WalletSectionKind =
  | "market_snapshot"
  | "key_findings"
  | "pnl_summary"
  | "trading_activity"
  | "top_holdings"
  | "risk_factors"
  | "what_to_watch"
  | "conclusion"
  | "custom";

export interface WalletChatSection {
  title: string;
  kind: WalletSectionKind;
  content?: string;
  bullets?: string[];
  table?: Array<Record<string, string | number | null>>;
}

export interface WalletChatEvidence {
  type: "overview" | "portfolio" | "swap" | "transfer" | "pnl" | "balance" | "volume" | "audit" | "market";
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

**Update `ChatMessageItem`** to include optional structured fields:

```ts
export interface ChatMessageItem {
  role: "user" | "assistant";
  content: string;
  data?: Record<string, unknown>;
  charts?: ChartSpec[];
  tables?: TableSpec[];
  actions?: ActionSpec[];
  // NEW — optional structured fields
  tldr?: string[];
  sections?: WalletChatSection[];
  evidence?: WalletChatEvidence[];
  warnings?: WalletWarning[];
  confidence?: WalletConfidence;
}
```

---

## 2. Rich Text Renderer

**New component**: Add to `WalletChatMessage.tsx` (or create `WalletChatRichText.tsx` in same dir).

Mirrors `TokenAiRichText` from `client/src/components/token/TokenAIChat.tsx:277`.

### Metric/Signal Token Pattern

```ts
const METRIC_OR_SIGNAL_PATTERN =
  /([+-]\d+(?:\.\d+)?%|\$\s?\d[\d,]*(?:\.\d+)?\s?(?:K|M|B|T)?|\b\d[\d,]*(?:\.\d+)?\s?(?:million|billion|trillion)?|\b(?:bearish|decline|declines|declined|drop|drops|dropped|selling|pressure|risk|risks|outflow|outflows|loss|losses)\b|\b(?:bullish|growth|increase|increases|increased|inflow|inflows|support|liquidity|adoption|profitable|win)\b|\b(?:warning|unavailable|missing|cannot verify|not available|limited data)\b)/gi;
```

### Token Color Classes

```scss
// In WalletChat.module.scss — add:
.metricPositive { color: #24a148; font-weight: 600; }  // +X%
.metricNegative { color: #da1e28; font-weight: 600; }  // -X%
.metricMoney { color: #f1c21b; font-weight: 600; }      // $X
.riskText { color: #fa4d56; }                           // bearish/drop/risk
.bullishText { color: #42be65; }                        // bullish/growth
.warningText { color: #f1c21b; }                        // warning/unavailable
.metricNeutral { color: #8d8d8d; }                      // fallback
.metricToken { display: inline; }                        // base class
.richStrong { font-weight: 700; color: #e0e0e0; }       // **bold**
```

### Component Spec: `WalletRichText`

Props:
```ts
interface WalletRichTextProps {
  text?: string | number | null;
  inline?: boolean;   // true = no paragraph splitting, single-line rendering
}
```

Behavior (match `TokenAiRichText`):
1. If `inline`, render with `renderInlineRichText()` only — no block splitting
2. If not `inline`, split by `\n\n` into blocks
3. Each block: detect if all lines are bullet-like (`/^\s*(?:[-*\u2022]\s+|\d+[.)]\s+)/`)
   - All bullet-like → render as `<ul><li>` with cleaned text
   - Mixed → render as paragraphs + bullet divs
4. Inside each text segment: parse `**bold**` via `splitBoldSegments()`, then pass each segment through `renderMetricTokens()` which finds `METRIC_OR_SIGNAL_PATTERN` matches and wraps them in colored `<span>` tags

---

## 3. Section Rendering

**New component**: Add to `WalletChatMessage.tsx` — `WalletChatSectionRenderer`.

Mirrors `AnswerSection` from `TokenAIChat.tsx:419`.

### Kind → Meta Map

```ts
const SECTION_KIND_META: Record<WalletSectionKind, { label: string; icon: string; className: string }> = {
  market_snapshot:  { label: "Market Snapshot",  icon: "M", className: "kindMarket" },
  key_findings:     { label: "Key Findings",     icon: "K", className: "kindDrivers" },
  pnl_summary:      { label: "PnL Summary",      icon: "P", className: "kindBullish" },
  trading_activity: { label: "Trading Activity", icon: "T", className: "kindNews" },
  top_holdings:     { label: "Top Holdings",     icon: "H", className: "kindDeepDive" },
  risk_factors:     { label: "Risk Factors",     icon: "!", className: "kindRisk" },
  what_to_watch:    { label: "What To Watch",    icon: "?", className: "kindWatch" },
  conclusion:       { label: "Conclusion",       icon: "✓", className: "kindConclusion" },
  custom:           { label: "Analysis",         icon: "A", className: "kindSimple" },
};
```

### SCSS Section Classes (add to `WalletChat.module.scss`)

```scss
// Section header with icon + kind badge
.sectionHeader { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.sectionIcon { width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; }
.sectionKind { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6f6f6f; }
.sectionContent { margin-bottom: 0.5rem; }
.sectionBulletList { list-style: none; padding: 0; margin: 0; li { padding: 2px 0; font-size: 13px; line-height: 1.5; } }

// Kind-specific icon colors
.kindMarket .sectionIcon { background: #0f62fe; }
.kindDrivers .sectionIcon { background: #8a3ffc; }
.kindRisk .sectionIcon { background: #da1e28; }
.kindWatch .sectionIcon { background: #ff832b; }
.kindBullish .sectionIcon { background: #24a148; }
.kindNews .sectionIcon { background: #1192e8; }
.kindDeepDive .sectionIcon { background: #009d9a; }
.kindConclusion .sectionIcon { background: #6f6f6f; }
.kindSimple .sectionIcon { background: #525252; }
// ... copy remaining from TokenAIChat.module.scss patterns
```

### Inline Section Table

Render `section.table` as a simple HTML table (no pagination needed — token AI chat pattern). Mirror `SectionTable()` from `TokenAIChat.tsx:378`:

```ts
function SectionTable({ table }: { table: Array<Record<string, string | number | null>> }) {
  const columns = useMemo(() => {
    const keys = new Set<string>();
    table.forEach(row => Object.keys(row).forEach(k => keys.add(k)));
    return [...keys].slice(0, 6);
  }, [table]);
  // Render <table><thead><tr><th>...</th></tr></thead><tbody>...</tbody></table>
  // Each cell renders WalletRichText inline
}
```

---

## 4. TLDR Block

In `WalletChatMessage.tsx`, when `message.tldr` exists, render at the top of assistant messages:

```tsx
{message.tldr && message.tldr.length > 0 && (
  <div className={styles.tldr}>
    <div className={styles.tldrHeader}>
      <span className={styles.tldrIcon}>AI</span>
      <h3>TLDR</h3>
    </div>
    <ol>
      {message.tldr.map((item, idx) => (
        <li key={idx}>
          <span className={styles.tldrNumber}>{idx + 1}</span>
          <WalletRichText text={item} inline />
        </li>
      ))}
    </ol>
  </div>
)}
```

### SCSS

```scss
.tldr {
  background: rgba(15, 98, 254, 0.08);
  border-left: 3px solid #0f62fe;
  border-radius: 4px;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}
.tldrHeader { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; h3 { margin: 0; font-size: 13px; font-weight: 600; } }
.tldrIcon { width: 24px; height: 24px; background: #0f62fe; color: #fff; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
.tldrNumber { width: 18px; height: 18px; background: #0f62fe; color: #fff; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; margin-right: 0.5rem; flex-shrink: 0; }
```

---

## 5. Warnings Block

Render when `message.warnings` exists:

```tsx
{message.warnings && message.warnings.length > 0 && (
  <div className={styles.warnings}>
    <div className={styles.warnHeader}>
      <span className={styles.warnIcon}>!</span>
      <h3>Data Limitations</h3>
    </div>
    <ul>
      {message.warnings.map((w, i) => (
        <li key={i} className={styles[`warn${w.severity === "error" ? "Error" : w.severity === "warning" ? "Warning" : "Info"}`]}>
          <WalletRichText text={w.text} inline />
        </li>
      ))}
    </ul>
  </div>
)}
```

### SCSS

```scss
.warnings { background: rgba(218, 30, 40, 0.06); border-left: 3px solid #da1e28; border-radius: 4px; padding: 0.75rem; margin: 0.5rem 0; }
.warnHeader { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
.warnIcon { color: #da1e28; font-weight: 700; }
.warnError { color: #da1e28; }
.warnWarning { color: #f1c21b; }
.warnInfo { color: #8d8d8d; }
```

---

## 6. Confidence Badge

Render when `message.confidence` exists, at top of assistant bubble:

```tsx
{message.confidence && (
  <span className={classNames(styles.confidenceBadge, styles[`confidence${message.confidence}`])}>
    {message.confidence} confidence
  </span>
)}
```

### SCSS

```scss
.confidenceBadge { display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 6px; border-radius: 3px; margin-bottom: 0.5rem; }
.confidenceHigh { background: rgba(36, 161, 72, 0.15); color: #24a148; }
.confidenceMedium { background: rgba(241, 194, 27, 0.15); color: #f1c21b; }
.confidenceLow { background: rgba(218, 30, 40, 0.1); color: #fa4d56; }
```

---

## 7. Evidence Grid

Render when `message.evidence` exists. Mirrors the evidence section from `TokenAIChat.tsx:670`:

```tsx
{message.evidence && message.evidence.length > 0 && (
  <div className={styles.evidenceBlock}>
    <h3>Evidence</h3>
    <div className={styles.evidenceGrid}>
      {message.evidence.slice(0, showAllEvidence ? undefined : 6).map((item, idx) => (
        <div key={idx} className={styles.evidenceCard}>
          <span className={styles[`evidenceType${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`]}>
            {item.type}
          </span>
          <strong><WalletRichText text={item.label} inline /></strong>
          {item.value && <div className={styles.evidenceValue}><WalletRichText text={item.value} inline /></div>}
          {item.detail && <div className={styles.evidenceDetail}><WalletRichText text={item.detail} /></div>}
        </div>
      ))}
    </div>
    {message.evidence.length > 6 && (
      <button type="button" onClick={() => setShowAllEvidence(v => !v)}>
        {showAllEvidence ? "Show less" : `Show all (${message.evidence.length})`}
      </button>
    )}
  </div>
)}
```

### Evidence Type Badge Colors

```scss
.evidenceTypeOverview { background: #0f62fe20; color: #0f62fe; }
.evidenceTypePortfolio { background: #8a3ffc20; color: #8a3ffc; }
.evidenceTypeSwap { background: #1192e820; color: #1192e8; }
.evidenceTypeTransfer { background: #009d9a20; color: #009d9a; }
.evidenceTypePnl { background: #24a14820; color: #24a148; }
.evidenceTypeBalance { background: #ff832b20; color: #ff832b; }
.evidenceTypeVolume { background: #f1c21b20; color: #f1c21b; }
.evidenceTypeAudit { background: #da1e2820; color: #da1e28; }
.evidenceTypeMarket { background: #52525220; color: #525252; }
```

---

## 8. Suggested Question Chips

Add below each assistant response when `message.actions` exist with `#ask:` hrefs.

Mirrors `SUGGESTED_QUESTIONS` chips from `TokenAIChat.tsx:529` but uses message-level actions.

In `WalletChatMessage.tsx`, after rendering content:

```tsx
{endActions.filter(a => a.href.startsWith("#ask:")).length > 0 && (
  <div className={styles.chips}>
    {endActions.filter(a => a.href.startsWith("#ask:")).map((a, i) => (
      <button key={i} type="button" className={styles.chip} onClick={() => onAction?.(a.href.slice(5))}>
        {a.label}
      </button>
    ))}
  </div>
)}
```

### SCSS

```scss
.chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 0.5rem; }
.chip { font-size: 11px; padding: 4px 8px; border-radius: 12px; border: 1px solid #353535; background: transparent; color: #c6c6c6; cursor: pointer; white-space: nowrap; }
.chip:hover { border-color: #0f62fe; color: #0f62fe; }
.chip:disabled { opacity: 0.4; cursor: not-allowed; }
```

---

## 9. Input Validation

In `WalletChat.tsx`, add character counter + validation (mirrors `TokenAIChat.tsx:471`):

```tsx
const MAX_INPUT_LENGTH = 500;
const trimmedInput = inputText.trim();
const inputValidationError =
  trimmedInput.length === 0 ? null
  : trimmedInput.length > MAX_INPUT_LENGTH ? "Question must be 500 characters or fewer."
  : null;
```

Add counter below input bar:

```tsx
<div className={styles.inputMeta}>
  <span>{inputText.length}/{MAX_INPUT_LENGTH}</span>
  {inputText.length > 0 && inputValidationError && (
    <span className={styles.validationError}>{inputValidationError}</span>
  )}
</div>
```

Disable send button when over limit:

```tsx
disabled={isLoading || !inputText.trim() || inputText.length > MAX_INPUT_LENGTH}
```

### SCSS

```scss
.inputMeta { display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem; padding: 0 4px; font-size: 11px; color: #6f6f6f; }
.validationError { color: #da1e28; }
```

---

## 10. WalletChatMessage.tsx — Full Rendering Logic

Update the main render of `WalletChatMessage` (line ~112):

```
function WalletChatMessage({ message, onAction }: Props):
  if (message.role === "user"): return existing user bubble

  // Parse markers for inline charts/tables as before
  const parsed = parseMarkers(message.content)
  const { inlineByIndex, endActions } = existing logic

  // Always render TLDR first if present
  if (message.tldr): render TLDR block

  // Render confidence badge
  if (message.confidence): render confidence badge

  // Render parsed text parts with WalletRichText (not plain text)
  for each part in parsed:
    if text part: render <WalletRichText text={part.content} />
    if chart: render ChartRenderer (existing)
    if table: render TableRenderer (existing)
    if action: render action button group (existing)

  // Render sections if present
  if (message.sections): render each section via WalletChatSectionRenderer

  // Render warnings if present
  if (message.warnings): render warnings block

  // Render evidence if present
  if (message.evidence): render evidence block with collapse

  // Render end actions as suggested question chips (if #ask:)
  render chips from endActions with #ask: prefix

  // Render remaining end actions as buttons
  if endActions without #ask:: render existing action button group
```

**Key change**: Replace `part.content` rendering from plain `<div>` to `<WalletRichText>` for text parts. This enables metric highlighting, bold, and bullet formatting for ALL text — even in responses without the new structured fields.

---

## 11. WalletChat.tsx — Connect to Backend

In `WalletChat.tsx`, the `sendQuery` response handler (line ~68) already maps `ChatResponse` to `ChatMessageItem`. Extend it:

```ts
const data = (await res.json()) as ChatResponse;
const assistantMsg: ChatMessageItem = {
  role: "assistant",
  content: data.text,
  data: data.data,
  charts: data.charts,
  tables: data.tables,
  actions: data.actions,
  // NEW — passthrough structured fields
  tldr: data.tldr,
  sections: data.sections,
  evidence: data.evidence,
  warnings: data.warnings,
  confidence: data.confidence,
};
```

These fields will be `undefined` for old responses (backward compatible).

---

## 12. Localization (i18n)

Add/update translation keys for new UI strings:

```ts
// In localization files:
"chat.tldr": "TLDR",
"chat.warnings": "Data Limitations",
"chat.evidence": "Evidence",
"chat.confidence": "Confidence",
"chat.richText.positive": "Positive signal",
"chat.richText.negative": "Negative signal",
"chat.showAll": "Show all ({count})",
"chat.showLess": "Show less",
"chat.inputCounter": "{current}/{max}",
"chat.inputOverLimit": "Question must be {max} characters or fewer.",
```

---

## 13. Backward Compatibility

- All new fields on `ChatMessageItem` are optional (`?`)
- Old responses without `sections`, `tldr`, etc. render exactly as before (flat text with chart/table markers)
- `WalletRichText` enhances ALL text rendering — old responses get metric highlighting and bold parsing for free
- The existing `parseMarkers` logic is unchanged — chart/table/action embeds continue to work

---

## Files Changed/Created Summary

| File | Change |
|------|--------|
| `client/src/components/wallet/WalletChat/types.ts` | Add `WalletChatSection`, `WalletChatEvidence`, `WalletWarning`, `WalletConfidence`; extend `ChatMessageItem` |
| `client/src/components/wallet/WalletChat/WalletChatMessage.tsx` | Add `WalletRichText`, `WalletChatSectionRenderer`, `SectionTable`; update render to include TLDR, warnings, confidence, evidence, chips, rich text formatting |
| `client/src/components/wallet/WalletChat/WalletChat.module.scss` | Add styles for all new elements (TLDR, sections, warnings, evidence grid, confidence badge, chips, metric tokens, input validation) |
| `client/src/components/wallet/WalletChat/WalletChat.tsx` | Add input validation (char counter, error display); extend response handler to pass through new fields |
