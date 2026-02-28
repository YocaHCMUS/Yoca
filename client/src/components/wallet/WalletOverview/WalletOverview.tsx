import React, { useEffect, useState } from 'react';
import { Bookmark, Notification, Share, ColumnDependency, Repeat, BookmarkFilled } from '@carbon/react/icons';
import { CopyButton, Link, Slider, Tooltip, Tag } from '@carbon/react';
import styles from './WalletOverview.module.scss';

export enum OverviewFilterSelection {
    month,
    week,
    day,
    custom
}

export interface WalletOverviewProps {
    walletAddress: string,
    height?: number;
    initialFilters?: Partial<any>;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

interface WalletOverviewApiResponse {
    address: string;
    chain: string;
    totalAssetValueUsd: number;
    tradingVolumeUsd24h: number | null;
    pnlUsdTotal: number | null;
    transactionCount24h: number | null;
    tokensTradedCount: number | null;
    tokensHoldingCount: number;
}

export const WalletOverview: React.FC<WalletOverviewProps> = ({
    walletAddress = "null",
    height = 400,
    initialFilters,
    autoRefresh = true,
    refreshInterval = 30000
}) => {
    // basic static metadata for now; can be enriched from DB later
    const name = "Wallet"; 
    const tags = ["whale"]; 

    const [overview, setOverview] = useState<WalletOverviewApiResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [bookmark, setBookmark] = useState(false);
    const [filterOption, setFilterOptions] = useState(OverviewFilterSelection.day);
    const [filterValue, setFilterValue] = useState(1); // 24h
    const [showCustomControl, setShowCustomControl] = useState(false);
    const [customDays, setCustomDays] = useState(30);

    useEffect(() => {
        if (!walletAddress) return;

        let cancelled = false;

        const fetchOverview = async () => {
            setLoading(true);
            setError(null);
            try {
                const resp = await fetch(`/api/wallets/${walletAddress}/overview?chain=solana`);
                if (!resp.ok) {
                    throw new Error(`Failed to load wallet overview: ${resp.status}`);
                }
                const data: WalletOverviewApiResponse = await resp.json();
                if (!cancelled) {
                    setOverview(data);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Failed to fetch wallet overview", err);
                    setError("Failed to load wallet overview");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchOverview();

        return () => {
            cancelled = true;
        };
    }, [walletAddress]);

    const handleBookmark = () => {
        setBookmark(!bookmark);
        // Add your bookmark logic here
        console.log('Bookmark toggled:', !bookmark);
    };

    const handleCreateAlert = () => {
        // Add your alert creation logic here
        console.log('Create alert clicked');
    };

    const handleShare = () => {
        // Add your share logic here
        console.log('Share clicked');
    };

    const handleCompare = () => {
        // Add your compare logic here
        console.log('Compare clicked');
    };

    const handleFilterClick = (option: OverviewFilterSelection, value: number) => {
        setFilterOptions(option);
        setFilterValue(value);
        setShowCustomControl(false);
        console.log(`Filter changed to: ${OverviewFilterSelection[option]} (${value} days)`);
    };

    const handleCustomFilter = () => {
        setShowCustomControl(!showCustomControl);
        if (!showCustomControl) {
            setFilterOptions(OverviewFilterSelection.custom);
        }
    };

    const handleCustomDaysChange = ({ value }: { value: number }) => {
        setCustomDays(value);
        setFilterValue(value);
        console.log(`Custom filter: ${value} days`);
    };

    const handleCopyAddress = async () => {
        try {
            await navigator.clipboard.writeText(walletAddress);
            console.log('Wallet address copied to clipboard');
            // Optionally add a toast notification here
        } catch (err) {
            console.error('Failed to copy wallet address:', err);
        }
    };

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
                    <div className={styles.walletAddressContainer}>
                        {/* <Tooltip align="bottom" label={walletAddress}>
                        </Tooltip> */}
                        <h4
                            className={styles.walletAddress}
                        >
                            {walletAddress}
                        </h4>
                        <CopyButton onClick={handleCopyAddress}/>
                    </div>
                    <div className={styles.tags}>
                        {tags.map((tag, index) => (
                            <Tag
                                key={index}
                                size="md"
                                title="Clear filter"
                                type="cyan" // probably change color based on tag type
                            >
                                {tag}
                            </Tag>
                        ))}
                    </div>
                </div>
                
                {/* 3rd column: 1st line: filter buttons ; 2nd line: utilities links (bookmark, create alert, share, compare) */}
                <div className={styles.actions}>
                    <div className={styles.filterButtons}>
                        <button 
                            className={`${styles.filterButton} ${filterOption === OverviewFilterSelection.day ? styles.active : ''}`}
                            onClick={() => handleFilterClick(OverviewFilterSelection.day, 1)}
                        >
                            24H
                        </button>
                        <button 
                            className={`${styles.filterButton} ${filterOption === OverviewFilterSelection.week ? styles.active : ''}`}
                            onClick={() => handleFilterClick(OverviewFilterSelection.week, 7)}
                        >
                            7D
                        </button>
                        <button 
                            className={`${styles.filterButton} ${filterOption === OverviewFilterSelection.month ? styles.active : ''}`}
                            onClick={() => handleFilterClick(OverviewFilterSelection.month, 30)}
                        >
                            30D
                        </button>
                        <button 
                            className={`${styles.filterButton} ${filterOption === OverviewFilterSelection.custom ? styles.active : ''}`}
                            onClick={handleCustomFilter}
                        >
                            {filterOption === OverviewFilterSelection.custom ? `${filterValue}D` : "Custom"}
                            {showCustomControl && (
                                <div className={styles.customControl}>
                                    <Slider
                                        min={1}
                                        max={365}
                                        value={customDays}
                                        onChange={handleCustomDaysChange}
                                        step={1}
                                        hideTextInput
                                    />
                                </div>
                            )}
                        </button>
                    </div>
                    <div className={styles.utilityButtons}>
                        <Link onClick={handleShare} renderIcon={Share}>
                            Share this wallet
                        </Link>
                        <Link onClick={handleCompare} renderIcon={Repeat}>
                            Compare this wallet
                        </Link>
                        <Link onClick={handleCreateAlert} renderIcon={Notification}>
                            Create alert for this wallet
                        </Link>
                        <Link onClick={handleBookmark} 
                            renderIcon={bookmark ? BookmarkFilled : Bookmark}>
                            {bookmark ? 'Bookmarked' : 'Bookmark this wallet'}
                        </Link>
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
                            {loading && !overview ? "Loading..." : `$${(overview?.totalAssetValueUsd ?? 0).toLocaleString()}`}
                        </div>
                    </div>
                    
                    {/* Trading Volume */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            Trading Volume
                        </div>
                        <div className={styles.statValue}>
                            {overview?.tradingVolumeUsd24h != null
                                ? `$${overview.tradingVolumeUsd24h.toLocaleString()}`
                                : "-"}
                        </div>
                    </div>
                    
                    {/* Total PnL */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            Total PnL
                        </div>
                        <div className={(overview?.pnlUsdTotal ?? 0) >= 0 ? styles.statValuePositive : styles.statValueNegative}>
                            {overview?.pnlUsdTotal != null
                                ? `$${overview.pnlUsdTotal.toLocaleString()}`
                                : "-"}
                        </div>
                    </div>
                    
                    {/* Transaction Count */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            Tokens traded
                        </div>
                        <div className={styles.statValue}>
                            {overview?.tokensTradedCount ?? "-"}
                        </div>
                    </div>
                    
                    {/* Tokens Holding */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            Tokens Holding
                        </div>
                        <div className={styles.statValue}>
                            {overview?.tokensHoldingCount ?? "-"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WalletOverview;