import { TabContainer } from "@/components/tabContainer/tabContainer";
import { GeneralTab } from "@/components/wallet/WalletComparision/GeneralTab";
import { HoldingTab } from "@/components/wallet/WalletComparision/HoldingTab";
import { RiskTab } from "@/components/wallet/WalletComparision/RiskTab";
import { PageWrapper } from "@/components/wrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button, Column, Grid, Search, Stack } from "@carbon/react";
import { Close, SearchAdvanced } from "@carbon/react/icons";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import styles from "./index.module.scss";

export default function WalletsComparisionPage() {
  const [activeTab, setActiveTab] = useState(0);
  /** Tabs that have been opened at least once — panels stay mounted but pause fetching when inactive. */
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(() => new Set([0]));
  const [walletAddress, setWalletAddress] = useState("");
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const { tr } = useLocalization();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setVisitedTabs((prev) => new Set(prev).add(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (selectedWallets.length === 0) {
      setVisitedTabs(new Set([0]));
      setActiveTab(0);
    }
  }, [selectedWallets.length]);

  // Pre-populate from ?wallets=addr1,addr2 query param
  useEffect(() => {
    const param = searchParams.get("wallets");
    if (!param) return;
    const addresses = param
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (addresses.length > 0) {
      setSelectedWallets(addresses);
    }
  }, []); // run only once on mount

  const comparisonTabs = useMemo(
    () => [
      <GeneralTab
        key="wc-general"
        walletAddresses={selectedWallets}
        fetchEnabled={activeTab === 0}
      />,
      <HoldingTab
        key="wc-holding"
        walletAddresses={selectedWallets}
        fetchEnabled={activeTab === 1}
      />,
      <RiskTab
        key="wc-risk"
        walletAddresses={selectedWallets}
        fetchEnabled={activeTab === 2}
      />,
    ],
    [selectedWallets, activeTab],
  );

  const handleAddWallet = () => {
    if (
      walletAddress.trim() &&
      !selectedWallets.includes(walletAddress.trim())
    ) {
      setSelectedWallets([...selectedWallets, walletAddress.trim()]);
      setWalletAddress("");
    }
  };

  const handleRemoveWallet = (address: string) => {
    setSelectedWallets(selectedWallets.filter((w) => w !== address));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddWallet();
    }
  };

  return (
    <PageWrapper>
      <Grid className={styles.grid} fullWidth>
        {/* 3 columns - Wallet Selection Sidebar */}
        <Column lg={4} md={4} sm={4}>
          <div className={styles.sidebarContainer}>
            <h3 className={styles.sidebarTitle}>
              {tr("walletComparison.selectedWallets")}
            </h3>
            <Search
              id="wallet-search"
              labelText={tr("walletComparison.addWalletAddress")}
              placeholder={tr("walletComparison.enterWalletAddress")}
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              onKeyDown={handleKeyPress}
              renderIcon={SearchAdvanced}
            />

            {/* List of Selected Wallets */}
            <Stack gap={4} className={styles.walletList}>
              {selectedWallets.length === 0 ? (
                <p className={styles.emptyState}>
                  {tr("walletComparison.noWalletsSelected")}
                </p>
              ) : (
                selectedWallets.map((wallet) => (
                  <Button
                    className={styles.walletTag}
                    renderIcon={Close}
                    onClick={() => handleRemoveWallet(wallet)}
                    kind="tertiary"
                  >
                    <span className={styles.buttonTag}>
                      {wallet}
                    </span>
                  </Button>
                ))
              )}
            </Stack>
          </div>
        </Column>

        {/* 9 columns - Main Content Area */}
        <Column lg={12} md={12} sm={4}>
          <div className={styles.mainContentContainer}>
            <TabContainer
              activeTab={activeTab}
              names={[
                tr("walletComparison.general"),
                tr("walletComparison.holdings"),
                tr("walletComparison.profitRiskManagement"),
              ]}
              preserveMountedPanels
              visitedTabIndices={visitedTabs}
              tabs={comparisonTabs}
              onTabChange={(index) => setActiveTab(index)}
            />
          </div>
        </Column>
      </Grid>
      {/* <div className={styles.walletsComparisonPage}>
            </div> */}
    </PageWrapper>
  );
}
