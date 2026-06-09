import { GoogleGenAI } from "@google/genai";
import {
  GOOGLE_AI_KEY,
  CHAT_MODEL,
} from "@sv/config/constants.js";
import { createHash } from "node:crypto";
import type {
  ChatResponse,
  ChatToolCall,
  ChatToolResult,
  HistoryMessage,
  PriorContext,
} from "./chat.types.js";
import { TOOL_DEFINITIONS, TOOL_HANDLERS, hasTool, isWalletTool } from "./chat.tools.js";
import {
  buildToolSelectionPrompt,
  buildResponseGenerationPrompt,
  CHAT_SYSTEM_INSTRUCTION,
} from "./chat.prompts.js";
import { getCachedResponse, setCachedResponse } from "./chat.cache.js";
import { chatInfo, chatWarn, chatError, chatDebug } from "./chat.logger.js";
import { DATA_TRANSFORMERS } from "./data-transformers.js";
import { sanitizeText, sanitizeResponse } from "./chat-sanitizer.js";
import { getMessage } from "./chat.localization.js";
import { classifyWalletChatIntent, inferWalletChatLanguage } from "./chat-intent.js";
import { buildWalletFallbackResponse } from "./chat-fallback.js";
import type { WalletConfidence, WalletWarning, WalletChatSection } from "./chat.types.js";
import { z } from "zod";
import { WALLET_CHAT_RESPONSE_LIMITS as L } from "./chat-fallback.js";

const MAX_ITERATIONS = 3;

let cachedClient: GoogleGenAI | null = null;

function trunc(v: unknown, max = 500): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (s.length <= max) return s;
  return s.slice(0, max) + `... (truncated, ${s.length} total)`;
}

function getClient(): GoogleGenAI {
  if (!GOOGLE_AI_KEY) {
    chatError("GOOGLE_AI_KEY not configured");
    throw new Error("GOOGLE_AI_KEY is not configured");
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey: GOOGLE_AI_KEY });
  }
  return cachedClient;
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

