import { useEffect, useMemo, useState } from "react";
import type { ProfilePageData } from "@/types/profile";
import type { TimePeriod } from "@/types/chart-filters.types";
import { getProfileDataProvider } from "@/services/profile/profileDataProvider";

interface UseProfilePageDataInput {
    period: TimePeriod;
}

interface UseProfilePageDataResult {
    data: ProfilePageData | null;
    loading: boolean;
    error: string | null;
}

export function useProfilePageData({
    period,
}: UseProfilePageDataInput): UseProfilePageDataResult {
    const provider = useMemo(() => getProfileDataProvider(), []);
    const [data, setData] = useState<ProfilePageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;
        setLoading(true);
        setError(null);

        provider
            .getProfilePageData({ period })
            .then((nextData) => {
                if (!isActive) return;
                setData(nextData);
            })
            .catch((err: unknown) => {
                if (!isActive) return;
                const message = err instanceof Error ? err.message : "Unknown error";
                setError(message);
            })
            .finally(() => {
                if (!isActive) return;
                setLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [period, provider]);

    return { data, loading, error };
}
