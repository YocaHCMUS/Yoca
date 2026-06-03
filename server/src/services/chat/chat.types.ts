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
  data: unknown;
  error?: string;
}

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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  data?: Record<string, unknown>;
  charts?: ChartSpec[];
  tables?: TableSpec[];
}

export interface ChatRequest {
  address: string;
  query: string;
  language?: string;
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
