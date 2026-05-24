import ProfileActivityTab from "@/components/profile/ProfileActivityTab";
import ProfileAlertTab from "@/components/profile/ProfileAlertTab";
import ProfileDashboardTab from "@/components/profile/ProfileDashboardTab";
import ProfilePortfolioTab from "@/components/profile/ProfilePortfolioTab";
import { ProfileSubscriptionsTab } from "@/components/profile/ProfileSubscriptionsTab";
import ProfileUnavailableState from "@/components/profile/ProfileUnavailableState";
import ProfileWalletTab from "@/components/profile/ProfileWalletTab";
import ProfileWatchlistTab from "@/components/profile/ProfileWatchlistTab";
import {
    PROFILE_TABS,
    type ProfileTabId,
} from "@/components/profile/profile.constants";
import ProfileSettingsTab from "@/components/profile/profileSettingsTab";
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
    Receipt,
    Settings,
    StarFilled,
    User,
    Wallet,
} from "@carbon/react/icons";
import { useEffect, useMemo, useState } from "react";
import styles from "./index.module.scss";

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
        node: profileData ? (
          <ProfileDashboardTab data={profileData.dashboard} />
        ) : (
          <ProfileUnavailableState
            title="Dashboard unavailable"
            description="No dashboard data is available right now."
          />
        ),
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
        id: "subscriptions",
        node: <ProfileSubscriptionsTab />,
      },
      {
        id: "settings",
        node: <ProfileSettingsTab />,
      },
    ];

    let visibleTabs = allTabs;

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
        if (tab.id === "subscriptions") return <Receipt size={16} />;
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
