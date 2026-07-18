import env from "@sv/util/load-env.js";
import { db } from "@sv/db/index.js";
import { topTokenHolders } from "@sv/db/schema.js";
import { helius_EnhancedTransactionsSchema } from "@sv/services/_types/token-raw-responses.js";
import "@sv/util/date.js";
import { pFetch } from "@sv/util/rate-limit.js";
import * as helius from "@sv/util/util-helius.js";
import dayjs from "dayjs";
import { asc, inArray } from "drizzle-orm";
import { Buffer } from "node:buffer";
import { mkdir, open, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ActivityBucket = "high" | "medium" | "low" | "inactive";
type ResultClassification =
  | "data"
  | "empty_valid"
  | "unsupported"
  | "validation_error"
  | "upstream_error"
  | "internal_error";

type WalletCandidate = {
  address: string;
  source: string;
  relatedToken?: string;
  holderRank?: number;
  transactionSampleCount?: number;
  latestTransactionAt?: string | null;
  activity?: ActivityBucket;
};

const excludedWallets = new Set([
  // Known active arbitrage bot, but Mobula does not provide stable coverage.
  "3nMNd89AxwHUa1AFvQGqohRkxFEQsTsgiEyEyqXFHyyH",
]);

async function main(): Promise<void> {
  const lockPath = path.resolve("/tmp/yoca-wallet-discovery.lock");
  let lock: Awaited<ReturnType<typeof open>>;
  try {
    lock = await open(lockPath, "wx");
  } catch {
    throw new Error(
      `Another wallet discovery process is running, or stale lock exists at ${lockPath}`,
    );
  }

  try {
    const baseUrl = env.YOCA_BENCHMARK_BASE_URL;
    const candidates = new Map<string, WalletCandidate>();
    const seeds: WalletCandidate[] = [
      {
        address: "Bi4rd5FH5bYEN8scZ7wevxNZyNmKHdaBcvewdPFxYdLt",
        source: "required_seed",
      },
      {
        address: "4BdKaxN8G6ka4GYtQQWk4G4dZRUTX2vQH9GcXdBREFUk",
        source: "project_seed",
      },
    ];
    for (const seed of seeds) {
      candidates.set(seed.address, seed);
    }

    const holderRows = await db
      .select({
        address: topTokenHolders.holderAddress,
        tokenAddress: topTokenHolders.tokenAddress,
        rank: topTokenHolders.rank,
      })
      .from(topTokenHolders)
      .where(inArray(topTokenHolders.rank, [0, 1, 5, 10, 25, 100, 500, 999]))
      .orderBy(asc(topTokenHolders.rank), asc(topTokenHolders.tokenAddress))
      .limit(160);

    for (const row of holderRows) {
      if (!excludedWallets.has(row.address) && !candidates.has(row.address)) {
        candidates.set(row.address, {
          address: row.address,
          source: "token_holder",
          relatedToken: row.tokenAddress,
          holderRank: row.rank,
        });
      }
    }

    const preflighted: WalletCandidate[] = [];
    for (const candidate of Array.from(candidates.values()).slice(0, 80)) {
      const endpoint = helius.getEndpoint(
        `/v0/addresses/${candidate.address}/transactions`,
      );
      endpoint.searchParams.set("limit", "100");
      const response = await pFetch(
        helius.spec,
        "helius.svc.wallet_candidate_preflight",
        endpoint,
        {
          headers: helius.getRequiredHeaders(),
        },
      );
      if (!response.ok) {
        continue;
      }

      const payload: unknown = await response.json();
      const parsed = helius_EnhancedTransactionsSchema.safeParse(payload);
      if (!parsed.success) {
        continue;
      }

      const transactionSampleCount = parsed.data.length;
      let activity: ActivityBucket = "inactive";
      if (transactionSampleCount >= 80) {
        activity = "high";
      } else if (transactionSampleCount >= 20) {
        activity = "medium";
      } else if (transactionSampleCount > 0) {
        activity = "low";
      }
      const latestTimestamp = parsed.data[0]?.timestamp;
      preflighted.push({
        ...candidate,
        transactionSampleCount,
        latestTransactionAt:
          latestTimestamp == undefined
            ? null
            : dayjs.unix(latestTimestamp).utc().toISOString(),
        activity,
      });
      console.log(
        `[wallet-discovery] preflight ${preflighted.length}/80 ${candidate.address} ${activity}`,
      );
    }

    const selected: WalletCandidate[] = [];
    const quotas: Record<ActivityBucket, number> = {
      high: 10,
      medium: 7,
      low: 5,
      inactive: 2,
    };
    const activityOrder: ActivityBucket[] = [
      "high",
      "medium",
      "low",
      "inactive",
    ];
    for (const activity of activityOrder) {
      selected.push(
        ...preflighted
          .filter((candidate) => candidate.activity == activity)
          .slice(0, quotas[activity]),
      );
    }
    for (const candidate of preflighted) {
      if (
        selected.length < 24 &&
        !selected.some((selectedWallet) => selectedWallet.address == candidate.address)
      ) {
        selected.push(candidate);
      }
    }

    if (selected.length < 24) {
      throw new Error(
        `Only ${selected.length} compatible wallet candidates were found`,
      );
    }

    const results = [];
    const selectedWallets = selected.slice(0, 24);
    for (let batchStart = 0; batchStart < selectedWallets.length; batchStart += 2) {
      const batchResults = await Promise.all(
        selectedWallets.slice(batchStart, batchStart + 2).map(async (wallet, offset) => {
          const index = batchStart + offset;
          const address = encodeURIComponent(wallet.address);
          const endpoints = {
            overview: `/api/wallets/overview?address=${address}&period=24H`,
            portfolio: `/api/wallets/portfolio?address=${address}`,
            transfers: `/api/wallets/transfers/history/${address}?limit=20`,
            swaps: `/api/wallets/swaps/history/${address}?limit=20`,
            identity: `/api/wallets/identity?address=${address}`,
          };
          const coverage: Record<string, {
            status: number | null;
            durationMs: number;
            classification: ResultClassification;
            payloadBytes: number;
          }> = {};

          await Promise.all(
            Object.entries(endpoints).map(async ([module, route]) => {
              const startedAt = Date.now();
              try {
                const response = await fetch(`${baseUrl}${route}`, {
                  signal: AbortSignal.timeout(45_000),
                });
                const text = await response.text();
                let classification: ResultClassification | null = null;
                if (response.status == 404) {
                  classification = "unsupported";
                } else if (response.status == 422) {
                  classification = "validation_error";
                } else if (response.status >= 500 && response.status <= 599) {
                  classification =
                    response.status == 502 ? "upstream_error" : "internal_error";
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
                    const empty =
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
            }),
          );

          console.log(
            `[wallet-discovery] compatibility ${index + 1}/24 ${wallet.address}`,
          );
          return {
            resourceId: `wallet_${String(index + 1).padStart(3, "0")}`,
            ...wallet,
            coverage,
          };
        }),
      );
      results.push(...batchResults);
    }

    const generatedAt = dayjs.utc().toISOString();
    const currentFile = fileURLToPath(import.meta.url);
    const outputDir = path.resolve(
      path.dirname(currentFile),
      "../../../../docs/plans/business/benchmark-results/datasets",
    );
    await mkdir(outputDir, { recursive: true });
    const outputPath = path.join(
      outputDir,
      `wallets-${generatedAt.slice(0, 10)}.json`,
    );
    await writeFile(
      outputPath,
      `${JSON.stringify({
        generatedAt,
        baseUrl,
        candidateCount: candidates.size,
        preflightCount: preflighted.length,
        selectedCount: results.length,
        excludedWallets: Array.from(excludedWallets),
        wallets: results,
      }, null, 2)}\n`,
      "utf8",
    );
    console.log(`[wallet-discovery] wrote ${outputPath}`);
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error("[wallet-discovery] failed", error);
  throw error;
});
