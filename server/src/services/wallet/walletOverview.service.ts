import { buildActivitySnapshotFromProviders, buildHoldingsSnapshotFromProviders, buildOverviewResponse, getLatestOverviewCacheRow, getOverviewFromFreshCache, OVERVIEW_PERIOD_KEYS } from "@sv/services/wallet/walletData.core.js";
import type { WalletOverview, WalletOverviewPeriodKey, WalletOverviewQueryOptions } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { saveOverviewCache } from "@sv/services/wallet/db/walletDataCacher.js";

export async function getWalletOverview(address: string, query?: WalletOverviewQueryOptions): Promise<WalletOverview> {
    const cacheRow = await getLatestOverviewCacheRow(address);
    const cachedOverview = query?.force ? null : getOverviewFromFreshCache(cacheRow, address);
    if (cachedOverview) {
        console.log("[wallet-overview]", {
            address,
            cacheHit: true,
            periods: OVERVIEW_PERIOD_KEYS,
        });
        return cachedOverview;
    }

    const holdingsSnapshot = await buildHoldingsSnapshotFromProviders(address, cacheRow);
    const { periodSnapshots, providerFailuresByPeriod } = await buildActivitySnapshotFromProviders(address, cacheRow);

    const overview = buildOverviewResponse({
        address,
        holdingsSnapshot,
        periodSnapshots,
    });

    await saveOverviewCache(overview);

    console.log("[wallet-overview]", {
        address,
        cacheHit: false,
        holdingsSource: holdingsSnapshot.source,
        periodSources: OVERVIEW_PERIOD_KEYS.reduce((acc, period) => {
            acc[period] = overview.periods[period].source;
            return acc;
        }, {} as Record<WalletOverviewPeriodKey, string>),
        providerFailuresByPeriod,
    });

    return overview;
}
