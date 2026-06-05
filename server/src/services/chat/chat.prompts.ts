import type { ChatToolDefinition, ChatToolResult, HistoryMessage, PriorContext } from "./chat.types.js";

const MAX_HISTORY_TURNS = 10;
const MAX_HISTORY_CHARS = 4000;

function buildHistoryBlock(history?: HistoryMessage[]): string {
  if (!history?.length) return "";

  const turns: string[] = [];
  const recent = history.slice(-MAX_HISTORY_TURNS);

  for (const msg of recent) {
    const label = msg.role === "user" ? "User" : "Assistant";
    const trimmed = msg.content.length > 1000
      ? msg.content.slice(0, 1000) + "... (truncated)"
      : msg.content;
    turns.push(`${label}: ${trimmed}`);
  }

  let block = turns.join("\n");
  if (block.length > MAX_HISTORY_CHARS) {
    block = block.slice(0, MAX_HISTORY_CHARS) + "\n... (history truncated)";
  }

  return block ? `Conversation so far:\n${block}\n` : "";
}

export function buildToolSelectionPrompt(
  query: string,
  tools: ChatToolDefinition[],
  address: string,
  context?: PriorContext,
  history?: HistoryMessage[],
): string {
  const toolList = tools
    .map(
      (t) =>
        `- ${t.name}: ${t.description}\n  Input schema: ${JSON.stringify(t.input_schema)}`,
    )
    .join("\n\n");

  const lines = [
    "You are a blockchain data analyst assistant. Your task is to select the right tool to answer the user's question about a Solana wallet.",
    "Today's date: " + new Date().toISOString(),
    `Wallet address: ${address}`,
    "",
    "Available tools:",
    toolList,
  ];

  const historyBlock = buildHistoryBlock(history);
  if (historyBlock) {
    lines.push("", historyBlock);
  }

  if (context?.previousResults?.length) {
    lines.push(
      "",
      "Previously fetched data (use these to decide if more data is needed):",
      ...context.previousResults.map(
        (r) => `  - ${r.name} (input: ${JSON.stringify(r.input)}): ${r.error ? `ERROR: ${r.error}` : JSON.stringify(r.data)}`,
      ),
    );
  }

  lines.push(
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
    "If you already have enough data to answer, respond with: { \"type\": \"no_tool\", \"message\": \"ready\" }",
    "If no tool is relevant, respond with: { \"type\": \"no_tool\", \"message\": \"explanation\" }",
    "If the query is about something that can be answered with general knowledge, respond with: { \"type\": \"general\", \"message\": \"answer\" }",
  );

  return lines.join("\n");
}

export function buildResponseGenerationPrompt(
  query: string,
  allResults: ChatToolResult[],
  history?: HistoryMessage[],
): string {
  const systemPrompt = [
    // ── CRITICAL: stated first so it anchors the whole response ──
    "You respond ONLY with a valid JSON object. No markdown, no code blocks, no text outside the JSON.",
    "",
    "You are a blockchain data analyst assistant.",
    "Given the user's question and the tool result data, generate a helpful JSON response.",
    "",
    "RESPONSE STRUCTURE:",
    "- 'text': your natural language response as a single string. Use \\n for newlines.",
    "          Embed <chart id=\"...\" /> and <table id=\"...\" /> markers inline where you want them rendered.",
    "- 'charts': array of chart specs ([] if none)",
    "- 'tables': array of table specs ([] if none)",
    "",
    "CONTENT RULES:",
    "- Use ONLY data from tool results. Do not invent numbers or facts.",
    "- Summarize and explain — do not echo raw data verbatim.",
    "- Be concise and directly answer the question. No jargon unless necessary.",
    "- Include charts/tables only if they genuinely help answer the question.",
    "- When a tool result has 'path' and 'label' fields, include them so the frontend can render a button.",
    "",
    "MARKER FORMAT (inside the 'text' string):",
    "  <chart id=\"your-id\" />",
    "  <table id=\"your-id\" />",
    "Rules:",
    "  - Self-closing. No space before id=. id must be quoted.",
    "  - Each marker on its own line, with a blank line before and after.",
    "  - id must exactly match the id in charts[] or tables[].",
    "",
    "INVALID — never produce these:",
    "  <table> id=\"x\" />      ← space before id",
    "  <table id=\"x\"></table> ← closing tag",
    "  <chart id=x />         ← unquoted id",
    "",
    "CHART SPEC FIELDS:",
    "  id (required), type: line|bar|area|pie (required), dataRef (required),",
    "  title (optional), limit (optional)",
    "",
    "TABLE SPEC FIELDS:",
    "  id (required), dataRef (required), columns: comma-separated (required),",
    "  limit, sortBy, sortDesc (default true),",
    "  filterField + filterValue + filterOp: eq|gt|lt|contains",
    "",
    "EXAMPLE:",
    "User: Show top 5 tokens by PnL and the trend over time.",
    "Output:",
    `{
    "text": "Your portfolio is led by SOL and JUP.\\n\\nTop 5 tokens by PnL:\\n\\n<table id=\\"top_pnl\\" />\\n\\nPnL trend over 30 days:\\n\\n<chart id=\\"pnl_trend\\" />",
    "charts": [{ "id": "pnl_trend", "type": "line", "dataRef": "0", "title": "PnL over time" }],
    "tables": [{ "id": "top_pnl", "dataRef": "1", "columns": "token,pnl", "sortBy": "pnl", "limit": 5 }],
    
  }`,
  ].join("\n");

  return [
    systemPrompt,
    "If the tool result is empty or an error, explain that to the user.",
    "",
    "---",
    buildHistoryBlock(history),
    `User query: ${query}`,
    "",
    "Tool results (use [N] index as dataRef for charts/tables):",
    ...allResults.map(
      (r, i) => `  [${i}] ${r.name}: ${r.error ? `ERROR: ${r.error}` : JSON.stringify(r.data)}`,
    ),
  ].join("\n");
}

export const CHAT_SYSTEM_INSTRUCTION =
  "You are a helpful blockchain wallet analyst. You provide concise, data-driven answers about Solana wallet activity, portfolio, and trading performance. Always base your answers on the provided tool data.";
