import React, { useEffect, useState, useRef } from 'react';
import { Bookmark, Notification, Share, Repeat, BookmarkFilled, Edit, Tag as TagIcon, Menu } from '@carbon/react/icons';
import { CopyButton, Tooltip, Tag, Select, SelectItem, SkeletonPlaceholder } from '@carbon/react';
import { useLocalization } from '@/contexts/LocalizationContext';
import type { TranslationKeyPath } from '@/config/localization';
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
    loadOnInteractionOnly?: boolean;
}
import { PERIOD_OPTIONS } from '@/config/periodOptions';

export const WalletOverview: React.FC<WalletOverviewProps> = ({
    walletAddress = 'null',
    autoRefresh = true,
    refreshInterval = 30000,
    loadOnInteractionOnly = false,
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
    const [manualLoadCount, setManualLoadCount] = useState(0);

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
        if (loadOnInteractionOnly && manualLoadCount === 0) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        const loadOverview = async () => {
            try {
                setLoading(true);
                setError(null);

                const [overviewResult, intelligenceResult] = await Promise.allSettled([
                    fetchWalletOverview(walletAddress, 'solana'),
                    fetchWalletIntelligence(walletAddress, 'solana'),
                ]);

                if (cancelled) return;

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
                if (cancelled) return;
                console.error('Failed to fetch wallet overview:', err);
                setError(err instanceof Error ? err.message : 'Failed to load wallet data');
                setIntelligence(null);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        if (walletAddress && walletAddress !== 'null') {
            loadOverview();

            const effectiveAutoRefresh = loadOnInteractionOnly ? false : autoRefresh;
            if (effectiveAutoRefresh) {
                const interval = setInterval(loadOverview, refreshInterval);
                return () => { cancelled = true; clearInterval(interval); };
            }
        }

        return () => { cancelled = true; };
    }, [walletAddress, autoRefresh, refreshInterval, loadOnInteractionOnly, manualLoadCount]);

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

    const renderValue = (
        hasValue: boolean,
        formattedValue: React.ReactNode,
        className: string,
        skeletonWidth: string,
        skeletonHeight: string,
    ) => {
        if (hasValue) {
            return <span className={className}>{formattedValue}</span>;
        }

        if (loading) {
            return (
                <div className={styles.valueSkeleton} aria-hidden="true">
                    <SkeletonPlaceholder
                        style={{
                            width: skeletonWidth,
                            height: skeletonHeight,
                            borderRadius: '4px',
                        }}
                    />
                </div>
            );
        }

        return <span className={className}>{formattedValue}</span>;
    };

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
                            onChange={(e) => {
                                setSelectedPeriod(e.target.value as WalletOverviewPeriodKey);
                                if (loadOnInteractionOnly) {
                                    setManualLoadCount((c) => c + 1);
                                }
                            }}
                        >
                            {PERIOD_OPTIONS.map((option) => (
                                <SelectItem key={option.key} value={option.key} text={tr(option.labelKey)} />
                            ))}
                        </Select>
                    </div>
                </div>

                {/* Stats rows (vertical, like TokenOverviewStats) */}
                <div className={styles.statsSection}>
                    <div className={styles.statColumn}>
                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>{tr('wallet.totalAssetValue')}</span>
                            {renderValue(
                                totalAssetValue != null,
                                fmt.num.currency(totalAssetValue != null ? parseFloat(totalAssetValue.toFixed(6)) : null),
                                styles.statValue,
                                '88px',
                                '14px',
                            )}
                        </div>
                        <div className={styles.subStatRow}>
                            <span className={styles.subStatLabel}>{tr('wallet.change24hPercent')}</span>
                            {renderValue(
                                assetChange24hPercent != null,
                                assetChange24hPercent != null
                                    ? fmt.num.percent(assetChange24hPercent)
                                    : '—',
                                assetChange24hPercent != null && assetChange24hPercent >= 0
                                    ? styles.subStatValuePositive
                                    : assetChange24hPercent != null
                                        ? styles.subStatValueNegative
                                        : styles.statValue,
                                '62px',
                                '12px',
                            )}
                        </div>
                    </div>
                    <div className={styles.statColumn}>
                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>{tr('wallet.tradingVolume')}</span>
                            {renderValue(
                                tradingVolume != null,
                                fmt.num.currency(tradingVolume != null ? parseFloat(tradingVolume.toFixed(6)) : null),
                                styles.statValue,
                                '88px',
                                '14px',
                            )}
                        </div>
                        {(buyTransactionCount != null || loading) && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.buyTransactionCount')}</span>
                                {renderValue(
                                    buyTransactionCount != null,
                                    fmt.num.decimal(buyTransactionCount),
                                    styles.subStatValue,
                                    '54px',
                                    '12px',
                                )}
                            </div>
                        )}
                        {(buyVolumeUsd != null || loading) && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.buyVolume')}</span>
                                {renderValue(
                                    buyVolumeUsd != null,
                                    fmt.num.currency(buyVolumeUsd),
                                    styles.subStatValue,
                                    '74px',
                                    '12px',
                                )}
                            </div>
                        )}
                        {(sellTransactionCount != null || loading) && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.sellTransactionCount')}</span>
                                {renderValue(
                                    sellTransactionCount != null,
                                    fmt.num.decimal(sellTransactionCount),
                                    styles.subStatValue,
                                    '54px',
                                    '12px',
                                )}
                            </div>
                        )}
                        {(sellVolumeUsd != null || loading) && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.sellVolume')}</span>
                                {renderValue(
                                    sellVolumeUsd != null,
                                    fmt.num.currency(sellVolumeUsd),
                                    styles.subStatValue,
                                    '74px',
                                    '12px',
                                )}
                            </div>
                        )}
                    </div>
                    <div className={styles.statColumn}>
                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>{tr('wallet.totalPnL')}</span>
                            {renderValue(
                                totalPnL != null,
                                fmt.num.currency(totalPnL != null ? parseFloat(totalPnL.toFixed(6)) : null),
                                totalPnL != null && totalPnL >= 0 ? styles.statValuePositive : styles.statValueNegative,
                                '88px',
                                '14px',
                            )}
                        </div>
                        {(pnlRealized != null || loading) && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.realizedPnL')}</span>
                                {renderValue(
                                    pnlRealized != null,
                                    fmt.num.currency(pnlRealized),
                                    pnlRealized != null && pnlRealized >= 0
                                        ? styles.subStatValuePositive
                                        : styles.subStatValueNegative,
                                    '74px',
                                    '12px',
                                )}
                            </div>
                        )}
                        {(pnlUnrealized != null || loading) && (
                            <div className={styles.subStatRow}>
                                <span className={styles.subStatLabel}>{tr('wallet.unrealizedPnL')}</span>
                                {renderValue(
                                    pnlUnrealized != null,
                                    fmt.num.currency(pnlUnrealized),
                                    pnlUnrealized != null && pnlUnrealized >= 0
                                        ? styles.subStatValuePositive
                                        : styles.subStatValueNegative,
                                    '74px',
                                    '12px',
                                )}
                            </div>
                        )}
                    </div>
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>{tr('wallet.tokensTraded')}</span>
                        {renderValue(
                            tokenTraded != null,
                            fmt.num.decimal(tokenTraded),
                            styles.statValue,
                            '52px',
                            '14px',
                        )}
                    </div>
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>{tr('wallet.tokensHolding')}</span>
                        {renderValue(
                            numberOfTokenHolding != null,
                            fmt.num.decimal(numberOfTokenHolding),
                            styles.statValue,
                            '52px',
                            '14px',
                        )}
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

