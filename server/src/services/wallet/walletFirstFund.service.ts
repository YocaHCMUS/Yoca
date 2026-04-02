import { getCachedWalletFirstFund } from "@sv/services/wallet/db/walletDataRetriever";
import { HeliusWalletFirstFund } from "@sv/services/wallet/dtos/walletDataObjects";
import { saveWalletFirstFundCache } from "@sv/services/wallet/db/walletDataCacher";
import { fetchHeliusWalletFirstFund } from "@sv/services/wallet/fetchers/walletDataFetcher.service";

export async function getWalletFirstFund(
    address: string,
) {

    const cached = await getCachedWalletFirstFund(address);
    if (cached) {
        return cached as HeliusWalletFirstFund;
    } else {
        try {
            const firstFund = await fetchHeliusWalletFirstFund(address);
            await saveWalletFirstFundCache(firstFund);
            return firstFund;
        } catch (err) {
            return { error: (err instanceof Error) ? err.message : 'Unknown error' };
        }
    }
}