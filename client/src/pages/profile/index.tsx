import ProfileActivityTab from "@/components/profile/ProfileActivityTab";
import ProfileAlertTab from "@/components/profile/ProfileAlertTab";
import ProfileDashboardTab from "@/components/profile/ProfileDashboardTab";
import ProfileOverview from "@/components/profile/ProfileOverview";
import ProfileWalletTab from "@/components/profile/ProfileWalletTab";
import {
    PROFILE_TABS,
    type ProfileTabId,
} from "@/components/profile/profile.constants";
import TabContainer from "@/components/tabContainer/tabContainer";
import { PageWrapper } from "@/components/wrapper";
import { useProfilePageData } from "@/hooks/profile/useProfilePageData";
import type { TimePeriod } from "@/types/chart-filters.types";
import { InlineLoading } from "@carbon/react";
import { useEffect, useMemo, useState } from "react";
import styles from "./index.module.scss";

const DASHBOARD_ENABLED =
    String(import.meta.env.VITE_PROFILE_ENABLE_DASHBOARD ?? "true").toLowerCase() !==
    "false";

export default function ProfilePage() {
    const [period, setPeriod] = useState<TimePeriod>("30D");
    const [activeTab, setActiveTab] = useState(0);
    const { data, loading, error } = useProfilePageData({
        period,
    });

    const tabsConfig = useMemo(() => {
        const allTabs: Array<{ id: ProfileTabId; node: React.ReactNode }> = [
            {
                id: "dashboard",
                node: data ? <ProfileDashboardTab data={data.dashboard} /> : null,
            },
            {
                id: "alerts",
                node: data ? <ProfileAlertTab data={data.alerts} /> : null,
            },
            {
                id: "wallets",
                node: data ? (
                    <ProfileWalletTab
                        data={data.wallets}
                    />
                ) : null,
            },
            {
                id: "activity",
                node: data ? (
                    <ProfileActivityTab
                        data={data.activity}
                    />
                ) : null,
            },
        ];

        const visibleTabs = DASHBOARD_ENABLED
            ? allTabs
            : allTabs.filter((tab) => tab.id !== "dashboard");

        return {
            names: visibleTabs.map(
                (tab) => PROFILE_TABS.find((item) => item.id === tab.id)?.label ?? tab.id,
            ),
            nodes: visibleTabs.map((tab) => tab.node),
        };
    }, [data]);

    useEffect(() => {
        if (activeTab <= tabsConfig.names.length - 1) return;
        setActiveTab(0);
    }, [activeTab, tabsConfig.names.length]);

    return (
        <PageWrapper>
            <main className={styles.page}>
                {loading ? (
                    <div className={styles.loadingState}>
                        <InlineLoading description="Loading profile page" status="active" />
                    </div>
                ) : null}

                {error ? <div className={styles.errorState}>Failed to load profile: {error}</div> : null}

                {data && !loading ? (
                    <div className={styles.stack}>
                        <ProfileOverview data={data.overview} onPeriodChange={setPeriod} />
                        <section className={styles.tabSection}>
                            <TabContainer
                                activeTab={activeTab}
                                names={tabsConfig.names}
                                tabs={tabsConfig.nodes}
                                onTabChange={setActiveTab}
                            />
                        </section>
                    </div>
                ) : null}
            </main>
        </PageWrapper>
    );
}
