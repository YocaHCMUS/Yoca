export interface ChartSpec {
  id: string;
  type: "line" | "bar" | "area" | "pie";
  dataRef: string;
  title?: string;
}

export interface TableSpec {
  id: string;
  dataRef: string;
  columns: string;
}

export interface ChatResponse {
  text: string;
  data: Record<string, unknown>;
  charts: ChartSpec[];
  tables: TableSpec[];
}

export interface ChatMessageItem {
  role: "user" | "assistant";
  content: string;
  data?: Record<string, unknown>;
  charts?: ChartSpec[];
  tables?: TableSpec[];
}

export interface PredefinedQuestion {
  id: string;
  label: string;
  query: string;
}
