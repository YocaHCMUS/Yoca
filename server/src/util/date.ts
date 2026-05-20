import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

type DayPeriodLike = "24H" | "7D" | "30D" | "60D" | "90D" | "1Y" | "All";

export const periodToDayCount: Record<DayPeriodLike, number> = {
  "24H": 1,
  "7D": 7,
  "30D": 30,
  "60D": 60,
  "90D": 90,
  "1Y": 365,
  All: -1,
};

export function getUtcDatesFromNow(dayPeriod: DayPeriodLike): string[] {
  const nowUtc = dayjs.utc();
  const todayStart = nowUtc.startOf("day");
  const results: string[] = [];

  for (let i = 0; i < periodToDayCount[dayPeriod]; i++) {
    const date = todayStart.subtract(i, "day");
    results.push(date.toISOString());
  }
  return results;
}
