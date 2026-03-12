import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
    const marketsGetMock = vi.fn();
    const getCoinGeckoIdListMock = vi.fn();
    const insertCalls: unknown[] = [];
    let freshRows: any[] = [];

    const db = {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn(async () => freshRows),
                })),
            })),
        })),
        insert: vi.fn(() => ({
            values: vi.fn((rows: unknown) => {
                insertCalls.push(rows);
                return {
                    onConflictDoUpdate: vi.fn(() => ({
                        returning: vi.fn(async () => rows),
                    })),
                };
            }),
        })),
    };

    const tokenMarketData = {
        address: "token_market_data.address",
        updatedAt: "token_market_data.updated_at",
    };

    return {
        db,
        marketsGetMock,
        getCoinGeckoIdListMock,
        tokenMarketData,
        insertCalls,
        get freshRows() {
            return freshRows;
        },
        set freshRows(value: any[]) {
            freshRows = value;
        },
    };
});

vi.mock("@sv/config/constants.js", () => ({
    TOKEN_MARKET_DATA_TTL_MS: 60 * 60 * 1000,
}));

vi.mock("@sv/db/index.js", () => ({
    db: hoisted.db,
}));

vi.mock("@sv/db/schema.js", () => ({
    tokenMarketData: hoisted.tokenMarketData,
}));

vi.mock("@sv/util/orm-sql.js", () => ({
    excludedAuto: vi.fn(() => ({})),
}));

vi.mock("@sv/util/util-coingecko.js", () => ({
    client: {
        coins: {
            markets: {
                get: hoisted.marketsGetMock,
            },
        },
    },
}));

vi.mock("@sv/services/tokens/token-list.js", () => ({
    getCoinGeckoIdList: hoisted.getCoinGeckoIdListMock,
}));

vi.mock("drizzle-orm", () => ({
    and: (...args: unknown[]) => ({ op: "and", args }),
    gte: (...args: unknown[]) => ({ op: "gte", args }),
    inArray: (...args: unknown[]) => ({ op: "inArray", args }),
}));

describe("token-market-data service", () => {
    beforeEach(() => {
        vi.resetModules();
        hoisted.marketsGetMock.mockReset();
        hoisted.getCoinGeckoIdListMock.mockReset();
        hoisted.insertCalls.length = 0;
        hoisted.freshRows = [];
    });

    it("normalizes null required values and sets non-null decimals", async () => {
        const { getMarketDataFromRaw } = await import("../../src/services/tokens/token-market-data.ts");

        const mapped = getMarketDataFromRaw("So11111111111111111111111111111111111111112", {
            id: "solana",
            current_price: null,
            market_cap: null,
            fully_diluted_valuation: null,
            total_volume: null,
            ath_date: "invalid-date",
            atl_date: null,
            market_cap_rank: null,
            high_24h: null,
            low_24h: null,
            price_change_24h: null,
            price_change_percentage_1h_in_currency: null,
            price_change_percentage_24h_in_currency: null,
            price_change_percentage_7d_in_currency: null,
            price_change_percentage_14d_in_currency: null,
            price_change_percentage_30d_in_currency: null,
            price_change_percentage_200d_in_currency: null,
            price_change_percentage_1y_in_currency: null,
            market_cap_change_24h: null,
            market_cap_change_percentage_24h: null,
            circulating_supply: null,
            max_supply: null,
            total_supply: null,
            ath: null,
            ath_change_percentage: null,
            atl: null,
            atl_change_percentage: null,
        } as any);

        expect(mapped.decimals).toBe(9);
        expect(mapped.priceUsd).toBe(0);
        expect(mapped.marketCap).toBe(0);
        expect(mapped.fullyDilutedValuation).toBe(0);
        expect(mapped.volume24h).toBe(0);
        expect(mapped.athDate).toBeNull();
        expect(mapped.atlDate).toBeNull();
    });

    it("deduplicates concurrent stale refresh for identical token set", async () => {
        const { getTokenMarketData } = await import("../../src/services/tokens/token-market-data.ts");

        const address = "So11111111111111111111111111111111111111112";
        hoisted.getCoinGeckoIdListMock.mockResolvedValue({ [address]: "solana" });

        let resolveApi!: (value: any[]) => void;
        const apiPromise = new Promise<any[]>((resolve) => {
            resolveApi = resolve;
        });
        hoisted.marketsGetMock.mockReturnValue(apiPromise);

        const p1 = getTokenMarketData([address]);
        const p2 = getTokenMarketData([address]);

        // Allow async DB/cache checks to progress before the external API call assertion.
        for (let i = 0; i < 5; i++) {
            await Promise.resolve();
        }
        expect(hoisted.marketsGetMock).toHaveBeenCalledTimes(1);

        resolveApi([
            {
                id: "solana",
                current_price: 85.47,
                market_cap: 1106005810,
                fully_diluted_valuation: 1106005810,
                total_volume: 538481526,
                market_cap_rank: null,
                high_24h: null,
                low_24h: null,
                price_change_24h: null,
                price_change_percentage_1h_in_currency: null,
                price_change_percentage_24h_in_currency: null,
                price_change_percentage_7d_in_currency: null,
                price_change_percentage_14d_in_currency: null,
                price_change_percentage_30d_in_currency: null,
                price_change_percentage_200d_in_currency: null,
                price_change_percentage_1y_in_currency: null,
                market_cap_change_24h: null,
                market_cap_change_percentage_24h: null,
                circulating_supply: null,
                max_supply: null,
                total_supply: null,
                ath: null,
                ath_change_percentage: null,
                ath_date: null,
                atl: null,
                atl_change_percentage: null,
                atl_date: null,
            },
        ]);

        const [r1, r2] = await Promise.all([p1, p2]);

        expect(hoisted.insertCalls).toHaveLength(1);
        expect(r1[address].decimals).toBe(9);
        expect(r2[address].decimals).toBe(9);
        expect(r1[address].priceUsd).toBe(85.47);
        expect(r2[address].priceUsd).toBe(85.47);
    });
});
