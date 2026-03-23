import React, { useEffect, useState, useRef } from 'react';
import { Bookmark, Notification, Share, Repeat, BookmarkFilled, Edit, Tag as TagIcon, Menu } from '@carbon/react/icons';
import { CopyButton, Tooltip, Tag, Select, SelectItem } from '@carbon/react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useAuth } from '@/contexts/AuthContext';
import {
    fetchWalletIntelligence,
    fetchWalletOverview,
    type WalletOverviewMultiPeriodResponse,
    type WalletOverviewPeriodKey,
} from '@/services/wallet/walletApi';
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

export interface WalletOverviewProps {
    walletAddress: string,
    height?: number;
    initialFilters?: Partial<any>;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

const PERIOD_OPTIONS: Array<{ key: WalletOverviewPeriodKey; labelKey: string }> = [
    { key: '24H', labelKey: 'wallet.filter24h' },
    { key: '7D', labelKey: 'wallet.filter7d' },
    { key: '30D', labelKey: 'wallet.filter30d' },
    { key: '90D', labelKey: 'wallet.filter90d' },
    { key: 'All', labelKey: 'wallet.filterAll' },
];

type WalletOverviewPeriodLabelKey =
    | 'wallet.filter24h'
    | 'wallet.filter7d'
    | 'wallet.filter30d'
    | 'wallet.filter90d'
    | 'wallet.filterAll';

export const WalletOverview: React.FC<WalletOverviewProps> = ({
    walletAddress = 'null',
    autoRefresh = true,
    refreshInterval = 30000,
}) => {
    const { user } = useAuth();
    const { tr, fmt } = useLocalization();

    const [overview, setOverview] = useState<WalletOverviewMultiPeriodResponse | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<WalletOverviewPeriodKey>('24H');
    const [intelligence, setIntelligence] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const labelKey = `wallet-label-${walletAddress}`;
    const [label, setLabel] = useState<string>(() => localStorage.getItem(labelKey) ?? '');
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

    const [tags, setTags] = useState<string[]>([]);
    const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);

