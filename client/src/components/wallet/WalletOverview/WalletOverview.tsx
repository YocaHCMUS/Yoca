import React, { useState, useEffect } from 'react';
import { Bookmark, Notification, Share, ColumnDependency, Repeat, BookmarkFilled } from '@carbon/react/icons';
import { CopyButton, Link, Slider, Tooltip, Tag } from '@carbon/react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { fetchWalletOverview } from '@/services/wallet/walletApi';
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

export const WalletOverview: React.FC<WalletOverviewProps> = ({
    walletAddress = "null",
    height = 400,
    initialFilters,
    autoRefresh = true,
    refreshInterval = 30000
}) => {
    // State for overview data
    const [overview, setOverview] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Provide default values for display
    const name = "Wallet"; 
    const tags = ["whale", "early x holder", "early y holder"];
    const totalAssetValue = overview?.totalAssetValueUsd ?? null;
    const tradingVolumn = overview?.tradingVolumeUsd24h ?? null;
    const totalPnL = overview?.pnlUsdTotal ?? null;
    const transactionCount = overview?.transactionCount24h ?? null;
    const tokenTraded = overview?.tokensTradedCount ?? null;
    const numberOfTokenHolding = overview?.tokensHoldingCount ?? null;

    const [bookmark, setBookmark] = useState(false);
    const [filterOption, setFilterOptions] = useState(OverviewFilterSelection.day);
    const [filterValue, setFilterValue] = useState(1); // 24h
    const [showCustomControl, setShowCustomControl] = useState(false);
    const [customDays, setCustomDays] = useState(30);

    const { tr, fmt } = useLocalization();

    // Fetch wallet overview data
    useEffect(() => {
        const loadOverview = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchWalletOverview(walletAddress, 'solana');
                setOverview(data);
            } catch (err) {
                console.error('Failed to fetch wallet overview:', err);
                setError(err instanceof Error ? err.message : 'Failed to load wallet data');
            } finally {
                setLoading(false);
            }
        };

        if (walletAddress && walletAddress !== 'null') {
            loadOverview();
            
            // Set up auto-refresh if enabled
            if (autoRefresh) {
                const interval = setInterval(loadOverview, refreshInterval);
                return () => clearInterval(interval);
            }
        }
    }, [walletAddress, autoRefresh, refreshInterval]);

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
            {error && (
                <div style={{ padding: '16px', marginBottom: '16px', backgroundColor: '#ffcccc', borderRadius: '4px', color: '#cc0000' }}>
                    {tr('common.error')}: {error}
                </div>
            )}
            {loading && (
                <div style={{ padding: '16px', marginBottom: '16px', backgroundColor: '#e6f2ff', borderRadius: '4px', color: '#0066cc' }}>
                    {tr('common.loading')}...
                </div>
            )}
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
                            {tr('wallet.filter24h')}
                        </button>
                        <button 
                            className={`${styles.filterButton} ${filterOption === OverviewFilterSelection.week ? styles.active : ''}`}
                            onClick={() => handleFilterClick(OverviewFilterSelection.week, 7)}
                        >
                            {tr('wallet.filter7d')}
                        </button>
                        <button 
                            className={`${styles.filterButton} ${filterOption === OverviewFilterSelection.month ? styles.active : ''}`}
                            onClick={() => handleFilterClick(OverviewFilterSelection.month, 30)}
                        >
                            {tr('wallet.filter30d')}
                        </button>
                        <button 
                            className={`${styles.filterButton} ${filterOption === OverviewFilterSelection.custom ? styles.active : ''}`}
                            onClick={handleCustomFilter}
                        >
                            {filterOption === OverviewFilterSelection.custom ? `${filterValue}${tr('wallet.filterCustomDateUnit')}` : tr('wallet.filterCustom')}
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
                            {tr('wallet.shareWallet')}
                        </Link>
                        <Link onClick={handleCompare} renderIcon={Repeat}>
                            {tr('wallet.compareWallet')}
                        </Link>
                        <Link onClick={handleCreateAlert} renderIcon={Notification}>
                            {tr('wallet.createAlert')}
                        </Link>
                        <Link onClick={handleBookmark} 
                            renderIcon={bookmark ? BookmarkFilled : Bookmark}>
                            {bookmark ? tr('wallet.bookmarked') : tr('wallet.bookmarkWallet')}
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
                            {tr('wallet.totalAssetValue')}
                        </div>
                        <div className={styles.statValue}>
                            {fmt.num.currency(totalAssetValue)}
                        </div>
                    </div>
                    
                    {/* Trading Volume */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            {tr('wallet.tradingVolume')}
                        </div>
                        <div className={styles.statValue}>
                            {fmt.num.currency(tradingVolumn)}
                        </div>
                    </div>
                    
                    {/* Total PnL */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            {tr('wallet.totalPnL')}
                        </div>
                        <div className={totalPnL >= 0 ? styles.statValuePositive : styles.statValueNegative}>
                            {fmt.num.currency(totalPnL)}
                        </div>
                    </div>
                    
                    {/* Transaction Count */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            {tr('wallet.tokensTraded')}
                        </div>
                        <div className={styles.statValue}>
                            {fmt.num.decimal(tokenTraded)}
                        </div>
                    </div>
                    
                    {/* Tokens Holding */}
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>
                            {tr('wallet.tokensHolding')}
                        </div>
                        <div className={styles.statValue}>
                            {fmt.num.decimal(numberOfTokenHolding)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WalletOverview;