async function callGemini(prompt: string, systemInstruction?: string): Promise<string | null> {
  const client = getClient();
  chatDebug("Gemini call start", { promptLength: prompt.length, hasSystemInstruction: !!systemInstruction });
  const start = performance.now();
  try {
    const response = await client.models.generateContent({
      model: CHAT_MODEL,
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        ...(systemInstruction ? { systemInstruction } : {}),
      },
    });
    const duration = Math.round(performance.now() - start);
    const text = response.text ?? null;
    chatDebug("Gemini call success", { durationMs: duration, responseLength: text?.length ?? 0 });
    return text;
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    chatError("Gemini call failed", { durationMs: duration, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

function stripAddressKeys(input: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...input };
  delete copy.address;
  delete copy.addresses;
  return copy;
}

function makeCallKey(call: ChatToolCall): string {
  return `${call.name}:${JSON.stringify(stripAddressKeys(call.input as Record<string, unknown>))}`;
}

function allDuplicates(
  tools: ChatToolCall[],
  previousResults: PriorContext["previousResults"],
): boolean {
  if (!previousResults.length) return false;
  const seen = new Set(
    previousResults.map((r) => `${r.name}:${JSON.stringify(stripAddressKeys(r.input as Record<string, unknown>))}`),
  );
  return tools.length > 0 && tools.every((t) => seen.has(makeCallKey(t)));
}

async function selectTool(
  query: string,
  addresses: string[],
  language?: string,
  context?: PriorContext,
  history?: HistoryMessage[],
): Promise<ChatToolCall[] | { type: "no_tool" | "general"; message: string }> {
  const prompt = buildToolSelectionPrompt(query, TOOL_DEFINITIONS, addresses, context, history, language);
  const raw = await callGemini(prompt);

  if (!raw) {
    chatWarn("selectTool: Gemini returned null", { addresses });
    return { type: "general", message: getMessage(language, "noResponse") };
  }

  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object") {
    chatWarn("selectTool: failed to parse JSON from Gemini", { raw: trunc(raw, 300) });
    return { type: "general", message: getMessage(language, "noUnderstand") };
  }

  const p = parsed as Record<string, unknown>;

  if (p.type === "no_tool" || p.type === "general") {
    chatInfo("selectTool: no more tools needed", { type: p.type, message: trunc(p.message as string ?? "", 200) });
    return {
      type: p.type as "no_tool" | "general",
      message: sanitizeText((p.message as string) ?? ""),
    };
  }

  if (p.type === "tool_use") {
    const toolsRaw = p.tools;
    if (Array.isArray(toolsRaw) && toolsRaw.length > 0) {
      const tools: ChatToolCall[] = [];
      for (const t of toolsRaw) {
        if (t && typeof t === "object" && typeof (t as Record<string, unknown>).name === "string" && hasTool((t as Record<string, unknown>).name as string)) {
          tools.push({
            type: "tool_use",
            name: (t as Record<string, unknown>).name as string,
            input: ((t as Record<string, unknown>).input as Record<string, unknown>) ?? {},
          });
        }
      }
      if (tools.length > 0) {
        chatInfo("selectTool: tools selected", {
          count: tools.length,
          names: tools.map((t) => t.name),
          inputs: tools.map((t) => trunc(t.input, 200)),
        });
        return tools;
      }
      chatWarn("selectTool: tool_use declared but no valid tools parsed", { raw: trunc(p, 300) });
    }
  }

  chatWarn("selectTool: unrecognized response shape", { raw: trunc(p, 300) });
  return { type: "general", message: getMessage(language, "noTool") };
}

async function executeToolsForAllAddresses(
  addresses: string[],
  tools: ChatToolCall[],
): Promise<ChatToolResult[]> {
  const results = await Promise.all(
    tools.map(async (tool) => {
      const handler = TOOL_HANDLERS[tool.name];
      const start = performance.now();

      if (!handler) {
        chatWarn("executeToolsForAllAddresses: handler not found", { tool: tool.name });
        return { name: tool.name, input: tool.input, data: null, error: `Tool '${tool.name}' not found` };
      }

      try {
        if (isWalletTool(tool.name)) {
          const restInput = stripAddressKeys(tool.input as Record<string, unknown>);
          const perAddress = await Promise.all(
            addresses.map(async (addr) => {
              const { data: rawData, llmData } = await handler({ ...restInput, address: addr });
              return { address: addr, data: rawData, llmData };
            }),
          );

          const duration = Math.round(performance.now() - start);
          chatInfo("executeToolsForAllAddresses: fan-out success", {
            tool: tool.name,
            addresses: addresses.length,
            durationMs: duration,
          });

          const mergedData: Record<string, unknown> = {};
          const mergedFullData: Record<string, unknown> = {};
          for (const pa of perAddress) {
            mergedData[pa.address] = pa.llmData;
            mergedFullData[pa.address] = pa.data;
          }

          return {
            name: tool.name,
            input: { ...tool.input, addresses },
            data: mergedData,
            fullData: mergedFullData,
          };
        }

        const { data: fullData, llmData } = await handler(tool.input);
        const duration = Math.round(performance.now() - start);
        chatInfo("executeToolsForAllAddresses: global tool success", {
          tool: tool.name,
          durationMs: duration,
        });
        return { name: tool.name, input: tool.input, data: llmData, fullData };
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        const msg = err instanceof Error ? err.message : String(err);
        chatError("executeToolsForAllAddresses: failed", { tool: tool.name, durationMs: duration, error: msg });
        return { name: tool.name, input: tool.input, data: null, error: msg };
      }
    }),
  );
  return results;
}

// ─── Zod Validation for Structured Response ────────────────────────────

const walletSectionSchema = z.object({
  title: z.string().trim().min(1).max(L.sectionTitleChars),
  kind: z.enum(["market_snapshot", "key_findings", "pnl_summary", "trading_activity", "top_holdings", "risk_factors", "what_to_watch", "conclusion", "custom"]),
  content: z.string().trim().max(L.sectionContentChars).optional(),
  bullets: z.array(z.string().trim().min(1).max(L.sectionBulletChars)).max(L.sectionBulletItems).optional(),
  table: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).max(8).optional(),
});

const walletResponseSchema = z.object({
  text: z.string(),
  tldr: z.array(z.string().trim().min(1).max(L.tldrBulletChars)).min(1).max(L.tldrItems).optional(),
  sections: z.array(walletSectionSchema).min(1).max(L.sectionItems).optional(),
  warnings: z.array(z.object({ text: z.string(), severity: z.enum(["info", "warning", "error"]) })).max(L.warningItems).optional(),
  confidence: z.enum(["Low", "Medium", "High"]).optional(),
});