    const [bookmark, setBookmark] = useState(false);
    const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false);
    const utilityMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (utilityMenuRef.current && !utilityMenuRef.current.contains(event.target as Node)) {
                setIsUtilityMenuOpen(false);
            }
        };

        if (isUtilityMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isUtilityMenuOpen]);

    useEffect(() => {
        if (!user || !walletAddress || walletAddress === 'null') {
            setTags([]);
            return;
        }
        fetchWalletTags(walletAddress)
            .then(setTags)
            .catch((err) => console.error('[WalletOverview] Failed to load tags:', err));
    }, [user, walletAddress]);

    useEffect(() => {
        const loadOverview = async () => {
            try {
                setLoading(true);
                setError(null);

                const [overviewResult, intelligenceResult] = await Promise.allSettled([
                    fetchWalletOverview(walletAddress, 'solana'),
                    fetchWalletIntelligence(walletAddress, 'solana'),
                ]);

                if (overviewResult.status === 'rejected') {
                    throw overviewResult.reason;
                }

                setOverview(overviewResult.value);
                setSelectedPeriod(overviewResult.value.selectedPeriod ?? '24H');

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
    }, [walletAddress, autoRefresh, refreshInterval]);

    const handleLabelSave = (newLabel: string) => {
        setLabel(newLabel);
        if (newLabel) {
            localStorage.setItem(labelKey, newLabel);
        } else {
            localStorage.removeItem(labelKey);
        }
    };

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

    const name = label || (identityStatus === 'known' && identityName ? identityName : tr('walletPage.defaultWalletName'));
    const displayedAddress = identityStatus === 'unknown'
        ? shortenWalletAddress(walletAddress)
        : walletAddress;

    const selectedStats = overview?.periods?.[selectedPeriod] ?? null;
    const holdings = overview?.holdings ?? null;

    const totalAssetValue = holdings?.totalAssetValueUsd ?? overview?.totalAssetValueUsd ?? null;
    const assetChange24hPercent = holdings?.change24hPercent ?? null;
    const tradingVolume = selectedStats?.tradingVolumeUsd ?? overview?.tradingVolumeUsd24h ?? null;
    const totalPnL = selectedStats?.pnl?.totalUsd ?? overview?.pnlUsdTotal ?? null;
    const tokenTraded = selectedStats?.tokensTradedCount ?? overview?.tokensTradedCount ?? null;
    const numberOfTokenHolding = holdings?.tokensHoldingCount ?? overview?.tokensHoldingCount ?? null;
    const buyTransactionCount = selectedStats?.buy?.transactionCount ?? null;
    const buyVolumeUsd = selectedStats?.buy?.volumeUsd ?? null;
    const sellTransactionCount = selectedStats?.sell?.transactionCount ?? null;
    const sellVolumeUsd = selectedStats?.sell?.volumeUsd ?? null;
    const pnlRealized = selectedStats?.pnl?.realizedUsd ?? null;
    const pnlUnrealized = selectedStats?.pnl?.unrealizedUsd ?? null;

    const navigate = useNavigate();

    const handleCopyAddress = async () => {
        try {
            await navigator.clipboard.writeText(walletAddress);
        } catch (err) {
            console.error('Failed to copy wallet address:', err);
        }
    };

    const handleBookmark = () => {
        setBookmark(!bookmark);
        console.log('Bookmark toggled:', !bookmark);
    };

    const handleCreateAlert = () => {
        console.log('Create alert clicked');
    };

    const handleShare = () => {
        console.log('Share clicked');
    };

    const handleCompare = () => {
        navigate(`/comparision/wallets?wallets=${encodeURIComponent(walletAddress)}`);
    };

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
                                {tr('walletPage.unknownEntity')}
                            </Tag>
                        )}
                        {identityStatus === 'unavailable' && (
                            <Tag size="sm" type="red">
                                {tr('walletPage.identityUnavailable')}
                            </Tag>
                        )}
                        {/* unreliable data */}
                        {/* {riskLevel && (
                            <Tag size="sm" type={getRiskTagType(riskLevel)}>
                                Risk: {String(riskLevel).toUpperCase()}
                            </Tag>
                        )} */}
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
                            label={user ? tr('walletPage.manageTagsLabel') : tr('walletPage.signInManageTagsLabel')}
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

                {/* Actions: filter dropdown + utility icon buttons (default) / menu (mini) */}
                <div className={styles.actionsSection}>
                    <div className={styles.utilityButtonsDefault}>
                        <Tooltip label={bookmark ? tr('wallet.bookmarked') : tr('wallet.bookmarkWallet')} align="bottom-left">
                            <button
                                className={styles.iconButton}
                                onClick={handleBookmark}
                                aria-label="Bookmark wallet"
                            >
                                {bookmark ? <BookmarkFilled size={20} /> : <Bookmark size={20} />}
                            </button>
                        </Tooltip>
                        <Tooltip label={tr('wallet.createAlert')} align="bottom-left">
                            <button
                                className={styles.iconButton}
                                onClick={handleCreateAlert}
                                aria-label="Create alert"
                            >
                                <Notification size={20} />
                            </button>
                        </Tooltip>
                        <Tooltip label={tr('wallet.compareWallet')} align="bottom-left">
                            <button
                                className={styles.iconButton}
                                onClick={handleCompare}
                                aria-label="Compare wallet"
                            >
                                <Repeat size={20} />
                            </button>
                        </Tooltip>
                        <Tooltip label={tr('wallet.shareWallet')} align="bottom-left">
                            <button
                                className={styles.iconButton}
                                onClick={handleShare}
                                aria-label="Share wallet"
                            >
                                <Share size={20} />
                            </button>
                        </Tooltip>
                    </div>

                    <div className={styles.utilityButtonsMini} ref={utilityMenuRef}>
                        <button
                            className={styles.menuTrigger}
                            onClick={() => setIsUtilityMenuOpen(!isUtilityMenuOpen)}
                            aria-label="More options"
                            aria-expanded={isUtilityMenuOpen}
                        >
                            <Menu size={20} />
                        </button>
                        {isUtilityMenuOpen && (
                            <div className={styles.dropdownMenu}>
                                <button
                                    className={styles.menuItem}
                                    onClick={() => {
                                        handleBookmark();
                                        setIsUtilityMenuOpen(false);
                                    }}
                                >
                                    {bookmark ? <BookmarkFilled size={16} /> : <Bookmark size={16} />}
                                    <span>{bookmark ? tr('wallet.bookmarked') : tr('wallet.bookmarkWallet')}</span>
                                </button>
                                <button
                                    className={styles.menuItem}
                                    onClick={() => {
                                        handleCreateAlert();
                                        setIsUtilityMenuOpen(false);
                                    }}
                                >
                                    <Notification size={16} />
                                    <span>{tr('wallet.createAlert')}</span>
                                </button>
                                <button
                                    className={styles.menuItem}
                                    onClick={() => {
                                        handleCompare();
                                        setIsUtilityMenuOpen(false);
                                    }}
                                >
                                    <Repeat size={16} />
                                    <span>{tr('wallet.compareWallet')}</span>
                                </button>
                                <button
                                    className={styles.menuItem}
                                    onClick={() => {
                                        handleShare();
                                        setIsUtilityMenuOpen(false);
                                    }}
                                >
                                    <Share size={16} />
                                    <span>{tr('wallet.shareWallet')}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={styles.filterGroup}>
                        <Select
                            hideLabel={true}
                            id="period-select"
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value as WalletOverviewPeriodKey)}
                        >
                            {PERIOD_OPTIONS.map((option) => (
                                <SelectItem key={option.key} value={option.key} text={tr(option.labelKey as WalletOverviewPeriodLabelKey)} />
                            ))}
                        </Select>
                    </div>
                </div>

                {/* Stats rows (vertical, like TokenOverviewStats) */}
                <div className={styles.statsSection}>
                    <div className={styles.statColumn}>
                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>{tr('wallet.totalAssetValue')}</span>
                            <span className={styles.statValue}>
                                {fmt.num.currency(totalAssetValue != null ? parseFloat(totalAssetValue.toFixed(6)) : null)}
                            </span>
                        </div>
                        {assetChange24hPercent != null && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.change24hPercent')}</span>
                                <span className={assetChange24hPercent >= 0 ? styles.subStatValuePositive : styles.subStatValueNegative}>
                                    {fmt.num.percent(assetChange24hPercent)}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className={styles.statColumn}>
                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>{tr('wallet.tradingVolume')}</span>
                            <span className={styles.statValue}>
                                {fmt.num.currency(tradingVolume != null ? parseFloat(tradingVolume.toFixed(6)) : null)}
                            </span>
                        </div>
                        {buyTransactionCount != null && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.buyTransactionCount')}</span>
                                <span className={styles.subStatValue}>
                                    {fmt.num.decimal(buyTransactionCount)}
                                </span>
                            </div>
                        )}
                        {buyVolumeUsd != null && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.buyVolume')}</span>
                                <span className={styles.subStatValue}>
                                    {fmt.num.currency(buyVolumeUsd)}
                                </span>
                            </div>
                        )}
                        {sellTransactionCount != null && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.sellTransactionCount')}</span>
                                <span className={styles.subStatValue}>
                                    {fmt.num.decimal(sellTransactionCount)}
                                </span>
                            </div>
                        )}
                        {sellVolumeUsd != null && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.sellVolume')}</span>
                                <span className={styles.subStatValue}>
                                    {fmt.num.currency(sellVolumeUsd)}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className={styles.statColumn}>
                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>{tr('wallet.totalPnL')}</span>
                            <span className={totalPnL != null && totalPnL >= 0 ? styles.statValuePositive : styles.statValueNegative}>
                                {fmt.num.currency(totalPnL != null ? parseFloat(totalPnL.toFixed(6)) : null)}
                            </span>
                        </div>
                        {pnlRealized != null && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.realizedPnL')}</span>
                                <span className={pnlRealized >= 0 ? styles.subStatValuePositive : styles.subStatValueNegative}>
                                    {fmt.num.currency(pnlRealized)}
                                </span>
                            </div>
                        )}
                        {pnlUnrealized != null && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.unrealizedPnL')}</span>
                                <span className={pnlUnrealized >= 0 ? styles.subStatValuePositive : styles.subStatValueNegative}>
                                    {fmt.num.currency(pnlUnrealized)}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>{tr('wallet.tokensTraded')}</span>
                        <span className={styles.statValue}>
                            {fmt.num.decimal(tokenTraded)}
                        </span>
                    </div>
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>{tr('wallet.tokensHolding')}</span>
                        <span className={styles.statValue}>
                            {fmt.num.decimal(numberOfTokenHolding)}
                        </span>
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
};

export default WalletOverview;

