import ProfileActivityTab from "@/components/profile/activity/ProfileActivityTab";
import ProfileAlertTab from "@/components/profile/alerts/ProfileAlertTab";
import ProfileDashboardTab from "@/components/profile/dashboard/ProfileDashboardTab";
import ProfilePortfolioTab from "@/components/profile/portfolio/ProfilePortfolioTab";
import ProfileUnavailableState from "@/components/profile/shared/ProfileUnavailableState";
import ProfileWalletTab from "@/components/profile/wallets/ProfileWalletTab";
import ProfileWatchlistTab from "@/components/profile/watchlist/ProfileWatchlistTab";
import {
  PROFILE_TABS,
  type ProfileTabId,
} from "@/components/profile/shared/profile.constants";
import ProfileSettingsTab from "@/components/profile/settings";
import TabContainer from "@/components/tabContainer/tabContainer";
import { PageWrapper } from "@/components/wrapper";
import { useProfilePageData } from "@/hooks/profile/useProfilePageData";
import { useProfileSharedData } from "@/hooks/profile/useProfileSharedData";
import type { TimePeriod } from "@/types/chart-filters.types";
import { InlineLoading } from "@carbon/react";
import {
  Activity,
  ChartLine,
  Notification,
  Settings,
  StarFilled,
  User,
  Wallet,
} from "@carbon/react/icons";
import { useEffect, useMemo, useState } from "react";
import styles from "./index.module.scss";

const DASHBOARD_ENABLED =
  String(
    import.meta.env.VITE_PROFILE_ENABLE_DASHBOARD ?? "true",
  ).toLowerCase() !== "false";

export default function ProfilePage() {
  const [period, setPeriod] = useState<TimePeriod>("30D");
  const [activeTab, setActiveTab] = useState(0);
  const { data: profileData, loading: profileLoading } = useProfilePageData({
    period,
  });
  const [loading, setLoading] = useState(false);
  const {
    walletAddresses,
    linkedWallets,
    error: sharedError,
  } = useProfileSharedData({
    setLoading,
  });

  const tabsConfig = useMemo(() => {
    const allTabs: Array<{ id: ProfileTabId; node: React.ReactNode }> = [
      {
        id: "overview",
        node: (
          <ProfilePortfolioTab
            linkedWallets={linkedWallets}
            period={period}
            onPeriodChange={setPeriod}
          />
        ),
      },
      {
        id: "dashboard",
        node: <ProfileDashboardTab />,
      },
      {
        id: "alerts",
        node: profileData ? (
          <ProfileAlertTab data={profileData.alerts} />
        ) : (
          <ProfileUnavailableState
            title="Alerts unavailable"
            description="No alert data is available right now."
          />
        ),
      },
      {
        id: "wallets",
        node: (
          <ProfileWalletTab walletAddresses={walletAddresses} period={period} />
        ),
      },
      {
        id: "watchlist",
        node: <ProfileWatchlistTab />,
      },
      {
        id: "activity",
        node: (
          <ProfileActivityTab
            walletAddresses={walletAddresses}
            period={period}
          />
        ),
      },
      {
        id: "settings",
        node: <ProfileSettingsTab />,
      },
    ];

    let visibleTabs = allTabs;

    // Filter dashboard tab if disabled
    if (!DASHBOARD_ENABLED) {
      visibleTabs = allTabs.filter((tab) => tab.id !== "dashboard");
    }

    return {
      names: visibleTabs.map(
        (tab) =>
          PROFILE_TABS.find((item) => item.id === tab.id)?.label ?? tab.id,
      ),
      icons: visibleTabs.map((tab) => {
        if (tab.id === "overview") return <User size={16} />;
        if (tab.id === "dashboard") return <ChartLine size={16} />;
        if (tab.id === "alerts") return <Notification size={16} />;
        if (tab.id === "wallets") return <Wallet size={16} />;
        if (tab.id === "watchlist") return <StarFilled size={16} />;
        if (tab.id === "settings") return <Settings size={16} />;
        return <Activity size={16} />;
      }),
      nodes: visibleTabs.map((tab) => tab.node),
    };
  }, [walletAddresses, period, profileData]);

  useEffect(() => {
    if (activeTab <= tabsConfig.names.length - 1) return;
    setActiveTab(0);
  }, [activeTab, tabsConfig.names.length]);

  return (
    <PageWrapper>
      <main className={styles.page}>
        {loading || profileLoading ? (
          <div className={styles.loadingState}>
            <InlineLoading description="Loading profile page" status="active" />
          </div>
        ) : null}

        <div className={styles.tabSection}>
          <TabContainer
            activeTab={activeTab}
            names={tabsConfig.names}
            tabIcons={tabsConfig.icons}
            tabs={tabsConfig.nodes}
            onTabChange={setActiveTab}
            orientation="vertical"
          />
        </div>
      </main>
    </PageWrapper>
  );
}
