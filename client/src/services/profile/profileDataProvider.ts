import type { ProfilePageData } from "@/types/profile";
import type { TimePeriod } from "@/types/chart-filters.types";
import { adaptProfilePayload } from "@/services/profile/profileAdapters";
import { profileMockApiPayload } from "@/services/profile/profileMockData";

export type ProfileDataSource = "mock" | "api";

export interface ProfileDataProvider {
    getProfilePageData(params: {
        period: TimePeriod;
        selectedWalletIds: string[];
    }): Promise<ProfilePageData>;
}

class MockProfileDataProvider implements ProfileDataProvider {
    async getProfilePageData(params: {
        period: TimePeriod;
        selectedWalletIds: string[];
    }): Promise<ProfilePageData> {
        const adapted = adaptProfilePayload(profileMockApiPayload);

        return {
            ...adapted,
            overview: {
                ...adapted.overview,
                period: params.period,
            },
            wallets: {
                ...adapted.wallets,
                selectedWalletIds:
                    params.selectedWalletIds.length > 0
                        ? params.selectedWalletIds
                        : adapted.wallets.selectedWalletIds,
            },
            activity: {
                ...adapted.activity,
                selectedWalletIds:
                    params.selectedWalletIds.length > 0
                        ? params.selectedWalletIds
                        : adapted.activity.selectedWalletIds,
            },
        };
    }
}

class ApiProfileDataProvider implements ProfileDataProvider {
    async getProfilePageData(): Promise<ProfilePageData> {
        // TODO(profile-api): replace with real endpoint calls and adapter mapping.
        throw new Error("API profile provider is not implemented yet.");
    }
}

export function getProfileDataSource(): ProfileDataSource {
    const value = (import.meta.env.VITE_PROFILE_DATA_SOURCE ?? "mock")
        .toString()
        .toLowerCase();

    return value === "api" ? "api" : "mock";
}

export function getProfileDataProvider(): ProfileDataProvider {
    const source = getProfileDataSource();
    return source === "api"
        ? new ApiProfileDataProvider()
        : new MockProfileDataProvider();
}
