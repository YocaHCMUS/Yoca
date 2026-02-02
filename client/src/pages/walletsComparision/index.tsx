import { OverviewTab, FundamentalTab, ProfitLossTab } from "@/components/market";
import TabContainer from "@/components/tabContainer/tabContainer";
import { useState } from "react";
import { Grid, Column, TextInput, Tag, Stack } from "@carbon/react";
import { Search, Close } from "@carbon/icons-react";
import { PageWrapper } from "@/components/wrapper";
import styles from "./index.module.scss";

export default function WalletsComparisionPage() {
    const [activeTab, setActiveTab] = useState(0);
    const [walletAddress, setWalletAddress] = useState("");
    const [selectedWallets, setSelectedWallets] = useState<string[]>([]);

    const handleAddWallet = () => {
        if (walletAddress.trim() && !selectedWallets.includes(walletAddress.trim())) {
            setSelectedWallets([...selectedWallets, walletAddress.trim()]);
            setWalletAddress("");
        }
    };

    const handleRemoveWallet = (address: string) => {
        setSelectedWallets(selectedWallets.filter(w => w !== address));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddWallet();
        }
    };

    return (
        <PageWrapper>
            <div className={styles.walletsComparisonPage}>
                <Grid>
                    {/* 3 columns - Wallet Selection Sidebar */}
                    <Column lg={4} md={3} sm={4}>
                        <div className={styles.sidebarContainer}>
                            <h3 className={styles.sidebarTitle}>Selected Wallets</h3>
                            
                            {/* Wallet Address Search */}
                            <TextInput
                                id="wallet-search"
                                labelText="Add Wallet Address"
                                placeholder="Enter wallet address..."
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className={styles.walletInput}
                            />

                            {/* List of Selected Wallets */}
                            <Stack gap={4} className={styles.walletList}>
                                {selectedWallets.length === 0 ? (
                                    <p className={styles.emptyState}>
                                        No wallets selected. Add wallet addresses to compare.
                                    </p>
                                ) : (
                                    selectedWallets.map((wallet) => (
                                        <Tag
                                            key={wallet}
                                            filter
                                            onClose={() => handleRemoveWallet(wallet)}
                                            className={styles.walletTag}
                                        >
                                            <span>
                                                {wallet.slice(0, 6)}...{wallet.slice(-4)}
                                            </span>
                                        </Tag>
                                    ))
                                )}
                            </Stack>
                        </div>
                    </Column>

                    {/* 9 columns - Main Content Area */}
                    <Column lg={12} md={5} sm={4}>
                        <TabContainer
                            activeTab={activeTab}
                            names={["General", "Holdings", "Profit & Risk Management"]} // remember to refactor this to support localization (not now since we have to refactor localization hooks first)
                            tabs={[<OverviewTab />, <FundamentalTab />, <ProfitLossTab />]} //for testing purpose
                            onTabChange={(index) => setActiveTab(index)}
                        />
                    </Column>
                </Grid>
            </div>
        </PageWrapper>
    )
}