import { apiKeyManager } from "./api-key-manager.js";
const BIRDEYE_SERVICE_NAME = "birdeye";
let birdeyeKeysInitialized = false;

export function getEndpoint(path: string): URL {
  if (!process.env.BDS_API_BASE_URL) {
    throw new Error("Birdey API base url was not set");
  }
  return new URL(`${process.env.BDS_API_BASE_URL}${path}`);
}


export function getRequiredHeaders(): HeadersInit {
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