function normalizeWalletResponse(raw: unknown): Record<string, unknown> {
  const record = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const out: Record<string, unknown> = { text: record.text ?? "" };

  if (Array.isArray(record.tldr)) {
    out.tldr = (record.tldr as unknown[]).filter((s): s is string => typeof s === "string").slice(0, L.tldrItems);
  }
  if (Array.isArray(record.sections)) {
    const valid: Record<string, unknown>[] = [];
    for (const s of (record.sections as unknown[])) {
      if (valid.length >= L.sectionItems) break;
      if (s && typeof s === "object" && typeof (s as Record<string, unknown>).title === "string") {
        valid.push(s as Record<string, unknown>);
      }
    }
    if (valid.length > 0) out.sections = valid;
  }
  if (Array.isArray(record.warnings)) {
    out.warnings = (record.warnings as Array<Record<string, unknown>>).filter(
      (w): w is Record<string, unknown> =>
        w !== null && typeof (w as Record<string, unknown>).text === "string" && typeof w === "object",
    ).slice(0, L.warningItems);
  }
  if (typeof record.confidence === "string" && ["Low", "Medium", "High"].includes(record.confidence)) {
    out.confidence = record.confidence;
  }
  return out;
}

async function generateResponse(
  query: string,
  allResults: ChatToolResult[],
  language?: string,
  history?: HistoryMessage[],
): Promise<ChatResponse> {
  const allFailed = allResults.every((r) => r.error);
  if (allFailed) {
    const firstError = allResults.find((r) => r.error)!.error;
    chatWarn("generateResponse: all tools failed", { firstError, resultCount: allResults.length });
    return {
      text: getMessage(language, "allToolsFailed", { error: firstError ?? "unknown" }),
      data: {},
      charts: [],
      tables: [],
    };
  }

  const prompt = buildResponseGenerationPrompt(query, allResults, history, language);
  chatDebug("generateResponse: prompt built", { resultCount: allResults.length });

  const raw = await callGemini(prompt, CHAT_SYSTEM_INSTRUCTION);
  if (!raw) {
    chatWarn("generateResponse: Gemini returned null");
    return {
      text: getMessage(language, "dataError"),
      data: {},
      charts: [],
      tables: [],
    };
  }

  chatDebug("generateResponse: raw response", { raw: trunc(raw, 2000) });

  const sanitized = sanitizeResponse(raw);

  const text = sanitized.text;
  const charts = sanitized.charts;
  const tables = sanitized.tables;
  const actions = sanitized.actions;

  // Validate structured fields from Gemini
  const parsedJson = extractJsonObject(raw);
  let validatedTldr: string[] | undefined;
  let validatedSections: WalletChatSection[] | undefined;
  let validatedWarnings: WalletWarning[] | undefined;
  let validatedConfidence: WalletConfidence | undefined;

  if (parsedJson && typeof parsedJson === "object") {
    const normalized = normalizeWalletResponse(parsedJson);
    const parsed = walletResponseSchema.safeParse(normalized);
    if (parsed.success) {
      validatedTldr = parsed.data.tldr;
      validatedSections = parsed.data.sections as WalletChatSection[] | undefined;
      validatedWarnings = parsed.data.warnings as WalletWarning[] | undefined;
      validatedConfidence = parsed.data.confidence;
    }
  }

  if (!text && charts.length === 0 && tables.length === 0 && actions.length === 0) {
    chatWarn("generateResponse: sanitizeResponse returned empty, using raw text", { raw: trunc(raw, 300) });
    return {
      text: String(raw),
      data: {},
      charts: [],
      tables: [],
    };
  }

  const resolvedData: Record<string, unknown> = {};
  const allSpecs = [...charts, ...tables];
  for (const spec of allSpecs) {
    if (!spec.dataRef || resolvedData[spec.dataRef] !== undefined) continue;
    const idx = parseInt(spec.dataRef, 10);
    if (isNaN(idx) || idx < 0 || idx >= allResults.length) {
      chatWarn("generateResponse: invalid dataRef", { dataRef: spec.dataRef });
      continue;
    }
    const result = allResults[idx];
    if (!result || result.error || result.fullData == null) continue;
    const transformer = DATA_TRANSFORMERS[result.name];
    resolvedData[spec.dataRef] = transformer ? transformer(result.fullData) : result.fullData;
  }

  const response: ChatResponse = {
    text: text || getMessage(language, "hereData"),
    data: resolvedData,
    charts,
    tables,
    actions: actions.length > 0 ? actions : undefined,
    tldr: validatedTldr,
    sections: validatedSections,
    warnings: validatedWarnings,
    confidence: validatedConfidence,
    asOf: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
  };

  chatInfo("generateResponse: success", {
    textLength: response.text.length,
    chartsCount: response.charts.length,
    tablesCount: response.tables.length,
    dataKeys: Object.keys(response.data),
    hasSections: !!validatedSections,
    hasTldr: !!validatedTldr,
  });

  return response;
}

