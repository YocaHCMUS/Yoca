import { OverviewTab, FundamentalTab, ProfitLossTab } from "@/components/market";
import TabContainer from "@/components/tabContainer/tabContainer";
import { useState } from "react";
import { Grid, Column, TextInput, Tag, Stack } from "@carbon/react";
import { Search, Close } from "@carbon/icons-react";
import { PageWrapper } from "@/components/wrapper";

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
            <div style={{ padding: "2rem", margin: "0 auto" }}>
                <Grid>
                    {/* 3 columns - Wallet Selection Sidebar */}
                    <Column lg={4} md={3} sm={4}>
                        <div style={{ position: "sticky", top: "2rem" }}>
                            <h3 style={{ marginBottom: "1rem" }}>Selected Wallets</h3>
                            
                            {/* Wallet Address Search */}
                            <TextInput
                                id="wallet-search"
                                labelText="Add Wallet Address"
                                placeholder="Enter wallet address..."
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                                onKeyPress={handleKeyPress}
                                style={{ marginBottom: "1rem" }}
                            />

                            {/* List of Selected Wallets */}
                            <Stack gap={4}>
                                {selectedWallets.length === 0 ? (
                                    <p style={{ fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
                                        No wallets selected. Add wallet addresses to compare.
                                    </p>
                                ) : (
                                    selectedWallets.map((wallet) => (
                                        <Tag
                                            key={wallet}
                                            filter
                                            onClose={() => handleRemoveWallet(wallet)}
                                            style={{ maxWidth: "100%" }}
                                        >
                                            <span style={{ 
                                                overflow: "hidden", 
                                                textOverflow: "ellipsis",
                                                display: "block"
                                            }}>
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