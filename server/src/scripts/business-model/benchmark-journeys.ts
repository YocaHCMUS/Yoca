import env from "@sv/util/load-env.js";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

type JourneyName = "market_radar" | "token_overview" | "wallet_core";
type PassName = "cold" | "observed_first" | "warm_repeat";

type MetricSample = {
  metric: string;
  labels: Record<string, string>;
  value: number;
};

type EndpointResult = {
  requestId: string | null;
  route: string;
  status: number | null;
  durationMs: number;
  payloadBytes: number;
  classification:
    | "data"
    | "empty_valid"
    | "unsupported"
    | "validation_error"
    | "upstream_error"
    | "internal_error"
    | "timeout"
    | "network_error";
};

type RequestResult = EndpointResult & {
  payload: unknown;
};

type MetricDelta = {
  metric: string;
  labels: Record<string, string>;
  value: number;
};

type JourneyResult = {
  journey: JourneyName;
  pass: PassName;
  resourceId: string;
  startedAt: string;
  durationMs: number;
  endpoints: EndpointResult[];
  providerAttempts: MetricDelta[];
  providerRetries: MetricDelta[];
  dataUsage: MetricDelta[];
};

const tokenDatasetSchema = z.object({
  stableTokens: z.array(
    z.object({
      resourceId: z.string(),
      address: z.string(),
      symbol: z.string().nullable(),
    }),
  ),
});

const walletDatasetSchema = z.object({
  stableWallets: z.array(
    z.object({
      address: z.string(),
    }),
  ),
});

const poolListSchema = z.array(
  z.object({
    data: z.object({
      poolAddress: z.string(),
    }).passthrough(),
  }).passthrough(),
);

function argumentValue(name: string): string | null {
  const prefix = `--${name}=`;
  const argument = process.argv.find((item) => item.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

function parseMetricLabels(raw: string | undefined): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!raw) {
    return labels;
  }

  const labelPattern = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"])*)"/g;
  for (const match of raw.matchAll(labelPattern)) {
    const name = match[1];
    const value = match[2];
    if (name && value != null) {
      labels[name] = value
        .replaceAll("\\n", "\n")
        .replaceAll("\\\"", "\"")
        .replaceAll("\\\\", "\\");
    }
  }
  return labels;
}

function parseMetrics(text: string): MetricSample[] {
  const samples: MetricSample[] = [];
  const linePattern = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+(-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)$/i;
  for (const line of text.split("\n")) {
    if (line.length == 0 || line.startsWith("#")) {
      continue;
    }
    const match = line.match(linePattern);
    if (!match) {
      continue;
    }
    const metric = match[1];
    const value = Number(match[3]);
    if (!metric || !Number.isFinite(value)) {
      continue;
    }
    samples.push({
      metric,
      labels: parseMetricLabels(match[2]),
      value,
    });
  }
  return samples;
}

