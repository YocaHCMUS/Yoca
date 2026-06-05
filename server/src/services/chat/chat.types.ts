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
}

export interface ChartSpec {
  id: string;
  type: "line" | "bar" | "area" | "pie";
  dataRef: string;
  title?: string;
  limit?: number;
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
  /** @deprecated Use `filters` array instead */
  filterField?: string;
  /** @deprecated Use `filters` array instead */
  filterValue?: unknown;
  /** @deprecated Use `filters` array instead */
  filterOp?: "eq" | "gt" | "lt" | "contains";
}

export interface ChatResponse {
  text: string;
  data: Record<string, unknown>;
  charts: ChartSpec[];
  tables: TableSpec[];
  actions?: ActionSpec[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  data?: Record<string, unknown>;
  charts?: ChartSpec[];
  tables?: TableSpec[];
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  address: string;
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
