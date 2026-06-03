import type { ChatToolDefinition } from "./chat.types.js";

export function buildToolSelectionPrompt(
  query: string,
  tools: ChatToolDefinition[],
  address: string,
): string {
  const toolList = tools
    .map(
      (t) =>
        `- ${t.name}: ${t.description}\n  Input schema: ${JSON.stringify(t.input_schema)}`,
    )
    .join("\n\n");

  return [
    "You are a blockchain data analyst assistant. Your task is to select the right tool to answer the user's question about a Solana wallet.",
    "",
    `Wallet address: ${address}`,
    "",
    "Available tools:",
    toolList,
    "",
    "User query:",
    query,
    "",
    "Respond with ONLY a JSON object in the following format (no markdown, no code blocks):",
    JSON.stringify(
      {
        type: "tool_use",
        tools: [
          { name: "tool_name1", input: { param1: "value1" } },
        ],
      },
      null,
      2,
    ),
    "",
    "If the query requires multiple data sources, include all relevant tools in the tools array.",
    "If no tool is relevant, respond with: { \"type\": \"no_tool\", \"message\": \"explanation\" }",
    "If the query is about something that can be answered with general knowledge, respond with: { \"type\": \"general\", \"message\": \"answer\" }",
  ].join("\n");
}

export function buildResponseGenerationPrompt(
  query: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  toolData: unknown,
): string {
  return [
    "You are a blockchain data analyst assistant. Given the user's question and the tool result data, generate a helpful response.",
    "",
    "RULES:",
    "- Use ONLY the data provided in the tool result. Do NOT invent numbers or facts.",
    "- Do NOT echo the raw data back verbatim. Summarize and explain it.",
    "- Keep responses concise and focused on the user's question.",
    "- When the data contains time-series or numeric data suitable for visualization, insert <chart> markers.",
    "- When the data contains tabular data (lists of items with consistent fields), insert <table> markers.",
    "- Markers must be on their own line.",
    "",
    "Chart marker format:",
    "<chart id=\"unique-id\" type=\"line|bar|area|pie\" data-ref=\"data_key\" title=\"Chart Title\" />",
    "",
    "Table marker format:",
    "<table id=\"unique-id\" data-ref=\"data_key\" columns=\"col1,col2,col3\" />",
    "",
    "For each marker, include the corresponding data in the response JSON under the \"data\" key.",
    "The \"data\" key maps reference names to the actual data arrays or objects.",
    "",
    "IMPORTANT: Respond with ONLY a JSON object (no markdown, no code blocks):",
    JSON.stringify(
      {
        text: "Your response text with <chart> and <table> markers where appropriate...",
        data: {
          chart_data_key: { labels: ["label1", "label2"], datasets: [{ name: "series", values: [10, 20] }] },
          table_data_key: [{ col1: "val1", col2: "val2", col3: "val3" }],
        },
        charts: [
          { id: "chart-id", type: "line", dataRef: "chart_data_key", title: "Chart Title" },
        ],
        tables: [
          { id: "table-id", dataRef: "table_data_key", columns: ["col1", "col2", "col3"] },
        ],
      },
      null,
      2,
    ),
    "",
    "If the tool result is empty or an error, explain that to the user.",
    "",
    "---",
    `User query: ${query}`,
    `Tool used: ${toolName}`,
    `Tool input: ${JSON.stringify(toolInput)}`,
    `Tool result data: ${JSON.stringify(toolData)}`,
  ].join("\n");
}

export const CHAT_SYSTEM_INSTRUCTION =
  "You are a helpful blockchain wallet analyst. You provide concise, data-driven answers about Solana wallet activity, portfolio, and trading performance. Always base your answers on the provided tool data.";
