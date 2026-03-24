import { buildApiKeyMetadata } from "./api-key-manager.js";

export function getStreamingEndpoint(): URL {
  return new URL(process.env.BITQUERY_STREAM_API_ENDPOINT!);
}

// Please use this carefully since it is more expensive than query from streaming API
export function getEndpoint(endpoint: string): URL {
  return new URL(`${process.env.BITQUERY_API_ENDPOINT!}${endpoint}`);
}

export function getRequiredHeaders() {
  return {
    Authorization: `Bearer ${process.env.BITQUERY_API_KEY!}`,
    "Content-Type": "application/json",
  };
}

export function getBitqueryApiKeyMetadata() {
  return buildApiKeyMetadata(process.env.BITQUERY_API_KEY ?? null, "BITQUERY_API_KEY");
}
