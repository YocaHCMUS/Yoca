import React, { useState } from 'react';
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

export const WalletOverview: React.FC<WalletOverviewProps> = ({
    walletAddress = "null",
    height = 400,
    initialFilters,
    autoRefresh = true,
    refreshInterval = 30000
}) => {
    // mock data, need to create a hook to fetch these information
    const name = "Wallet A"; 
    const tags = ["whale", "early x holder", "early y holder", "metamask user", "metamask user", "metamask user", "metamask user", "metamask user", "metamask user", "metamask user", "metamask user", "metamask user", "metamask user"];
    const totalAssetValue = 14199;
    const tradingVolumn = 1822333;
    const totalPnL = 140000;
    const transactionCount = 1133;
    const tokenTraded = 54;
    const numberOfTokenHolding = 32;

    const [bookmark, setBookmark] = useState(false);
    const [filterOption, setFilterOptions] = useState(OverviewFilterSelection.day);
    const [filterValue, setFilterValue] = useState(1); // 24h
    const [showCustomControl, setShowCustomControl] = useState(false);
    const [customDays, setCustomDays] = useState(30);

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
                            Tokens traded
                        </div>
                        <div className={styles.statLabel}>
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