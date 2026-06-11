export interface ChatToolParam {
  type: string;
  description?: string;
  enum?: string[];
}

export interface ChatToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, ChatToolParam & { type: string; description?: string }>;
    required?: string[];
  };
}

export interface ChatToolCall {
  type: "tool_use";
  name: string;
  input: Record<string, unknown>;
}

export interface ChatToolResult {
  name: string;
  input: Record<string, unknown>;
  data: unknown;
  fullData?: unknown;
  error?: string;
}

export interface PriorToolResult {
  name: string;
  input: Record<string, unknown>;
  data: unknown;
  error?: string;
}

export interface PriorContext {
  previousResults: PriorToolResult[];
}

export interface ActionSpec {
  label: string;
  href: string;
  index?: number | null;
}

export interface DataActionSpec {
  label: string;
  query: string;
}

export interface ChartSpec {
  id: string;
  type: "line" | "bar" | "area" | "pie";
  dataRef: string;
  title?: string;
  limit?: number;
  pointActions?: DataActionSpec;
}

export interface TableFilter {
  field: string;
  value: unknown;
  op: "eq" | "gt" | "lt" | "contains";
}

export interface TableSpec {
  id: string;
  dataRef: string;
  columns: string;
  limit?: number;
  sortBy?: string;
  sortDesc?: boolean;
  filters?: TableFilter[];
  filterMode?: "and" | "or";
  rowActions?: DataActionSpec;
  /** @deprecated Use `filters` array instead */
  filterField?: string;
  /** @deprecated Use `filters` array instead */
  filterValue?: unknown;
  /** @deprecated Use `filters` array instead */
  filterOp?: "eq" | "gt" | "lt" | "contains";
}

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

export interface ChatResponse {
  text: string;
  data: Record<string, unknown>;
  charts: ChartSpec[];
  tables: TableSpec[];
  actions?: ActionSpec[];
  tldr?: string[];
  sections?: WalletChatSection[];
  evidence?: WalletChatEvidence[];
  warnings?: WalletWarning[];
  confidence?: WalletConfidence;
  asOf?: string;
  generatedAt?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  data?: Record<string, unknown>;
  charts?: ChartSpec[];
  tables?: TableSpec[];
  actions?: ActionSpec[];
  tldr?: string[];
  sections?: WalletChatSection[];
  evidence?: WalletChatEvidence[];
  warnings?: WalletWarning[];
  confidence?: WalletConfidence;
}

export interface WebSearchArticle {
  title: string;
  url: string;
  description: string;
  source: string;
  publishedAt: string | null;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  addresses: string[];
  query: string;
  language?: string;
  history?: HistoryMessage[];
}

export interface ChatCacheEntry {
  key: string;
  walletAddress: string;
  query: string;
  response: ChatResponse;
  dataFingerprint: string;
  model: string;
  fetchedAt: Date;
  ttlMs: number;
}
