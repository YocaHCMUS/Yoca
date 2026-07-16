import type { ActionSpec, ChartSpec, ChatSource, TableSpec, WalletChatSection, WalletWarning, WalletConfidence } from "./chat.types.js";

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

  // Normalize <cite ids="...">...</cite> tags
  s = s.replace(/<cite\s+ids="([^"]*?)"\s*>((?:(?!<\/cite>)[\s\S])*?)<\/cite>/g, (_m: string, ids: string, content: string) => {
    const clean = content.trim();
    if (!clean) return clean;
    return `<cite ids="${ids}">${clean}</cite>`;
  });

  return s;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Strip markdown fences and leading prose
  let cleaned = trimmed.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();

  // Strip any prose before first { and after last }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Strip trailing commas (common Gemini issue) and retry
    try {
      const fixed = cleaned
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

export function sanitizeResponse(raw: string): {
  rawText: string;
  text: string;
  charts: ChartSpec[];
  tables: TableSpec[];
  actions: ActionSpec[];
  sources?: ChatSource[];
  tldr?: string[];
  sections?: WalletChatSection[];
  warnings?: WalletWarning[];
  confidence?: WalletConfidence;
} {
  const parsed = extractJsonObject(raw) as Record<string, unknown> | null;
  if (!parsed) {
    return { rawText: raw, text: "", charts: [], tables: [], actions: [] };
  }

  const text = sanitizeText((parsed.text as string) ?? "");

  function normalizeAction(a: unknown): Record<string, unknown> | undefined {
    if (!a || typeof a !== "object") return undefined;
    if (Array.isArray(a)) return a.length > 0 && typeof a[0] === "object" && !Array.isArray(a[0]) ? (a[0] as Record<string, unknown>) : undefined;
    return a as Record<string, unknown>;
  }

  const rawCharts: unknown[] = Array.isArray(parsed.charts) ? parsed.charts : [];
  const charts: ChartSpec[] = rawCharts
    .filter((c): c is Record<string, unknown> =>
      c !== null && typeof c === "object" && typeof (c as Record<string, unknown>).id === "string" && (typeof (c as Record<string, unknown>).dataRef === "string" || (c as Record<string, unknown>).type === "geckoterminal"),
    )
    .map((c) => {
      if (c.pointActions != null) {
        c.pointActions = normalizeAction(c.pointActions);
      }
      return c as unknown as ChartSpec;
    });

  const rawTables: unknown[] = Array.isArray(parsed.tables) ? parsed.tables : [];
  const tables: TableSpec[] = rawTables
    .filter((t): t is Record<string, unknown> =>
      t !== null && typeof t === "object" && typeof (t as Record<string, unknown>).id === "string" && typeof (t as Record<string, unknown>).dataRef === "string",
    )
    .map((t) => {
      if (t.rowActions != null) {
        t.rowActions = normalizeAction(t.rowActions);
      }
      return t as unknown as TableSpec;
    });

  const actions: ActionSpec[] = (Array.isArray(parsed.actions) ? parsed.actions : [])
    .filter((a): a is Record<string, unknown> =>
      a !== null && typeof a === "object" &&
      typeof (a as Record<string, unknown>).label === "string",
    )
    .map((a) => {
      const r = a as Record<string, unknown>;
      return {
        label: r.label as string,
        href: typeof r.href === "string" && r.href.trim()
          ? r.href
          : `#ask:${typeof r.query === "string" ? r.query : r.label}`,
        ...(r.index !== undefined ? { index: r.index as number | null } : {}),
      } satisfies ActionSpec;
    });

  const tldr: string[] | undefined = Array.isArray(parsed.tldr)
    ? (parsed.tldr as string[]).filter((s): s is string => typeof s === "string").slice(0, 3)
    : undefined;

  const warnings: WalletWarning[] | undefined = Array.isArray(parsed.warnings)
    ? (parsed.warnings as WalletWarning[]).filter(
        (w): w is WalletWarning =>
          w && typeof w === "object" && typeof w.text === "string" && ["info", "warning", "error"].includes(w.severity),
      ).slice(0, 4)
    : undefined;

  const confidence: WalletConfidence | undefined =
    typeof parsed.confidence === "string" &&
    ["Low", "Medium", "High"].includes(parsed.confidence)
      ? (parsed.confidence as WalletConfidence)
      : undefined;

  const sources: ChatSource[] | undefined = (() => {
    const raw = parsed.sources;
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const valid = raw.filter(
      (s): s is ChatSource =>
        s !== null &&
        typeof s === "object" &&
        typeof (s as Record<string, unknown>).title === "string" &&
        typeof (s as Record<string, unknown>).url === "string" &&
        typeof (s as Record<string, unknown>).source === "string",
    );
    return valid.length > 0 ? valid.slice(0, 10) : undefined;
  })();

  const sections: WalletChatSection[] | undefined = (() => {
    const raw = parsed.sections;
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const valid = raw.filter(
      (s): s is WalletChatSection =>
        s !== null &&
        typeof s === "object" &&
        typeof (s as Record<string, unknown>).title === "string" &&
        typeof (s as Record<string, unknown>).kind === "string",
    );
    return valid.length > 0 ? valid.slice(0, 6) : undefined;
  })();

  // Strip orphan citations — [N] or [N, M, ...] and <cite> tags where any N > sources.length
  const cleanedText = sources && sources.length > 0
    ? text
        .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_m: string, inner: string) => {
          const parts = inner.split(",").map((s) => s.trim()).filter(Boolean);
          const valid = parts.filter((p) => {
            const idx = parseInt(p, 10);
            return !isNaN(idx) && idx >= 1 && idx <= sources.length;
          });
          if (valid.length === 0) return "";
          if (valid.length === 1) return `[${valid[0]}]`;
          return `[${valid.join(", ")}]`;
        })
        .replace(/<cite\s+ids="([^"]+)"\s*>((?:(?!<\/cite>)[\s\S])*?)<\/cite>/g, (_m: string, idsStr: string, content: string) => {
          const parts = idsStr.split(",").map((s) => s.trim()).filter(Boolean);
          const valid = parts.filter((p) => {
            const idx = parseInt(p, 10);
            return !isNaN(idx) && idx >= 1 && idx <= sources.length;
          });
          if (valid.length === 0) return content;
          if (valid.length === parts.length) return _m;
          return `<cite ids="${valid.join(",")}">${content}</cite>`;
        })
    : text;

  return { rawText: raw, text: cleanedText, charts, tables, actions, sources, tldr, sections, warnings, confidence };
}
