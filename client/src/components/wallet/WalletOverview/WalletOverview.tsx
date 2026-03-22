import React, { useEffect, useState } from 'react';
import { Bookmark, Notification, Share, Repeat, BookmarkFilled, Edit, Tag as TagIcon } from '@carbon/react/icons';
import { CopyButton, Link, Tooltip, Tag } from '@carbon/react';
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

    const name = label || (identityStatus === 'known' && identityName ? identityName : 'Wallet');
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
                    <div style={{ padding: '16px', marginBottom: '16px', backgroundColor: '#ffcccc', borderRadius: '4px', color: '#cc0000' }}>
                        {tr('common.error')}: {error}
                    </div>
                )}
                {loading && (
                    <div style={{ padding: '16px', marginBottom: '16px', backgroundColor: '#e6f2ff', borderRadius: '4px', color: '#0066cc' }}>
                        {tr('common.loading')}...
                    </div>
                )}

                <div className={styles.topSection}>
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
                                <Tag key={index} size="md" type="cyan">
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

                    <div className={styles.actions}>
                        <div className={styles.filterButtons}>
                            {PERIOD_OPTIONS.map((option) => (
                                <button
                                    key={option.key}
                                    className={`${styles.filterButton} ${selectedPeriod === option.key ? styles.active : ''}`}
                                    onClick={() => setSelectedPeriod(option.key)}
                                >
                                    {tr(option.labelKey as WalletOverviewPeriodLabelKey)}
                                </button>
                            ))}
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
                            <Link onClick={handleBookmark} renderIcon={bookmark ? BookmarkFilled : Bookmark}>
                                {bookmark ? tr('wallet.bookmarked') : tr('wallet.bookmarkWallet')}
                            </Link>
                        </div>
                    </div>
                </div>

                <div className={styles.statsSection}>
                    <div className={styles.statsGrid}>
                        <div className={styles.statItem}>
                            <div className={styles.statLabel}>
                                {tr('wallet.totalAssetValue')}
                            </div>
                            <div className={styles.statValue}>
                                {fmt.num.currency(totalAssetValue != null ? parseFloat(totalAssetValue.toFixed(6)) : null)}
                            </div>
                            {assetChange24hPercent != null && (
                                <div className={assetChange24hPercent >= 0 ? styles.statSubValuePositive : styles.statSubValueNegative}>
                                    {tr('wallet.change24hPercent')}: {fmt.num.percent(assetChange24hPercent)}
                                </div>
                            )}
                        </div>

                        <div className={styles.statItem}>
                            <div className={styles.statLabel}>
                                {tr('wallet.tradingVolume')}
                            </div>
                            <div className={styles.statValue}>
                                {fmt.num.currency(tradingVolume != null ? parseFloat(tradingVolume.toFixed(6)) : null)}
                            </div>
                            <div className={styles.statSubValue}>
                                {tr('wallet.buyTransactionCount')}: {fmt.num.decimal(buyTransactionCount)}
                            </div>
                            <div className={styles.statSubValue}>
                                {tr('wallet.buyVolume')}: {fmt.num.currency(buyVolumeUsd)}
                            </div>
                            <div className={styles.statSubValue}>
                                {tr('wallet.sellTransactionCount')}: {fmt.num.decimal(sellTransactionCount)}
                            </div>
                            <div className={styles.statSubValue}>
                                {tr('wallet.sellVolume')}: {fmt.num.currency(sellVolumeUsd)}
                            </div>
                        </div>

                        <div className={styles.statItem}>
                            <div className={styles.statLabel}>
                                {tr('wallet.totalPnL')}
                            </div>
                            <div className={totalPnL != null && totalPnL >= 0 ? styles.statValuePositive : styles.statValueNegative}>
                                {fmt.num.currency(totalPnL != null ? parseFloat(totalPnL.toFixed(6)) : null)}
                            </div>
                            <div className={styles.statSubValue}>
                                {tr('wallet.realizedPnL')}: {fmt.num.currency(pnlRealized)}
                            </div>
                            <div className={styles.statSubValue}>
                                {tr('wallet.unrealizedPnL')}: {fmt.num.currency(pnlUnrealized)}
                            </div>
                        </div>

                        <div className={styles.statItem}>
                            <div className={styles.statLabel}>
                                {tr('wallet.tokensTraded')}
                            </div>
                            <div className={styles.statValue}>
                                {fmt.num.decimal(tokenTraded)}
                            </div>
                        </div>

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
};

export default WalletOverview;
