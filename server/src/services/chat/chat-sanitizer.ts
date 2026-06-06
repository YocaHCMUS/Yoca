import type { ActionSpec, ChartSpec, TableSpec } from "./chat.types.js";

export function sanitizeText(text: string): string {
  let s = text;

  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&amp;/g, "&");

  s = s.replace(/<(chart|table)>id="([^"]+)"<\/\1>/g, '<$1 id="$2" />');

  s = s.replace(/<(chart|table)>\s*id="([^"]+)"\s*\/>/g, '<$1 id="$2" />');

  s = s.replace(/<(chart|table)(\s+id="[^"]*?")\s*>/g, "<$1$2 />");

  s = s.replace(/<(chart|table)\s+([^>]*?)>/g, (_match: string, tag: string, attrs: string) => {
    const a = String(attrs).replace(/\s+/g, " ").trim();
    if (a.endsWith("/")) {
      return `<${tag} ${a.slice(0, -1).trim()} />`;
    }
    return `<${tag} ${a}>`;
  });

  return s;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;

  const candidate = trimmed.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export function sanitizeResponse(raw: string): {
  rawText: string;
  text: string;
  charts: ChartSpec[];
  tables: TableSpec[];
  actions: ActionSpec[];
} {
  const parsed = extractJsonObject(raw) as Record<string, unknown> | null;
  if (!parsed) {
    return { rawText: raw, text: raw, charts: [], tables: [], actions: [] };
  }

  const text = sanitizeText((parsed.text as string) ?? "");

  const charts: ChartSpec[] = (Array.isArray(parsed.charts) ? parsed.charts : []).filter(
    (c): c is ChartSpec => c && typeof c === "object" && typeof (c as Record<string, unknown>).id === "string" && typeof (c as Record<string, unknown>).dataRef === "string",
  );

  const tables: TableSpec[] = (Array.isArray(parsed.tables) ? parsed.tables : []).filter(
    (t): t is TableSpec => t && typeof t === "object" && typeof (t as Record<string, unknown>).id === "string" && typeof (t as Record<string, unknown>).dataRef === "string",
  );

  const actions: ActionSpec[] = (Array.isArray(parsed.actions) ? parsed.actions : []).filter(
    (a): a is ActionSpec =>
      a && typeof a === "object" &&
      typeof (a as Record<string, unknown>).label === "string" &&
      typeof (a as Record<string, unknown>).href === "string",
  );

  return { rawText: raw, text, charts, tables, actions };
}