export async function answerChatQuery(
  addresses: string[],
  query: string,
  language?: string,
  history?: HistoryMessage[],
): Promise<ChatResponse> {
  const model = CHAT_MODEL;
  const historyHash = history?.length
    ? createHash("sha256").update(JSON.stringify(history)).update(language ?? "en").digest("hex").slice(0, 8)
    : undefined;

  chatInfo("answerChatQuery: entry", { addresses, query: trunc(query, 200), language: language ?? "en", historyTurns: history?.length ?? 0 });

  const intent = classifyWalletChatIntent(query);
  const detectedLang = inferWalletChatLanguage(query, language);
  chatInfo("answerChatQuery: intent + language", { intent, detectedLang, originalLang: language ?? "en" });

  const cached = await getCachedResponse(addresses, query, model, historyHash, intent);
  if (cached) {
    chatInfo("answerChatQuery: cache hit", {
      textLength: cached.text.length,
      chartsCount: cached.charts.length,
      tablesCount: cached.tables.length,
    });
    return cached;
  }
  chatDebug("answerChatQuery: cache miss");

  const allResults: ChatToolResult[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    chatInfo("answerChatQuery: iteration start", { iteration: i + 1, max: MAX_ITERATIONS, accumulatedResults: allResults.length });

    const context: PriorContext | undefined = allResults.length
      ? { previousResults: allResults.map((r) => ({ name: r.name, input: r.input ?? {}, data: r.data, error: r.error })) }
      : undefined;

    const toolSelection = await selectTool(query, addresses, language, context, history);

    if (!Array.isArray(toolSelection)) {
      if (i === 0) {
        chatInfo("answerChatQuery: no tools needed, responding directly", { type: toolSelection.type, message: trunc(toolSelection.message, 200) });
        const response: ChatResponse = {
          text: toolSelection.message || getMessage(language, "noData"),
          data: {},
          charts: [],
          tables: [],
        };
        return response;
      }
      chatInfo("answerChatQuery: LLM signaled enough data", { iteration: i + 1 });
      break;
    }

    if (toolSelection.length === 0) {
      chatWarn("answerChatQuery: empty tool list, breaking", { iteration: i + 1 });
      break;
    }

    if (allDuplicates(toolSelection, context?.previousResults ?? [])) {
      chatWarn("answerChatQuery: duplicate tool calls detected, breaking loop", {
        iteration: i + 1,
        tools: toolSelection.map((t) => t.name),
      });
      allResults.push({
        name: "_loop_guard",
        input: {},
        data: null,
        error: "Loop detected: same tools requested again",
      });
      break;
    }

    const results = await executeToolsForAllAddresses(addresses, toolSelection);
    allResults.push(...results);

    if (results.length > 0 && results.every((r) => r.error)) {
      chatWarn("answerChatQuery: all tools in batch failed, breaking", {
        iteration: i + 1,
        errors: results.map((r) => r.error),
      });
      break;
    }

    chatInfo("answerChatQuery: iteration complete", {
      iteration: i + 1,
      newResults: results.length,
      totalResults: allResults.length,
    });
  }

  if (allResults.length >= MAX_ITERATIONS * 2) {
    chatWarn("answerChatQuery: max iterations reached", {
      iterations: MAX_ITERATIONS,
      totalResults: allResults.length,
    });
  }

  const response = await generateResponse(query, allResults, language, history);

  if (!response.text && response.charts.length === 0 && response.tables.length === 0) {
    chatWarn("answerChatQuery: Gemini response empty, using deterministic fallback");
    return buildWalletFallbackResponse(query, intent, allResults, detectedLang);
  }

  try {
    await setCachedResponse(addresses, query, response, model, historyHash, intent);
    chatDebug("answerChatQuery: cache write succeeded");
  } catch {
    chatWarn("answerChatQuery: cache write failed");
  }

  chatInfo("answerChatQuery: return", {
    textLength: response.text.length,
    chartsCount: response.charts.length,
    tablesCount: response.tables.length,
    totalResults: allResults.length,
  });

  return response;
}
