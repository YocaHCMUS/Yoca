import React, { useState, useEffect } from 'react';
import { Bookmark, Notification, Share, Repeat, BookmarkFilled, Edit, Tag as TagIcon } from '@carbon/react/icons';
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

    const [overview, setOverview] = useState<any>(null);
    const [intelligence, setIntelligence] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    const [tags, setTags] = useState<string[]>([]);
    const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);

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

    const name = label || (identityStatus === 'known' && identityName ? identityName : "Wallet");
    const displayedAddress = identityStatus === 'unknown'
        ? shortenWalletAddress(walletAddress)
        : walletAddress;
    const totalAssetValue = overview?.totalAssetValueUsd ?? null;
    const tradingVolumn = overview?.tradingVolumeUsd24h ?? null;
    const totalPnL = overview?.pnlUsdTotal ?? null;
    const tokenTraded = overview?.tokensTradedCount ?? null;
    const numberOfTokenHolding = overview?.tokensHoldingCount ?? null;

    const [bookmark, setBookmark] = useState(false);
    const [filterOption, setFilterOptions] = useState(OverviewFilterSelection.day);
    const [filterValue, setFilterValue] = useState(1);
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

            if (autoRefresh) {
                const interval = setInterval(loadOverview, refreshInterval);
                return () => clearInterval(interval);
            }
        }
    }, [walletAddress, autoRefresh, refreshInterval, filterOption, customDays]);

    const handleBookmark = () => {
        setBookmark(!bookmark);
        console.log('Bookmark toggled:', !bookmark);
    };

    const handleCreateAlert = () => {
        console.log('Create alert clicked');
    };

    const navigate = useNavigate();

    const handleShare = () => {
        console.log('Share clicked');
    };

    const handleCompare = () => {
        navigate(`/comparision/wallets?wallets=${encodeURIComponent(walletAddress)}`);
    };

    const handleFilterClick = (option: OverviewFilterSelection, value: number) => {
        setFilterOptions(option);
        setFilterValue(value);
        setShowCustomControl(false);
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
    };

    const handleCopyAddress = async () => {
        try {
            await navigator.clipboard.writeText(walletAddress);
        } catch (err) {
            console.error('Failed to copy wallet address:', err);
        }
    };

    const statRows = [
        {
            id: 'totalAssetValue',
            label: tr('wallet.totalAssetValue'),
            value: fmt.num.currency(totalAssetValue !== null ? parseFloat(totalAssetValue.toFixed(6)) : null),
            style: styles.statValue,
        },
        {
            id: 'tradingVolume',
            label: tr('wallet.tradingVolume'),
            value: fmt.num.currency(tradingVolumn !== null ? parseFloat(tradingVolumn.toFixed(6)) : null),
            style: styles.statValue,
        },
        {
            id: 'totalPnL',
            label: tr('wallet.totalPnL'),
            value: fmt.num.currency(totalPnL !== null ? parseFloat(totalPnL.toFixed(6)) : null),
            style: totalPnL >= 0 ? styles.statValuePositive : styles.statValueNegative,
        },
        {
            id: 'tokensTraded',
            label: tr('wallet.tokensTraded'),
            value: fmt.num.decimal(tokenTraded),
            style: styles.statValue,
        },
        {
            id: 'tokensHolding',
            label: tr('wallet.tokensHolding'),
            value: fmt.num.decimal(numberOfTokenHolding),
            style: styles.statValue,
        },
    ];

    return (
        <>
            <div className={styles.walletOverview}>
                {error && (
                    <div className={styles.errorBanner}>
                        {tr('common.error')}: {error}
                    </div>
                )}
                {loading && (
                    <div className={styles.loadingBanner}>
                        {tr('common.loading')}...
                    </div>
                )}

                {/* Header: avatar, name, address, tags */}
                <div className={styles.headerSection}>
                    <div className={styles.profileRow}>
                        <div className={styles.profilePicture}>
                            {name.charAt(0)}
                        </div>
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
                                <h4 className={styles.walletAddress}>
                                    {displayedAddress}
                                </h4>
                                <CopyButton onClick={handleCopyAddress} />
                            </div>
                        </div>
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

                {/* Actions: filter buttons + utility links */}
                <div className={styles.actionsSection}>
                    <div className={styles.filterButtons}>
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
                        <button
                            className={`${styles.filterButton} ${filterOption === OverviewFilterSelection.week ? styles.active : ''}`}
                            onClick={() => handleFilterClick(OverviewFilterSelection.week, 7)}
                        >
                            {tr('wallet.filter7d')}
                        </button>
                        <button
                            className={`${styles.filterButton} ${filterOption === OverviewFilterSelection.day ? styles.active : ''}`}
                            onClick={() => handleFilterClick(OverviewFilterSelection.day, 1)}
                        >
                            {tr('wallet.filter24h')}
                        </button>
                    </div>
                    <div className={styles.utilityButtons}>
                        <Link onClick={handleBookmark}
                            renderIcon={bookmark ? BookmarkFilled : Bookmark}>
                            {bookmark ? tr('wallet.bookmarked') : tr('wallet.bookmarkWallet')}
                        </Link>
                        <Link onClick={handleCreateAlert} renderIcon={Notification}>
                            {tr('wallet.createAlert')}
                        </Link>
                        <Link onClick={handleCompare} renderIcon={Repeat}>
                            {tr('wallet.compareWallet')}
                        </Link>
                        <Link onClick={handleShare} renderIcon={Share}>
                            {tr('wallet.shareWallet')}
                        </Link>
                    </div>
                </div>

                {/* Stats rows (vertical, like TokenOverviewStats) */}
                <div className={styles.statsSection}>
                    {statRows.map((row) => (
                        <div key={row.id} className={styles.statRow}>
                            <span className={styles.statLabel}>{row.label}</span>
                            <span className={row.style}>{row.value}</span>
                        </div>
                    ))}
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
};

export default WalletOverview;
