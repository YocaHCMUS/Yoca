import env from "@sv/util/load-env.js";
import { defineProvider, pFetch } from "@sv/util/rate-limit.js";
import Bottleneck from "bottleneck";
import { Buffer } from "node:buffer";
import { mkdir, open, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import z from "zod";

const tokenCandidateSchema = z.object({
  id: z.string().min(32).max(44),
  name: z.string().nullable().optional(),
  symbol: z.string().nullable().optional(),
  holderCount: z.number().nullable().optional(),
  liquidity: z.number().nullable().optional(),
  mcap: z.number().nullable().optional(),
  organicScore: z.number().nullable().optional(),
  isVerified: z.boolean().nullable().optional(),
  firstPool: z.object({ createdAt: z.string().optional() }).nullable().optional(),
});

const jupiterResponseSchema = tokenCandidateSchema.array();
const fundamentalsResultSchema = z.object({
  distribution: z.array(z.unknown()),
  release_schedule: z.array(z.unknown()),
  investors: z.array(z.unknown()),
});
type JupiterTokenCandidate = z.infer<typeof tokenCandidateSchema>;

type DiscoveredToken = {
  id: string;
  symbol: string | null;
  source: string;
  jupiter?: JupiterTokenCandidate;
};

type ResultClassification =
  | "data"
  | "empty_valid"
  | "unsupported"
  | "validation_error"
  | "upstream_error"
  | "internal_error";

const seeds = [
  { id: "So11111111111111111111111111111111111111112", symbol: "SOL", source: "required_seed" },
  { id: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", symbol: "PYTH", source: "required_seed" },
  { id: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", symbol: "PENGU", source: "required_seed" },
  { id: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", source: "verified_seed" },
  { id: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", source: "verified_seed" },
  { id: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", source: "verified_seed" },
  { id: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", symbol: "JTO", source: "verified_seed" },
  { id: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", source: "verified_seed" },
  { id: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", source: "verified_seed" },
  { id: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", symbol: "HNT", source: "verified_seed" },
  { id: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", symbol: "RAY", source: "verified_seed" },
  { id: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", symbol: "ORCA", source: "verified_seed" },
  { id: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", symbol: "mSOL", source: "verified_seed" },
  { id: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", symbol: "JitoSOL", source: "verified_seed" },
  { id: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", symbol: "bSOL", source: "verified_seed" },
  { id: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", symbol: "SAMO", source: "verified_seed" },
  { id: "EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp", symbol: "FIDA", source: "legacy_seed" },
  { id: "SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y", symbol: "SHDW", source: "legacy_seed" },
  { id: "StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT", symbol: "STEP", source: "legacy_seed" },
  { id: "kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6", symbol: "KIN", source: "legacy_seed" },
  { id: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9", symbol: "MEDIA", source: "legacy_seed" },
  { id: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E", symbol: "soBTC", source: "legacy_seed" },
  { id: "2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk", symbol: "soETH", source: "legacy_seed" },
  { id: "ChVzxWRmrTeSgwd3Ui3UumcN8KX7VK3WaD4K92SKay98", symbol: "UXD", source: "legacy_seed" },
];

async function main(): Promise<void> {
  const lockPath = path.resolve("/tmp/yoca-token-discovery.lock");
  let lock: Awaited<ReturnType<typeof open>>;
  try {
    lock = await open(lockPath, "wx");
  } catch {
    throw new Error(
      `Another token discovery process is running, or stale lock exists at ${lockPath}`,
    );
  }

  try {
  const baseUrl = env.YOCA_BENCHMARK_BASE_URL;
  const jupiterApiKey = env.JUPITER_API_KEY;
  const jupiter = defineProvider({
    id: "jupiter",
    limiter: new Bottleneck({ maxConcurrent: 1, minTime: 250 }),
  });
  const discovered = new Map<string, DiscoveredToken>();
  for (const seed of seeds) {
    discovered.set(seed.id, seed);
  }

if (jupiterApiKey) {
  for (const resource of [
    "toporganicscore/24h?limit=100",
    "toptrending/24h?limit=100",
    "recent",
  ]) {
    const endpoint = new URL(`https://api.jup.ag/tokens/v2/${resource}`);
    const response = await pFetch(jupiter, "jupiter.svc.token_discovery", endpoint, {
      headers: { "x-api-key": jupiterApiKey },
    });
    if (!response.ok) {
      console.warn(`[token-discovery] Jupiter ${resource} returned ${response.status}`);
      continue;
    }

    const payload: unknown = await response.json();
    const parsed = jupiterResponseSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn(`[token-discovery] Jupiter ${resource} response changed`);
      continue;
    }

    for (const token of parsed.data) {
      if (!discovered.has(token.id)) {
        const candidate: DiscoveredToken = {
          id: token.id,
          symbol: token.symbol ?? null,
          source: `jupiter_${resource.split("/")[0]}`,
          jupiter: token,
        };
        discovered.set(token.id, candidate);
      }
    }
  }
}

const health = await fetch(`${baseUrl}/api`);
if (!health.ok) {
  throw new Error(`Yoca server is unavailable at ${baseUrl}; start it before discovery`);
}

const excludedLegacyTokens = new Set([
  "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
  "ChVzxWRmrTeSgwd3Ui3UumcN8KX7VK3WaD4K92SKay98",
]);
const selected = Array.from(discovered.values())
  .filter((token) => !excludedLegacyTokens.has(token.id))
  .filter((token) => !token.jupiter || token.jupiter.isVerified == true)
  .slice(0, 24);
const results = [];

for (const [index, token] of selected.entries()) {
  const endpoints = {
    metadata: `/api/tokens/meta/${token.id}`,
    market: `/api/tokens/markets/${token.id}`,
    pools: `/api/tokens/${token.id}/pools`,
    holders: `/api/tokens/holders/${token.id}`,
    fundamentals: `/api/tokens/fundamentals/${token.id}`,
  };
  const coverage: Record<string, {
    status: number | null;
    durationMs: number;
    classification: ResultClassification;
    payloadBytes: number;
  }> = {};

  for (const [module, route] of Object.entries(endpoints)) {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${baseUrl}${route}`);
      const text = await response.text();
      let classification: ResultClassification | null = null;

      if (response.status == 404) {
        classification = "unsupported";
      } else if (response.status == 422) {
        classification = "validation_error";
      } else if (response.status >= 500 && response.status <= 599) {
        classification = response.status == 502 ? "upstream_error" : "internal_error";
      } else if (!response.ok) {
        classification = "upstream_error";
      } else {
        let payload: unknown = null;
        try {
          payload = text.length > 0 ? JSON.parse(text) : null;
        } catch {
          classification = "validation_error";
        }

        if (!classification) {
          const fundamentals = fundamentalsResultSchema.safeParse(payload);
          const fundamentalsEmpty =
            module == "fundamentals" &&
            fundamentals.success &&
            fundamentals.data.distribution.length == 0 &&
            fundamentals.data.release_schedule.length == 0 &&
            fundamentals.data.investors.length == 0;
          const empty =
            fundamentalsEmpty ||
            payload == null ||
            (Array.isArray(payload) && payload.length == 0) ||
            (typeof payload == "object" &&
              !Array.isArray(payload) &&
              Object.keys(payload).length == 0);
          classification = empty ? "empty_valid" : "data";
        }
      }

      coverage[module] = {
        status: response.status,
        durationMs: Date.now() - startedAt,
        classification,
        payloadBytes: Buffer.byteLength(text),
      };
    } catch {
      coverage[module] = {
        status: null,
        durationMs: Date.now() - startedAt,
        classification: "internal_error",
        payloadBytes: 0,
      };
    }
  }

  results.push({
    resourceId: `token_${String(index + 1).padStart(3, "0")}`,
    address: token.id,
    symbol: token.symbol,
    source: token.source,
    coverage,
  });
  console.log(`[token-discovery] ${index + 1}/${selected.length} ${token.symbol ?? token.id}`);
}

const generatedAt = new Date().toISOString();
const fileName = `tokens-${generatedAt.slice(0, 10)}.json`;
const currentFile = fileURLToPath(import.meta.url);
const outputDir = path.resolve(
  path.dirname(currentFile),
  "../../../../docs/plans/business/benchmark-results/datasets",
);
await mkdir(outputDir, { recursive: true });
await writeFile(
  path.join(outputDir, fileName),
  `${JSON.stringify({
    generatedAt,
    baseUrl,
    candidateCount: discovered.size,
    selectedCount: selected.length,
    jupiterDiscoveryEnabled: Boolean(jupiterApiKey),
    tokens: results,
  }, null, 2)}\n`,
  "utf8",
);

  console.log(`[token-discovery] wrote ${path.join(outputDir, fileName)}`);
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error("[token-discovery] failed", error);
  throw error;
});
