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

export interface ChatResponse {
  text: string;
  data: Record<string, unknown>;
  charts: ChartSpec[];
  tables: TableSpec[];
  actions?: ActionSpec[];
}

export interface ChatMessageItem {
  role: "user" | "assistant";
  content: string;
  data?: Record<string, unknown>;
  charts?: ChartSpec[];
  tables?: TableSpec[];
  actions?: ActionSpec[];
}

export interface PredefinedQuestion {
  id: string;
  label: string;
  query: string;
  labelKey?: string;
  queryKey?: string;
}
