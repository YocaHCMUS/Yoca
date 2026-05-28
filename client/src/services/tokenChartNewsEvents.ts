import client from "@/api/main";
import type {
  TokenChartNewsEventsData,
  TokenChartNewsEventsQuery,
  TokenChartNewsEventsResponse,
} from "@/types/chartNewsEvents";

export async function getTokenChartNewsEvents({
  address,
  symbol,
  name,
  timeframe,
  includeSummary = false,
}: TokenChartNewsEventsQuery): Promise<TokenChartNewsEventsData> {
  const response = await client.api.tokenChartNewsEvents.index.$get({
    query: {
      address,
      symbol,
      name,
      timeframe,
      includeSummary: includeSummary ? "true" : "false",
    },
  });

  const payload = (await response.json()) as TokenChartNewsEventsResponse;

  if (!response.ok || !payload.success) {
    throw new Error("Unable to load chart news events");
  }

  return payload.data;
}
