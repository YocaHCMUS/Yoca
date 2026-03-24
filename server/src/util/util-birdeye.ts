import type { ApiKeyMetadata } from "@sv/services/tracking/apiCallTracker.types.js";
import { apiKeyManager, buildApiKeyMetadata } from "./api-key-manager.js";
const BIRDEYE_SERVICE_NAME = "birdeye";
let birdeyeKeysInitialized = false;

export function getEndpoint(path: string): URL {
  if (!process.env.BDS_API_BASE_URL) {
    throw new Error("Birdey API base url was not set");
  }
  return new URL(`${process.env.BDS_API_BASE_URL}${path}`);
}


export function getRequiredHeaders(): Record<string, string> {
  if (!birdeyeKeysInitialized) {
    apiKeyManager.initializeKeys(BIRDEYE_SERVICE_NAME, process.env.BIRDEYE_API_KEY);
    birdeyeKeysInitialized = true;
  }

  const apiKey = apiKeyManager.getNextKey(BIRDEYE_SERVICE_NAME);
  if (!apiKey) {
    throw new Error("BIRDEYE_API_KEY is not set");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-KEY": apiKey,
    "x-chain": "solana",
  };

  return headers;
}

export function getRequiredHeadersWithMetadata(): {
  headers: Record<string, string>;
  apiKey: ApiKeyMetadata | null;
} {
  if (!birdeyeKeysInitialized) {
    apiKeyManager.initializeKeys(BIRDEYE_SERVICE_NAME, process.env.BIRDEYE_API_KEY);
    birdeyeKeysInitialized = true;
  }

  const apiKey = apiKeyManager.getNextKey(BIRDEYE_SERVICE_NAME);
  if (!apiKey) {
    throw new Error("BIRDEYE_API_KEY is not set");
  }

  return {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-KEY": apiKey,
      "x-chain": "solana",
    },
    apiKey: buildApiKeyMetadata(apiKey, "BIRDEYE_API_KEY"),
  };
}

export function normalizeBirdeyeTimeParam(time?: string): string | undefined {
  if (!time) {
    return undefined;
  }

  const trimmed = time.trim();
  if (!trimmed) {
    return undefined;
  }

  // Birdeye expects: YYYY-MM-DD HH:mm:ss
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsedMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedMs)) {
    return undefined;
  }

  const date = new Date(parsedMs);
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * Normalize a timestamp to UTC day start (00:00:00) and format as YYYY-MM-DD HH:mm:ss
 * @param timestamp - milliseconds since epoch
 * @returns formatted string in Birdeye format with UTC day start
 */
export function formatToBirdeyeDayStart(timestamp: number): string {
  const date = new Date(timestamp);
  // Set to UTC day start
  date.setUTCHours(0, 0, 0, 0);

  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} 00:00:00`;
}

/**
 * Convert a timestamp to UTC day start milliseconds
 * @param timestamp - milliseconds since epoch
 * @returns milliseconds of UTC day start
 */
export function toUtcDayStartMs(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}