import React, { useState, useEffect } from 'react';
import { Bookmark, Notification, Share, ColumnDependency, Repeat, BookmarkFilled, Edit, Tag as TagIcon } from '@carbon/react/icons';
import { CopyButton, Link, Slider, Tooltip, Tag } from '@carbon/react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWalletIntelligence, fetchWalletOverview } from '@/services/wallet/walletApi';
import { fetchWalletTags, saveWalletTags } from '@/services/wallet/walletTagsApi';
import { useNavigate } from 'react-router';
import { WalletLabelModal } from '@/components/wallet/WalletLabelModal/WalletLabelModal';
import { WalletTagsModal } from '@/components/wallet/WalletTagsModal/WalletTagsModal';
import styles from './WalletOverview.module.scss';

function shortenWalletAddress(address: string): string {
    const normalized = address.trim();
    if (normalized.length <= 14) {
        return normalized;
    }

    return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

function getRiskTagType(level: unknown): 'green' | 'warm-gray' | 'red' {
    if (level === 'low') {
        return 'green';
    }

    if (level === 'medium') {
        return 'warm-gray';
    }

    return 'red';
}

export enum OverviewFilterSelection {
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
    const { user } = useAuth();

    // State for overview data
    const [overview, setOverview] = useState<any>(null);
    const [intelligence, setIntelligence] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Label state – persisted to localStorage per wallet address
    const labelKey = `wallet-label-${walletAddress}`;
    const [label, setLabel] = useState<string>(
        () => localStorage.getItem(labelKey) ?? ""
    );
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

    const handleLabelSave = (newLabel: string) => {
        setLabel(newLabel);
        if (newLabel) {
            localStorage.setItem(labelKey, newLabel);
        } else {
            localStorage.removeItem(labelKey);
        }
    };

    // Tags state – server-persisted per user; empty until loaded
    const [tags, setTags] = useState<string[]>([]);
    const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);

    // Load tags from server whenever the authenticated user or wallet changes
    useEffect(() => {
        if (!user || !walletAddress || walletAddress === 'null') {
            setTags([]);
            return;
        }
        fetchWalletTags(walletAddress)
            .then(setTags)
            .catch((err) => console.error('[WalletOverview] Failed to load tags:', err));
    }, [user, walletAddress]);

    const handleTagsSave = async (newTags: string[]) => {
        try {
            await saveWalletTags(walletAddress, newTags);
            setTags(newTags);
        } catch (err) {
            console.error('[WalletOverview] Failed to save tags:', err);
        }
    };

    const identityStatus = intelligence?.identity?.status ?? null;
    const identityName = intelligence?.identity?.name ?? null;
    const identityCategory = intelligence?.identity?.category ?? null;
    const riskLevel = intelligence?.analysis?.riskLevel ?? null;

    // Provide default values for display
    const name = label || (identityStatus === 'known' && identityName ? identityName : "Wallet");
    const displayedAddress = identityStatus === 'unknown'
        ? shortenWalletAddress(walletAddress)
        : walletAddress;
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
    const [customDays, setCustomDays] = useState(2);

    const getSelectedOverviewPeriod = () => {
        if (filterOption === OverviewFilterSelection.day) {
            return '24h';
        }

        if (filterOption === OverviewFilterSelection.week) {
            return '7d';
        }

        const boundedDays = Math.max(1, Math.min(7, customDays));
        return boundedDays === 1 ? '24h' : `${boundedDays}d`;
    };

    const { tr, fmt } = useLocalization();

    // Fetch wallet overview data
    useEffect(() => {
        const loadOverview = async () => {
            try {
                setLoading(true);
                setError(null);

                const [overviewResult, intelligenceResult] = await Promise.allSettled([
                    fetchWalletOverview(
                        walletAddress,
                        'solana',
                        getSelectedOverviewPeriod(),
                    ),
                    fetchWalletIntelligence(walletAddress, 'solana'),
                ]);

                if (overviewResult.status === 'rejected') {
                    throw overviewResult.reason;
                }

                setOverview(overviewResult.value);

                if (intelligenceResult.status === 'fulfilled') {
                    setIntelligence(intelligenceResult.value);
                } else {
                    setIntelligence(null);
                }
            } catch (err) {
                console.error('Failed to fetch wallet overview:', err);
                setError(err instanceof Error ? err.message : 'Failed to load wallet data');
                setIntelligence(null);
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
    }, [walletAddress, autoRefresh, refreshInterval, filterOption, customDays]);

    const handleBookmark = () => {
        setBookmark(!bookmark);
        // Add your bookmark logic here
        console.log('Bookmark toggled:', !bookmark);
    };

    const handleCreateAlert = () => {
        // Add your alert creation logic here
        console.log('Create alert clicked');
    };

    const navigate = useNavigate();

    const handleShare = () => {
        // Add your share logic here
        console.log('Share clicked');
    };

    const handleCompare = () => {
        navigate(`/comparision/wallets?wallets=${encodeURIComponent(walletAddress)}`);
    };

    const handleFilterClick = (option: OverviewFilterSelection, value: number) => {
        setFilterOptions(option);
        setFilterValue(value);
        setShowCustomControl(false);
        console.log(`Filter changed to: ${OverviewFilterSelection[option]} (${value} days)`);
    };

    const handleCustomFilter = () => {
        setFilterOptions(OverviewFilterSelection.custom);
        setShowCustomControl(!showCustomControl);
    };

    const handleCustomDaysChange = ({ value }: { value: number }) => {
        const boundedValue = Math.max(1, Math.min(7, Math.round(value)));
        setCustomDays(boundedValue);
        setFilterValue(boundedValue);
        setFilterOptions(OverviewFilterSelection.custom);
        console.log(`Custom filter: ${boundedValue} days`);
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
        <>
            {/* main container: column */}
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
                        <div className={styles.walletNameRow}>
                            <h2 className={styles.walletName}>{name}</h2>
                            <button
                                className={styles.editLabelBtn}
                                onClick={() => setIsLabelModalOpen(true)}
                                aria-label="Edit wallet label"
                                title="Assign custom label"
                            >
                                <Edit size={16} />
                            </button>
                        </div>
                        <div className={styles.walletAddressContainer}>
                            {/* <Tooltip align="bottom" label={walletAddress}>
                        </Tooltip> */}
                            <h4
                                className={styles.walletAddress}
                            >
                                {displayedAddress}
                            </h4>
                            <CopyButton onClick={handleCopyAddress} />
                        </div>
                        <div className={styles.tagsRow}>
                            {identityStatus === 'known' && identityCategory && (
                                <Tag size="sm" type="teal">
                                    {identityCategory}
                                </Tag>
                            )}
                            {identityStatus === 'unknown' && (
                                <Tag size="sm" type="cool-gray">
                                    Unknown Entity
                                </Tag>
                            )}
                            {identityStatus === 'unavailable' && (
                                <Tag size="sm" type="red">
                                    Identity Unavailable
                                </Tag>
                            )}
                            {riskLevel && (
                                <Tag size="sm" type={getRiskTagType(riskLevel)}>
                                    Risk: {String(riskLevel).toUpperCase()}
                                </Tag>
                            )}
                            {tags.map((tag, index) => (
                                <Tag
                                    key={index}
                                    size="md"
                                    type="cyan"
                                >
                                    {tag}
                                </Tag>
                            ))}
                            <Tooltip
                                label={user ? 'Manage tags' : 'Sign in to manage tags'}
                                align="bottom"
                            >
                                <button
                                    className={styles.editLabelBtn}
                                    onClick={() => user && setIsTagsModalOpen(true)}
                                    aria-label="Manage wallet tags"
                                    disabled={!user}
                                >
                                    <TagIcon size={16} />
                                </button>
                            </Tooltip>
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
                                className={`${styles.filterButton} ${filterOption === OverviewFilterSelection.custom ? styles.active : ''}`}
                                onClick={handleCustomFilter}
                            >
                                {filterOption === OverviewFilterSelection.custom ? `${filterValue}${tr('wallet.filterCustomDateUnit')}` : tr('wallet.filterCustom')}
                                {showCustomControl && (
                                    <div className={styles.customControl}>
                                        <Slider
                                            min={1}
                                            max={7}
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
                                {fmt.num.currency(totalAssetValue !== null ? parseFloat(totalAssetValue.toFixed(6)) : null)}
                            </div>
                        </div>

                        {/* Trading Volume */}
                        <div className={styles.statItem}>
                            <div className={styles.statLabel}>
                                {tr('wallet.tradingVolume')}
                            </div>
                            <div className={styles.statValue}>
                                {fmt.num.currency(tradingVolumn !== null ? parseFloat(tradingVolumn.toFixed(6)) : null)}
                            </div>
                        </div>

                        {/* Total PnL */}
                        <div className={styles.statItem}>
                            <div className={styles.statLabel}>
                                {tr('wallet.totalPnL')}
                            </div>
                            <div className={totalPnL >= 0 ? styles.statValuePositive : styles.statValueNegative}>
                                {fmt.num.currency(totalPnL !== null ? parseFloat(totalPnL.toFixed(6)) : null)}
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

            <WalletLabelModal
                isOpen={isLabelModalOpen}
                onClose={() => setIsLabelModalOpen(false)}
                onSave={handleLabelSave}
                walletAddress={walletAddress}
                initialLabel={label}
            />
            <WalletTagsModal
                isOpen={isTagsModalOpen}
                onClose={() => setIsTagsModalOpen(false)}
                onSave={handleTagsSave}
                walletAddress={walletAddress}
                walletLabel={label || undefined}
                initialTags={tags}
            />
        </>
    );
}

export default WalletOverview;