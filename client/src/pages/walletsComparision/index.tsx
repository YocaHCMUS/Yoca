import { TabContainer } from "@/components/TabContainer/tabContainer";
import { GeneralTab } from "@/components/wallet/WalletComparision/GeneralTab";
import { HoldingTab } from "@/components/wallet/WalletComparision/HoldingTab";
import { RiskTab } from "@/components/wallet/WalletComparision/RiskTab";
import { PageWrapper } from "@/components/wrapper";
import { Button, Column, Grid, Search, Stack } from "@carbon/react";
import { Close, SearchAdvanced } from "@carbon/react/icons";
import { useState } from "react";
import { useLocalization } from "@/contexts/LocalizationContext";
import styles from "./index.module.scss";

export default function WalletsComparisionPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [walletAddress, setWalletAddress] = useState("");
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const { tr } = useLocalization();

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
            <h3 className={styles.sidebarTitle}>{tr('walletComparison.selectedWallets')}</h3>

            {/* Wallet Address Search */}
            {/* <TextInput
                            id="wallet-search"
                            labelText="Add Wallet Address"
                            placeholder="Enter wallet address..."
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className={styles.walletInput}
                        /> */}
            <Search
              id="wallet-search"
              labelText={tr('walletComparison.addWalletAddress')}
              placeholder={tr('walletComparison.enterWalletAddress')}
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              onKeyDown={handleKeyPress}
              renderIcon={SearchAdvanced}
            />

            {/* List of Selected Wallets */}
            <Stack gap={4} className={styles.walletList}>
              {selectedWallets.length === 0 ? (
                <p className={styles.emptyState}>
                  {tr('walletComparison.noWalletsSelected')}
                </p>
              ) : (
                selectedWallets.map((wallet) => (
                  <Button
                    className={styles.walletTag}
                    renderIcon={Close}
                    onClick={() => handleRemoveWallet(wallet)}
                    kind="tertiary"
                  >
                    {wallet}
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
              names={[tr('walletComparison.general'), tr('walletComparison.holdings'), tr('walletComparison.profitRiskManagement')]}
              tabs={[
                <GeneralTab walletAddresses={selectedWallets} />,
                <HoldingTab walletAddresses={selectedWallets} />,
                <RiskTab walletAddresses={selectedWallets} />,
              ]} //for testing purpose
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
