import { GoogleGenAI } from "@google/genai";
import {
  GOOGLE_AI_KEY,
  CHAT_MODEL,
} from "@sv/config/constants.js";
import type {
  ChatResponse,
  ChatToolCall,
  ChatToolResult,
} from "./chat.types.js";
import { TOOL_DEFINITIONS, TOOL_HANDLERS, hasTool } from "./chat.tools.js";
import {
  buildToolSelectionPrompt,
  buildResponseGenerationPrompt,
  CHAT_SYSTEM_INSTRUCTION,
} from "./chat.prompts.js";
import { getCachedResponse, setCachedResponse } from "./chat.cache.js";

let cachedClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!GOOGLE_AI_KEY) {
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
    return response.text ?? null;
  } catch (err) {
    console.error("[chat] Gemini call failed:", err);
    return null;
  }
}

/**
 * Step 1: Send query + tool definitions to Gemini, parse tool selection.
 * Returns an array of tool calls when tools are needed.
 */
async function selectTool(
  query: string,
  address: string,
): Promise<ChatToolCall[] | { type: "no_tool" | "general"; message: string }> {
  const prompt = buildToolSelectionPrompt(query, TOOL_DEFINITIONS, address);
  const raw = await callGemini(prompt);

  if (!raw) {
    return { type: "general", message: "I'm sorry, I couldn't process your request at this time." };
  }

  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object") {
    return { type: "general", message: "I'm sorry, I couldn't understand your question." };
  }

  const p = parsed as Record<string, unknown>;

  if (p.type === "no_tool" || p.type === "general") {
    return {
      type: p.type as "no_tool" | "general",
      message: (p.message as string) ?? "",
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
        return tools;
      }
    }
  }

  return { type: "general", message: "I'm sorry, I couldn't determine how to answer that." };
}

/**
 * Step 2: Execute all selected tools in parallel.
 */
async function executeTools(tools: ChatToolCall[]): Promise<ChatToolResult[]> {
  const results = await Promise.all(
    tools.map(async (tool) => {
      const handler = TOOL_HANDLERS[tool.name];
      if (!handler) {
        return { name: tool.name, data: null, error: `Tool '${tool.name}' not found` };
      }
      try {
        const { llmData } = await handler(tool.input);
        return { name: tool.name, data: llmData };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[chat] Tool '${tool.name}' failed:`, msg);
        return { name: tool.name, data: null, error: msg };
      }
    }),
  );
  return results;
}

/**
 * Step 3: Send tool results + original query to Gemini for response generation.
 * When multiple tools were used, all results are combined into a single prompt.
 */
async function generateResponse(
  query: string,
  tools: ChatToolCall[],
  results: ChatToolResult[],
): Promise<ChatResponse> {
  const allFailed = results.every((r) => r.error);
  if (allFailed) {
    const firstError = results.find((r) => r.error)!.error;
    return {
      text: `I tried to look up the data but ran into an issue: ${firstError}. Please try again or ask a different question.`,
      data: {},
      charts: [],
      tables: [],
    };
  }

  const prompt = buildResponseGenerationPrompt(
    query,
    tools.map((t) => t.name).join(", "),
    Object.fromEntries(tools.map((t) => [t.name, t.input])),
    Object.fromEntries(results.map((r) => [r.name, r.data])),
  );

  const raw = await callGemini(prompt, CHAT_SYSTEM_INSTRUCTION);
  if (!raw) {
    return {
      text: "I found the data but couldn't generate a proper response. Please try again.",
      data: {},
      charts: [],
      tables: [],
    };
  }

  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object") {
    return {
      text: String(raw),
      data: {},
      charts: [],
      tables: [],
    };
  }

  const p = parsed as Record<string, unknown>;

  return {
    text: (p.text as string) ?? "Here's the data you requested.",
    data: (p.data as Record<string, unknown>) ?? {},
    charts: Array.isArray(p.charts) ? (p.charts as ChatResponse["charts"]) : [],
    tables: Array.isArray(p.tables) ? (p.tables as ChatResponse["tables"]) : [],
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function answerChatQuery(
  address: string,
  query: string,
): Promise<ChatResponse> {
  const model = CHAT_MODEL;

  // 1. Check cache
  const cached = await getCachedResponse(address, query, model);
  if (cached) {
    return cached;
  }

  // 2. Select tool(s)
  const toolSelection = await selectTool(query, address);
  if (!Array.isArray(toolSelection)) {
    const response: ChatResponse = {
      text: toolSelection.message || "I can only help with questions about this wallet's on-chain data.",
      data: {},
      charts: [],
      tables: [],
    };
    return response;
  }

  // 3. Execute all selected tools in parallel
  const results = await executeTools(toolSelection);

  // 4. Generate final response from all tool results
  const response = await generateResponse(query, toolSelection, results);

  // 5. Cache response (even on error to avoid repeated failures)
  try {
    await setCachedResponse(address, query, response, model);
  } catch {
    // non-critical
  }

  return response;
}
