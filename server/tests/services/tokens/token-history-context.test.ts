import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    select: vi.fn(),
}));

vi.mock("@sv/db/index.js", () => ({
    db: {
        select: mocks.select,
    },
}));

import { getTokenHistoricalContext } from "@sv/services/tokens/token-history.js";

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

function buildQueryResult(rows: Array<{ unixTimestampMs: number; price: number; marketCap: number }>) {
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));

    mocks.select.mockReturnValue({ from });

    return { limit, orderBy, where, from };
}

describe("getTokenHistoricalContext", () => {
    it("returns aligned cache-only context", async () => {
        const rows = [
            { unixTimestampMs: Date.UTC(2026, 4, 3), price: 3, marketCap: 30 },
            { unixTimestampMs: Date.UTC(2026, 4, 2), price: 2, marketCap: 20 },
            { unixTimestampMs: Date.UTC(2026, 4, 1), price: 1, marketCap: 10 },
        ];
        const chain = buildQueryResult(rows);

        const context = await getTokenHistoricalContext("Token1111111111111111111111111111111111111", 3);

        expect(context).toEqual({
            labels: ["2026-05-01", "2026-05-02", "2026-05-03"],
            priceSeries: [1, 2, 3],
            marketCapSeries: [10, 20, 30],
        });
        expect(mocks.select).toHaveBeenCalledTimes(1);
        expect(chain.limit).toHaveBeenCalledWith(3);
    });

    it("returns null on cache miss", async () => {
        const chain = buildQueryResult([]);

        const context = await getTokenHistoricalContext("Token1111111111111111111111111111111111111");

        expect(context).toBeNull();
        expect(mocks.select).toHaveBeenCalledTimes(1);
        expect(chain.limit).toHaveBeenCalledWith(5);
    });
});