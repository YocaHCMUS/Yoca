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

export interface TableSpec {
  id: string;
  dataRef: string;
  columns: string;
  limit?: number;
  sortBy?: string;
  sortDesc?: boolean;
  filterField?: string;
  filterValue?: unknown;
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
}
