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
  addresses: string[],
  context?: PriorContext,
  history?: HistoryMessage[],
  language?: string,
): string {
  const toolList = tools
    .map(
      (t) =>
        `- ${t.name}: ${t.description}\n  Input schema: ${JSON.stringify(t.input_schema)}`,
    )
    .join("\n\n");

  const langInstruction = language && language !== "en"
    ? `IMPORTANT: The user's language is ${language}. You MUST select tools and respond in that language. All reasoning, tool selection justification, and output must be in ${language}.`
    : "The user's language is English. Respond in English.";

  const walletList = addresses
    .map((addr, i) => `[${i}] ${addr}`)
    .join("\n");

  const lines = [
    "You are a blockchain data analyst assistant. Your task is to select the right tool to answer the user's question about Solana wallets.",
    langInstruction,
    "IMPORTANT: Detect language from the user query. If it contains Vietnamese characters or common Vietnamese words (e.g. tổng quan, giao dịch, số dư, khối lượng, rủi ro), the user's language is 'vi'. Otherwise it's 'en'.",
    "Use the detected language for ALL subsequent output (tool selection reasoning, response generation).",
    "Today's date: " + new Date().toISOString(),
    `You are analyzing ${addresses.length} wallet${addresses.length > 1 ? "s" : ""}:`,
    walletList,
    "",
    "When you select a wallet-scoped tool, it runs for ALL wallets. Results are labeled by address index [0], [1], etc.",
    "",
    "PARAMETER RULES:",
    "- 'tokenAddress' fields ALWAYS require the Solana token mint address (base58), NEVER the token symbol or name.",
    "- If the user gives a token symbol/name (e.g. 'SOL', 'USDC'), call search_token first to resolve it to a base58 mint address.",
    "- 'address' fields refer to the Solana wallet address (base58).",
    "- 'search_news': Use for recent crypto news about tokens, projects, or market events. Query should include token name/symbol and be specific. Returns article headlines with source URLs.",
    "- 'search_web': Use for general web content — project docs, analysis, technical info, GitHub, announcements. Prefer search_news if the user is asking about 'news' or 'latest'.",
    "- Both search tools return article/webpage snippets with links. Cite sources when you use them.",
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
  language?: string,
): string {
  const langInstruction = language && language !== "en"
    ? `IMPORTANT: The user's language is ${language}. Generate the 'text' field entirely in ${language}. Translate chart titles, table headers, and data labels into ${language}.`
    : "The user's language is English. Generate the 'text' field in English.";

  const systemPrompt = [
    // ── CRITICAL: stated first so it anchors the whole response ──
    "You respond ONLY with a valid JSON object. No markdown, no code blocks, no text outside the JSON.",
    "",
    "You are a blockchain data analyst assistant.",
    langInstruction,
    "Given the user's question and the tool result data, generate a helpful JSON response.",
    "",
    "RESPONSE STRUCTURE:",
    "- 'text': your natural language response as a single string. Use \\n for newlines.",
    "          Embed <chart id=\"...\" />, <table id=\"...\" />, and <action id=\"N\" /> markers inline where you want them rendered.",
    "- 'charts': array of chart specs ([] if none)",
    "- 'tables': array of table specs ([] if none)",
    "- 'actions': array of action button specs ([] if none). Each action: { label, href, index }.",
    "    - index: number → button is placed inline at <action id=\"N\" /> marker position in text.",
    "    - index: null or omitted → button is appended at the end of the response.",
    "    - Multiple actions with the same index render as a button group at that marker.",
    "- 'tldr': array of 2-3 summary bullet strings (optional). Max 300 chars each.",
    "- 'sections': array of section objects (optional). Each section:",
    "  { title, kind, content?, bullets?, table? }",
    "  kind must be one of: market_snapshot, key_findings, pnl_summary, trading_activity,",
    "                       top_holdings, risk_factors, what_to_watch, conclusion, custom",
    "- 'warnings': array of { text, severity } objects (optional). severity: info|warning|error",
    "- 'confidence': 'Low' | 'Medium' | 'High' (optional)",
    "- 'sources': array of { title, url, source, snippet?, publishedAt? } objects (optional). Use ONLY for web search results.",
    "    Each source: { title, url, source (publisher/domain), snippet (article excerpt), publishedAt (ISO date) }.",
    "    Map from search article fields: description → snippet, publishedAt → publishedAt.",
    "    Max 5 sources. Do NOT include sources for non-search tools.",
    "    CRITICAL: sources array indices are 1-based. The first entry is index 1. Re-number sequentially.",
    "",
    "SOURCE CITATION RULES:",
    "- When you use search_news or search_web results, you MUST cite them in the 'sources' field.",
    "- Extract title, url, source, snippet, and publishedAt from the article objects.",
    "- In the 'text' field, cite sources by wrapping the supported text in <cite> tags:",
    "  <cite ids=\"1\">SOL price increased 20%</cite> in the last quarter.",
    "  For claims backed by multiple sources: <cite ids=\"1,2\">Ecosystem growth continues</cite>",
    "- The ids attribute is a comma-separated list of 1-based indices into the sources array.",
    "- Each <cite> tag must wrap only the text that the source(s) specifically support.",
    "- Do NOT reuse [N] bracket notation — use <cite> tags exclusively.",
    "- Never fabricate sources. Only cite what is actually in the search tool results.",
    "",
    "SECTION USAGE GUIDE:",
    "- market_snapshot: wallet balance, holdings count, 24h metrics",
    "- key_findings: top-level insights (most traded token, biggest PnL, unusual activity)",
    "- pnl_summary: profit/loss breakdown, win rate, best/worst performers",
    "- trading_activity: swap/transfer details, volume trends",
    "- top_holdings: current portfolio breakdown by value",
    "- risk_factors: concentration risk, volatility, trading pattern concerns",
    "- what_to_watch: signals to monitor going forward",
    "- conclusion: bottom-line takeaway",
    "",
    "MINIMUM USEFULNESS RULE:",
    "- Every non-empty section must contain at least one concrete data-backed observation.",
    "- Do not simply restate tool results. Explain what the numbers imply.",
    "- Be concise. Answer directly. Do not restate the user's question.",
    "",
    "CONTENT RULES:",
    "- Use ONLY data from tool results. Do not invent numbers or facts.",
    "- Summarize and explain — do not echo raw data verbatim.",
    "- Be concise and directly answer the question. No jargon unless necessary. No lengthy explanations or additional uneeded information. No explainations of what you are doing or what data you are using. Just answer the question using the data.",
    "",
    "TEXT FORMATTING: All text fields (text, sections[].content, sections[].bullets[], tldr[], warnings[].text) are PLAIN TEXT only.",
    "They do NOT support markdown: no **bold**, no *italic*, no backticks, no markdown lists or headings.",
    "Use \\n for newlines and the supported inline markers (<chart />, <table />, <action />) only.",
    "- Include charts/tables only if they genuinely help answer the question.",
    "- When a tool result has 'path' and 'label' fields, include them so the frontend can render a button.",
    "- Before concluding any token, address, or entity is absent from the data, internally verify:",
    "   1. State how many total rows the dataset has",
    "   2. State every unique token/identifier you found across ALL rows",
    "   3. Only then answer the user's question",
    "- Do not restate the user's question or introduce what you are about to say.",
    "- Answer directly. Bad: 'Regarding your request for X, there are 5 transactions.'",
    "- Good: 'There are 5 transactions:'",
    "",
    "ACTION FOLLOW-UP SUGGESTIONS:",
    "- After answering, suggest 1-3 follow-up questions as action buttons to keep the conversation flowing.",
    "- Each follow-up: { label: 'Button text', href: '#ask:your question here', index: null }",
    "- Use href format '#ask:...' so the frontend treats it as a question prompt.",
    "- Set index to null so follow-ups always append at the end, never inline.",
    "- Examples:",
    "  { label: 'Check PnL for token X', href: '#ask:Show me the wallet's profit and loss breakdown for token X(mint address)', index: null }",
    "  { label: 'View wallet trade for day Y', href: '#ask:what were the trades for day Y?', index: null }",
    "FOLLOW-UP SUGGESTION RULES:",
    "- Suggestions must be grounded in what the data actually showed.",
    "  Bad: 'Show me more transactions', 'show pnl'  ← too vague",
    "  Bad: repeat of the same question  ← already answered in this response",
    "  Good: 'What was the PnL on these 5 HANTA trades?' ← specific next step",
    "- Do not suggest questions already answered in the current response.",
    "- Prefer questions that reveal something new: PnL, comparison, trend, or time range drill-down.",
    "",
    "INLINE ACTION BUTTONS:",
    "- For navigation links (e.g. 'View Token', 'View Transaction'), use index: 0, 1, 2.",
    "- Place <action id=\"0\" />, <action id=\"1\" /> markers in text where each button should appear.",
    "- Example text: 'Check out SOL: <action id=\"0\" /> and JUP: <action id=\"1\" />'",
    "- Each unique index gets its own marker; group related buttons under the same index.",
    "",
    "MARKER FORMAT (inside the 'text' string):",
    "  <chart id=\"your-id\" />",
    "  <table id=\"your-id\" />",
    "  <action id=\"0\" />    ← replaces with action button(s) whose index matches",
    "Rules:",
    "  - Self-closing. No space before id=. id must be quoted.",
    "  - Each marker on its own line, with a blank line before and after.",
    "  - id must exactly match the id in charts[], tables[], or the index in actions[].",
    "",
    "INVALID — never produce these:",
    "  <table> id=\"x\" />      ← space before id",
    "  <table id=\"x\"></table> ← closing tag",
    "  <chart id=x />         ← unquoted id",
    "",
    "CHART SPEC FIELDS:",
    "  id (required), type: line|bar|area|pie|geckoterminal (required), dataRef (required — always set, even for geckoterminal),",
    "    Use 'pie' for composition/breakdown data. 'line'/'area' for time series. 'bar' for comparisons.",
    "    Use 'geckoterminal' to render an interactive GeckoTerminal price chart (iframe). For token price queries (get_token_price_24h/hourly/daily), ALWAYS prefer 'geckoterminal' over 'line'/'area'. Set tokenAddress field. Also set dataRef to the tool result index.",
    "  title (optional), limit (optional)",
    "  pointActions (required): { label, query } — single object, NOT array. Per-data-point follow-up action.",
    "    Uses {label} as x-axis label variable for interpolation.",
    "    Hover shows query preview in tooltip, click sends query.",
    "    Example: { \"label\": \"View {label}\", \"query\": \"show trades on {label}\" }",
    "    If not meaningful follow ups can be generated for chart points, dont set the value.",
    "  xAxisType: 'category' (default, string labels) or 'time' (auto-formatted timestamps from ms values).",
    "    Use 'time' when labels are Unix timestamps in milliseconds.",
    "  xAxisFormat: when xAxisType='time', controls x-axis label rendering: 'datetime', 'date', or 'time'.",
    "    'datetime' shows full date+time, 'date' shows date only, 'time' shows time only.",
    "  yAxisFormat: controls y-axis value rendering: 'currency', 'decimal', 'percent', 'compact-currency'.",
    "    'currency' formats as $X,XXX.XX, 'compact-currency' as $1.2K/$1.2M, 'percent' as 12.34%, 'decimal' as raw number.",
    "",
    "TABLE SPEC FIELDS:",
    "  id (required), dataRef (required), columns: comma-separated (required),",
    "  rowActions (required): { label, query } — single object, NOT array. Per-row follow-up action.",
    "    Uses {fieldName} vars from row data for interpolation.",
    "    Hover shows query preview, click sends query.",
    "    Example: { \"label\": \"Analyze {symbol}\", \"query\": \"Show PnL for {symbol}\" }",
    "    If not meaningful follow ups can be generated for table rows, dont set the value.",
    "  columns format: 'fieldName:DisplayTitle:format' or 'fieldName:DisplayTitle' or 'fieldName'",
    "    format can be: currency, decimal, percent, address, datetime, date, time, relative, text",
    "    Examples: 'totalValueUsd:Total Value:currency,token:Token,amount:Amount:decimal'",
    "    By default: fields ending in Usd/Price/Value/Pnl/Volume use currency; Percent/Rate/Change use percent;",
    "    At/Time/Date use datetime; Address/Hash use address; everything else is decimal.",
    "  limit, sortBy, sortDesc (default true),",
    "  filters: array of {field, value, op} where op is eq|gt|lt|contains",
    "  filterMode: 'and' (default, all filters must match) or 'or' (any filter matches)",
    "  FILTER PRIORITY RULE:",
    "  the user references a token, apply filters in this order of preference:",
    "   1. filterField: 'tokenSymbol', filterOp: 'eq'  ← always try this first (exact symbol match)",
    "   2. filterField: 'tokenMint',   filterOp: 'eq'  ← if user gives an address",
    "   3. filterField: 'tokenName',   filterOp: 'contains' ← only if no symbol match exists in the data",
    "",
    "  When multiple tokens share the same symbol, include ALL of them — do not pick one.",
    "  Never use 'contains' on a symbol field. Symbols are exact identifiers, not search terms.",
    "",
    "EXAMPLE (with sources):",
    "User: What is the latest news about SOL?",
    "Output:",
    `{
    "text": "SOL has been trending up this week. <cite ids="1">Recent coverage highlights strong ecosystem growth</cite> and <cite ids="1,2">new DeFi integrations</cite>.\\n\\nKey developments:\\n- <cite ids="1">Jupiter exchange volume hit new highs</cite>\\n- <cite ids="2">Solana mobile adoption growing</cite>",
    "sources": [
      { "title": "Solana Ecosystem Report Q1 2025", "url": "https://example.com/solana-report", "source": "CoinDesk", "snippet": "Solana's DeFi TVL grew 40% in Q1 driven by Jupiter and marginfi.", "publishedAt": "2025-03-15T10:00:00Z" },
      { "title": "Jupiter DEX Volume Surpasses $X", "url": "https://example.com/jupiter-volume", "source": "The Block", "snippet": "Jupiter's monthly volume surpassed $X in February.", "publishedAt": "2025-03-10T08:30:00Z" }
    ]
  }`,
    "",
    "EXAMPLE (PnL analysis, no sources):",
    "User: Show top 5 tokens by PnL and the trend over time.",
    "Output:",
    `{
    "text": "Your portfolio is led by SOL and JUP.\\n\\nTop 5 tokens by PnL:\\n\\n<table id=\\"top_pnl\\" />\\n\\nPnL trend over 30 days:\\n\\n<chart id=\\"pnl_trend\\" />",
    "charts": [{ "id": "pnl_trend", "type": "line", "dataRef": "0", "title": "PnL over time" }],
    "tables": [{ "id": "top_pnl", "dataRef": "1", "columns": "token,pnl", "sortBy": "pnl", "limit": 5 }]
  }`,
    "",
    "EXAMPLE (time-series chart with formatting):",
    "User: Show portfolio balance over the last 7 days.",
    `Output:
{
    "text": "Here is the balance trend:\\n\\n<chart id="balance" />",
    "charts": [{
      "id": "balance",
      "type": "area",
      "dataRef": "0",
      "title": "Balance (7d)",
      "xAxisType": "time",
      "xAxisFormat": "datetime",
      "yAxisFormat": "currency"
    }]
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
    "Tool results (use [N] index as dataRef for charts/tables).",
    "IMPORTANT: Only create tables for results that contain arrays. Single-object results (e.g. token price, token details, overview) do not have tabular data.",
    "Tool results:",
    ...allResults.map(
      (r, i) => `  [${i}] ${r.name}: ${r.error ? `ERROR: ${r.error}` : JSON.stringify(r.data)}`,
    ),
  ].join("\n");
}

export const CHAT_SYSTEM_INSTRUCTION =
  "You are a helpful blockchain wallet analyst. You provide concise, data-driven answers about Solana wallet activity, portfolio, and trading performance. Always base your answers on the provided tool data. Generate all text in the user's language.\n\nWhen the user compares multiple wallets, highlight:\n- Which wallet performs better (PnL, win rate, volume)\n- Unique tokens / common holdings\n- Risk differences between wallets\nUse side-by-side tables when appropriate.";
