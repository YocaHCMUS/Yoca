import dayjs from "dayjs";

export type WalletRangeMs = {
  fromMs: number;
  toMs: number;
};

export function resolveRequestedRange(from?: number, to?: number): WalletRangeMs {
  const requestedToMs = to ?? dayjs.utc().valueOf();
  const requestedFromMs =
    from ?? dayjs.utc(requestedToMs).subtract(30, "day").valueOf();

  return {
    fromMs: Math.min(requestedFromMs, requestedToMs),
    toMs: Math.max(requestedFromMs, requestedToMs),
  };
}

export function isMissingRangeSignificant(from: number, to: number): boolean {
  const TTL = 5 * 60 * 1000;
  return to - from > TTL;
}

export function getMissingRanges(
  requestedRange: WalletRangeMs,
  coveredRange: WalletRangeMs | null,
): WalletRangeMs[] {
  if (!coveredRange) {
    return [requestedRange];
  }

  const missingRanges: WalletRangeMs[] = [];

  if (requestedRange.fromMs < coveredRange.fromMs) {
    missingRanges.push({
      fromMs: requestedRange.fromMs,
      toMs: coveredRange.fromMs - 1,
    });
  }

  if (coveredRange.toMs < requestedRange.toMs) {
    missingRanges.push({
      fromMs: coveredRange.toMs + 1,
      toMs: requestedRange.toMs,
    });
  }

  return missingRanges.filter((range) => range.fromMs <= range.toMs);
}
