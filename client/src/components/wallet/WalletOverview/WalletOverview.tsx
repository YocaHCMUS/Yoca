import React from 'react';
import styles from './WalletOverview.module.scss';

export interface WalletOverviewProps {
    walletAddress: string,
    height?: number;
    initialFilters?: Partial<any>;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export const WalletOverview: React.FC<WalletOverviewProps> = ({
    walletAddress = "null",
    height = 400,
    initialFilters,
    autoRefresh = true,
    refreshInterval = 30000
}) => {
    // mock data, need to create a hook to fetch these information
    const name = "Wallet A"; 
    const tags = ["whale", "early x holder", "early y holder", "metamask user"];
    const totalAssetValue = 14199;
    const tradingVolumn = 1822333;
    const totalPnL = 140000;
    const transactionCount = 1133;
    const tokenTraded = 54;
    const numberOfTokenHolding = 32;

    return (
        // main container: column
        <div className={styles.walletOverview}>
            {/* 1st row: row containing 3 columns */}
            <div className={styles.topSection}> 
                {/* 1st column: profile picture */}
                <div className={styles.profilePicture}>
                    {name.charAt(0)}
                </div>
                
                {/* 2nd column: basic profile information (name, wallet address, tags) */}
                <div className={styles.profileInfo}>
                    <h2 className={styles.walletName}>{name}</h2>
                    <h3 className={styles.walletAddress}>
                        {walletAddress}
                    </h3>
                    <div className={styles.tags}>
                        {tags.map((tag, index) => (
                            <span 
                                key={index}
                                className={styles.tag}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
                
                {/* 3rd column: 1st line: filter buttons ; 2nd line: utilities links (bookmark, create alert, share, compare) */}
                <div className={styles.actions}>
                    <div className={styles.filterButtons}>
                        <button className={styles.filterButton}>
                            24H
                        </button>
                        <button className={styles.filterButton}>
                            7D
                        </button>
                        <button className={styles.filterButton}>
                            30D
                        </button>
                    </div>
                    <div className={styles.utilityButtons}>
                        <button className={styles.utilityButton}>
                            📌 Bookmark
                        </button>
                        <button className={styles.utilityButton}>
                            🔔 Alert
                        </button>
                        <button className={styles.utilityButton}>
                            📤 Share
                        </button>
                        <button className={styles.utilityButton}>
                            ⚖️ Compare
                        </button>
                    </div>
                </div>
            </div>
            
            {/* 2nd row: row containing 6 columns, separated by a line*/}
            <div className={styles.statsSection}>
                <div className={styles.statsGrid}>
                    {/* Total Asset Value */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            Total Asset Value
                        </div>
                        <div className={styles.statValue}>
                            ${totalAssetValue.toLocaleString()}
                        </div>
                    </div>
                    
                    {/* Trading Volume */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            Trading Volume
                        </div>
                        <div className={styles.statValue}>
                            ${tradingVolumn.toLocaleString()}
                        </div>
                    </div>
                    
                    {/* Total PnL */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            Total PnL
                        </div>
                        <div className={totalPnL >= 0 ? styles.statValuePositive : styles.statValueNegative}>
                            ${totalPnL.toLocaleString()}
                        </div>
                    </div>
                    
                    {/* Transaction Count */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            Transactions
                        </div>
                        <div className={styles.statValue}>
                            {transactionCount.toLocaleString()}
                        </div>
                    </div>
                    
                    {/* Token Traded */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            Tokens Traded
                        </div>
                        <div className={styles.statValue}>
                            {tokenTraded}
                        </div>
                    </div>
                    
                    {/* Tokens Holding */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            Tokens Holding
                        </div>
                        <div className={styles.statValue}>
                            {numberOfTokenHolding}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WalletOverview;