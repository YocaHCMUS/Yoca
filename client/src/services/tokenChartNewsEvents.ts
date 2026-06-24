import client from "@/api/main";
import type {
  TokenChartNewsEventsData,
  TokenChartNewsEventsQuery,
  TokenChartNewsEventsResponse,
} from "@/types/chartNewsEvents";

export class TokenChartNewsEventsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode?: string,
    readonly upgradePath?: string,
  ) {
    super(message);
    this.name = "TokenChartNewsEventsApiError";
  }
}

export async function getTokenChartNewsEvents({
  address,
  symbol,
  name,
  timeframe,
  includeSummary = false,
  forceRefresh = false,
  date,
}: TokenChartNewsEventsQuery): Promise<TokenChartNewsEventsData> {
  const response = await client.api.tokenChartNewsEvents.index.$get({
    query: {
      address,
      symbol,
      name,
      timeframe,
      includeSummary: includeSummary ? "true" : "false",
      ...(forceRefresh ? { forceRefresh: "true" } : {}),
      ...(date ? { date } : {}),
    },
  });

  const payload = (await response.json()) as TokenChartNewsEventsResponse & {
    success?: boolean;
    error?: string;
    message?: string;
    errorCode?: string;
    upgradePath?: string;
  };

  if (!response.ok || !payload.success) {
    throw new TokenChartNewsEventsApiError(
      payload.message || payload.error || "Unable to load chart news events",
      response.status,
      payload.errorCode,
      payload.upgradePath,
    );
  }

  return {
    ...payload.data,
    ...(payload.usage ? { usage: payload.usage } : {}),
    ...(typeof payload.counted === "boolean" ? { counted: payload.counted } : {}),
  };
}
