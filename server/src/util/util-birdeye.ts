export function getEndpoint(path: string): URL {
  return new URL(`${process.env.BDS_API_BASE_URL!}${path}`);
}

export function getRequiredHeaders(): HeadersInit {
  return {
    accept: "application/json",
    "x-chain": "solana",
    "X-API-Key": process.env.BDS_API_KEY!,
  };
}
