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
  type: "line" | "bar" | "area" | "pie" | "geckoterminal";
  dataRef: string;
  title?: string;
  limit?: number;
  pointActions?: DataActionSpec;
  xAxisType?: "category" | "time";
  yAxisFormat?: "currency" | "decimal" | "percent" | "compact-currency";
  xAxisFormat?: "datetime" | "date" | "time";
  /** For geckoterminal chart type: token mint address */
  tokenAddress?: string;
  /** For geckoterminal chart type: pool address resolved server-side */
  poolAddress?: string;
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

export interface ChatSource {
  title: string;
  url: string;
  source: string;
  snippet?: string;
  publishedAt?: string;
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

export interface ChatResponse {
  text: string;
  data: Record<string, unknown>;
  charts: ChartSpec[];
  tables: TableSpec[];
  actions?: ActionSpec[];
  tldr?: string[];
  sections?: WalletChatSection[];
  sources?: ChatSource[];
  evidence?: WalletChatEvidence[];
  warnings?: WalletWarning[];
  confidence?: WalletConfidence;
}

export interface ChatMessageItem {
  role: "user" | "assistant";
  content: string;
  data?: Record<string, unknown>;
  charts?: ChartSpec[];
  tables?: TableSpec[];
  actions?: ActionSpec[];
  tldr?: string[];
  sections?: WalletChatSection[];
  sources?: ChatSource[];
  evidence?: WalletChatEvidence[];
  warnings?: WalletWarning[];
  confidence?: WalletConfidence;
}

export interface PredefinedQuestion {
  id: string;
  label: string;
  query: string;
  labelKey?: string;
  queryKey?: string;
  contextTypes?: ("wallet" | "wallet-comparison")[];
}
