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

export function getStartOfUtcDatesFromNow(dayPeriod: DayPeriodLike): string[] {
  const nowUtc = dayjs.utc();
  const todayStart = nowUtc.startOf("day");
  const results: string[] = [];

  for (let i = 0; i < periodToDayCount[dayPeriod]; i++) {
    const date = todayStart.subtract(i, "day");
    results.push(date.toISOString());
  }
  return results;
}

export function getStartOfUtcDatesFromNowMs(
  dayPeriod: DayPeriodLike,
): number[] {
  const nowUtc = dayjs.utc();
  const todayStart = nowUtc.startOf("day");
  const results: number[] = [];

  for (let i = 0; i < periodToDayCount[dayPeriod]; i++) {
    const date = todayStart.subtract(i, "day");
    results.push(date.valueOf());
  }
  return results;
}

export function getEndOfUtcDatesFromNowMs(
  dayPeriod: DayPeriodLike,
): number[] {
  const nowUtc = dayjs.utc();
  const todayStart = nowUtc.endOf("day");
  const results: number[] = [];

  for (let i = 0; i < periodToDayCount[dayPeriod]; i++) {
    const date = todayStart.subtract(i, "day");
    results.push(date.valueOf());
  }
  return results;
}

// end date is exclusive, start date is inclusive
export function getUtcDateRangeFromNow(
  dayPeriod: DayPeriodLike,
): [number, number] {
  const nowUtc = dayjs.utc();
  const todayStart = nowUtc.startOf("day");
  const dayCount = periodToDayCount[dayPeriod];

  const endDate = todayStart.add(1, "day").valueOf();
  const startDate = todayStart
    .subtract(dayCount == -1 ? 0 : dayCount - 1, "day")
    .valueOf();

  return [startDate, endDate];
}