function metricKey(sample: MetricSample): string {
  const labels = Object.entries(sample.labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join(",");
  return `${sample.metric}{${labels}}`;
}

function metricDelta(
  before: MetricSample[],
  after: MetricSample[],
  metric: string,
): MetricDelta[] {
  const beforeValues = new Map(
    before
      .filter((sample) => sample.metric == metric)
      .map((sample) => [metricKey(sample), sample.value]),
  );

  return after
    .filter((sample) => sample.metric == metric)
    .map((sample) => ({
      metric: sample.metric,
      labels: sample.labels,
      value: sample.value - (beforeValues.get(metricKey(sample)) ?? 0),
    }))
    .filter((sample) => sample.value > 0);
}

function classifyResponse(status: number, payload: unknown): EndpointResult["classification"] {
  if (status == 404) return "unsupported";
  if (status == 422) return "validation_error";
  if (status == 502 || status == 503 || status == 504) return "upstream_error";
  if (status >= 500) return "internal_error";
  if (status >= 400) return "upstream_error";
  if (Array.isArray(payload)) {
    return payload.length > 0 ? "data" : "empty_valid";
  }
  if (payload && typeof payload == "object") {
    return Object.keys(payload).length > 0 ? "data" : "empty_valid";
  }
  return payload == null || payload == "" ? "empty_valid" : "data";
}

async function fetchMetrics(baseUrl: string): Promise<MetricSample[]> {
  const headers: Record<string, string> = {};
  if (env.API_METRICS_BEARER_TOKEN.length > 0) {
    headers.Authorization = `Bearer ${env.API_METRICS_BEARER_TOKEN}`;
  }
  const response = await fetch(`${baseUrl}/metrics`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Metrics endpoint returned ${response.status}`);
  }
  return parseMetrics(await response.text());
}

async function requestEndpoint(
  baseUrl: string,
  runId: string,
  requestIndex: number,
  route: string,
  url: string,
): Promise<RequestResult> {
  const startedAtMs = Date.now();
  try {
    const response = await fetch(`${baseUrl}${url}`, {
      headers: {
        "x-request-id": `${runId}-${requestIndex}`,
      },
      signal: AbortSignal.timeout(120_000),
    });
    const text = await response.text();
    let payload: unknown = null;
    let parseFailed = false;
    if (text.length > 0) {
      try {
        payload = JSON.parse(text);
      } catch {
        parseFailed = true;
      }
    }
    return {
      requestId: response.headers.get("x-request-id"),
      route,
      status: response.status,
      durationMs: Date.now() - startedAtMs,
      payloadBytes: Buffer.byteLength(text),
      classification: parseFailed
        ? "validation_error"
        : classifyResponse(response.status, payload),
      payload,
    };
  } catch (error) {
    return {
      requestId: null,
      route,
      status: null,
      durationMs: Date.now() - startedAtMs,
      payloadBytes: 0,
      classification:
        error instanceof Error && error.name == "TimeoutError"
          ? "timeout"
          : "network_error",
      payload: null,
    };
  }
}

function publicEndpointResult(result: RequestResult): EndpointResult {
  return {
    requestId: result.requestId,
    route: result.route,
    status: result.status,
    durationMs: result.durationMs,
    payloadBytes: result.payloadBytes,
    classification: result.classification,
  };
}

async function runTokenOverview(
  baseUrl: string,
  runId: string,
  pass: PassName,
  resourceId: string,
  address: string,
): Promise<JourneyResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const before = await fetchMetrics(baseUrl);
  let requestIndex = 0;
  const baseRequests = [
    ["/api/tokens/details/:addresses", `/api/tokens/details/${address}`],
    ["/api/tokens/:address/pools", `/api/tokens/${address}/pools`],
    ["/api/tokens/holders/:address", `/api/tokens/holders/${address}`],
    ["/api/tokens/holders/stats/:addresses", `/api/tokens/holders/stats/${address}`],
    ["/api/tokens/markets/:addresses", `/api/tokens/markets/${address}`],
    ["/api/tokens/markets/chart/:address", `/api/tokens/markets/chart/${address}`],
  ];
  const baseResults = await Promise.all(
    baseRequests.map(([route, url]) => {
      requestIndex += 1;
      return requestEndpoint(baseUrl, runId, requestIndex, route, url);
    }),
  );

  const endpointResults = [...baseResults];
  const poolResponse = baseResults[1];
  const parsedPools = poolListSchema.safeParse(poolResponse?.payload);
  const poolAddress = parsedPools.success
    ? parsedPools.data[0]?.data.poolAddress
    : null;
  if (poolAddress) {
    const poolRequests = [
      ["/api/tokens/pools/trades/:address", `/api/tokens/pools/trades/${poolAddress}`],
      ["/api/tokens/pools/:addresses", `/api/tokens/pools/${poolAddress}`],
    ];
    endpointResults.push(
      ...(await Promise.all(
        poolRequests.map(([route, url]) => {
          requestIndex += 1;
          return requestEndpoint(baseUrl, runId, requestIndex, route, url);
        }),
      )),
    );
  }

  const after = await fetchMetrics(baseUrl);
  return {
    journey: "token_overview",
    pass,
    resourceId,
    startedAt,
    durationMs: Date.now() - startedAtMs,
    endpoints: endpointResults.map(publicEndpointResult),
    providerAttempts: metricDelta(before, after, "yoca_provider_requests_total"),
    providerRetries: metricDelta(before, after, "yoca_provider_retries_total"),
    dataUsage: metricDelta(before, after, "yoca_request_data_source_total"),
  };
}

async function runMarketRadar(
  baseUrl: string,
  runId: string,
  pass: PassName,
): Promise<JourneyResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const before = await fetchMetrics(baseUrl);
  let requestIndex = 0;
  const requests = [
    ["/api/tokens/market-pools/trending", "/api/tokens/market-pools/trending"],
    ["/api/tokens/market-pools/top", "/api/tokens/market-pools/top"],
    ["/api/tokens/market-pools/gainers", "/api/tokens/market-pools/gainers"],
    ["/api/tokens/market-pools/new-pairs", "/api/tokens/market-pools/new-pairs"],
    ["/api/trades/traders/gainers", "/api/trades/traders/gainers"],
    ["/api/trades/traders/losers", "/api/trades/traders/losers"],
  ];
  const endpointResults = await Promise.all(
    requests.map(([route, url]) => {
      requestIndex += 1;
      return requestEndpoint(baseUrl, runId, requestIndex, route, url);
    }),
  );
  const after = await fetchMetrics(baseUrl);
  return {
    journey: "market_radar",
    pass,
    resourceId: "market_radar",
    startedAt,
    durationMs: Date.now() - startedAtMs,
    endpoints: endpointResults.map(publicEndpointResult),
    providerAttempts: metricDelta(before, after, "yoca_provider_requests_total"),
    providerRetries: metricDelta(before, after, "yoca_provider_retries_total"),
    dataUsage: metricDelta(before, after, "yoca_request_data_source_total"),
  };
}

async function runWalletCore(
  baseUrl: string,
  runId: string,
  pass: PassName,
  resourceId: string,
  address: string,
): Promise<JourneyResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const before = await fetchMetrics(baseUrl);
  let requestIndex = 0;
  const requests = [
    ["/api/wallets/overview", `/api/wallets/overview?address=${address}&period=30D`],
    ["/api/wallets/portfolio", `/api/wallets/portfolio?address=${address}`],
    ["/api/wallets/:address/tokens", `/api/wallets/${address}/tokens`],
    ["/api/wallets/analysis/winrate", `/api/wallets/analysis/winrate?wallets=${address}&period=30D`],
  ];
  const endpointResults = await Promise.all(
    requests.map(([route, url]) => {
      requestIndex += 1;
      return requestEndpoint(baseUrl, runId, requestIndex, route, url);
    }),
  );
  const after = await fetchMetrics(baseUrl);
  return {
    journey: "wallet_core",
    pass,
    resourceId,
    startedAt,
    durationMs: Date.now() - startedAtMs,
    endpoints: endpointResults.map(publicEndpointResult),
    providerAttempts: metricDelta(before, after, "yoca_provider_requests_total"),
    providerRetries: metricDelta(before, after, "yoca_provider_retries_total"),
    dataUsage: metricDelta(before, after, "yoca_request_data_source_total"),
  };
}

async function main(): Promise<void> {
  if (!env.API_METRICS_ENABLED) {
    throw new Error("API_METRICS_ENABLED must be true for journey benchmarks");
  }

  const requestedJourney = argumentValue("journey") ?? "all";
  if (!["all", "market", "token", "wallet"].includes(requestedJourney)) {
    throw new Error("--journey must be all, market, token, or wallet");
  }
  const passCount = Number(argumentValue("passes") ?? "2");
  if (!Number.isInteger(passCount) || passCount < 1 || passCount > 2) {
    throw new Error("--passes must be 1 or 2");
  }
  const sampleCount = Number(argumentValue("samples") ?? "1");
  if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > 8) {
    throw new Error("--samples must be an integer from 1 to 8");
  }
  const requestedPhase = argumentValue("phase") ?? "observed";
  if (!["observed", "cold"].includes(requestedPhase)) {
    throw new Error("--phase must be observed or cold");
  }

  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(currentFile), "../../../../");
  const datasetDir = path.join(
    repoRoot,
    "docs/plans/business/benchmark-results/datasets",
  );
  const tokenDatasetPath = path.join(
    datasetDir,
    "token-benchmark-stable-2026-07-19.json",
  );
  const walletDatasetPath = path.join(
    datasetDir,
    "wallet-benchmark-stable-2026-07-19.json",
  );
  const tokenDataset = tokenDatasetSchema.parse(
    JSON.parse(await readFile(tokenDatasetPath, "utf8")),
  );
  const walletDataset = walletDatasetSchema.parse(
    JSON.parse(await readFile(walletDatasetPath, "utf8")),
  );
  const tokens = tokenDataset.stableTokens.slice(0, sampleCount);
  const wallets = walletDataset.stableWallets.slice(0, sampleCount);
  if (tokens.length != sampleCount || wallets.length != sampleCount) {
    throw new Error("Stable token and wallet datasets must not be empty");
  }

  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const runId = `${timestamp}_journey-${requestedPhase}`;
  const runDir = path.join(
    repoRoot,
    "docs/plans/business/benchmark-results/runs",
    runId,
  );
  await mkdir(runDir, { recursive: true });
  let commit = "unknown";
  try {
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    commit = "unknown";
  }

  const manifest = {
    runId,
    commit,
    environment: "local_benchmark",
    database: "configured_server_database",
    startedAt: new Date().toISOString(),
    phase: passCount == 2
      ? `${requestedPhase}_first_and_warm_repeat`
      : `${requestedPhase}_first`,
    datasetVersion: "2026-07-19",
    sampleCount,
    providerMode: "real",
    notes: requestedPhase == "cold"
      ? "Database schema was reset immediately before this run; first pass is cold and the second is its warm repeat."
      : "Observed-first is not claimed as cold because database state was not controlled by this runner.",
  };
  await writeFile(
    path.join(runDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  const results: JourneyResult[] = [];
  for (let passIndex = 0; passIndex < passCount; passIndex += 1) {
    const pass: PassName = passIndex == 0
      ? requestedPhase == "cold" ? "cold" : "observed_first"
      : "warm_repeat";
    if (requestedJourney == "all" || requestedJourney == "market") {
      results.push(
        await runMarketRadar(
          env.YOCA_BENCHMARK_BASE_URL,
          `${runId}-market_radar-${pass}`,
          pass,
        ),
      );
    }
    if (requestedJourney == "all" || requestedJourney == "token") {
      for (const token of tokens) {
        results.push(
          await runTokenOverview(
            env.YOCA_BENCHMARK_BASE_URL,
            `${runId}-${token.resourceId}-${pass}`,
            pass,
            token.resourceId,
            token.address,
          ),
        );
      }
    }
    if (requestedJourney == "all" || requestedJourney == "wallet") {
      for (const [walletIndex, wallet] of wallets.entries()) {
        const resourceId = `wallet_${String(walletIndex + 1).padStart(3, "0")}`;
        results.push(
          await runWalletCore(
            env.YOCA_BENCHMARK_BASE_URL,
            `${runId}-${resourceId}-${pass}`,
            pass,
            resourceId,
            wallet.address,
          ),
        );
      }
    }
  }

  await writeFile(
    path.join(runDir, "events.jsonl"),
    `${results.map((result) => JSON.stringify(result)).join("\n")}\n`,
    "utf8",
  );
  const summary = {
    runId,
    journeys: results.map((result) => ({
      journey: result.journey,
      pass: result.pass,
      resourceId: result.resourceId,
      durationMs: result.durationMs,
      endpointCount: result.endpoints.length,
      successfulEndpoints: result.endpoints.filter((endpoint) =>
        endpoint.status != null && endpoint.status >= 200 && endpoint.status < 300
      ).length,
      providerAttemptCount: result.providerAttempts.reduce(
        (sum, sample) => sum + sample.value,
        0,
      ),
      providerRetryCount: result.providerRetries.reduce(
        (sum, sample) => sum + sample.value,
        0,
      ),
      endpoints: result.endpoints,
      providerAttempts: result.providerAttempts,
      dataUsage: result.dataUsage,
    })),
  };
  await writeFile(
    path.join(runDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify({ runId, runDir, journeys: summary.journeys }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
