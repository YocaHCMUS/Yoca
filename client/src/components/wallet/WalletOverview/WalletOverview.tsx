import React, { useEffect, useState, useRef } from 'react';
import { Bookmark, Notification, Share, Repeat, BookmarkFilled, Edit, Tag as TagIcon, Menu } from '@carbon/react/icons';
import { CopyButton, Tooltip, Tag, Select, SelectItem, SkeletonPlaceholder } from '@carbon/react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlist } from '@/contexts/WatchlistContext';
import {
    fetchWalletIntelligence,
    fetchWalletOverview,
    type WalletIdentityAnalysis,
    type WalletIntelligenceResponse,
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

function getFirstFundDisplayLabel(firstFund: WalletIdentityAnalysis['firstFund']): string | null {
    if (!firstFund) {
        return null;
    }

    return firstFund.funderLabel ?? firstFund.funderAddress ?? null;
}

function resolveWalletAgeDays(firstFund: WalletIdentityAnalysis['firstFund']): number | null {
    if (!firstFund) {
        return null;
    }

    if (firstFund.walletAgeDays != null && Number.isFinite(firstFund.walletAgeDays)) {
        return Math.max(0, Math.floor(firstFund.walletAgeDays));
    }

    if (firstFund.firstFundTimestampSec != null && Number.isFinite(firstFund.firstFundTimestampSec)) {
        const elapsedMs = Math.max(0, Date.now() - firstFund.firstFundTimestampSec * 1000);
        return Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
    }

    return null;
}

function formatLocalizedWalletAge(
    ageDays: number,
    units: { day: string; month: string; year: string },
): string {
    const years = Math.floor(ageDays / 365);
    const remainingAfterYears = ageDays % 365;
    const months = Math.floor(remainingAfterYears / 30);
    const days = remainingAfterYears % 30;

    const parts: string[] = [];
    if (years > 0) {
        parts.push(`${years} ${units.year}`);
    }
    if (months > 0) {
        parts.push(`${months} ${units.month}`);
    }
    if (days > 0 && years === 0) {
        parts.push(`${days} ${units.day}`);
    }

    if (parts.length === 0) {
        return `0 ${units.day}`;
    }

    return parts.slice(0, 2).join(' ');
}

export interface WalletOverviewProps {
    walletAddress: string,
    height?: number;
    initialFilters?: Partial<any>;
    autoRefresh?: boolean;
    refreshInterval?: number;
    /** When false, skips GET /wallets/intelligence until enabled (saves heavy API work until needed). */
    enableIntelligence?: boolean;
}
import { PERIOD_OPTIONS } from '@/config/periodOptions';
import WalletOverviewValueSection from './WalletOverviewValueSection';
import WalletOverviewTradingSection from './WalletOverviewTradingSection';
import WalletOverviewPnLSection from './WalletOverviewPnLSection';

export const WalletOverview: React.FC<WalletOverviewProps> = ({
    walletAddress = 'null',
    autoRefresh = true,
    refreshInterval = 30000,
    enableIntelligence = true,
}) => {
    const { user } = useAuth();
    const { walletWatchlist, walletPending, toggleWallet } = useWatchlist();
    const { tr, fmt } = useLocalization();

    const [overview, setOverview] = useState<WalletOverviewMultiPeriodResponse | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<WalletOverviewPeriodKey>('24H');
    const [intelligence, setIntelligence] = useState<WalletIntelligenceResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const labelKey = `wallet-label-${walletAddress}`;
    const [label, setLabel] = useState<string>(() => localStorage.getItem(labelKey) ?? '');
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

    const [tags, setTags] = useState<string[]>([]);
    const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);

    const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false);
    const utilityMenuRef = useRef<HTMLDivElement>(null);

    const isBookmarked = walletWatchlist
        .some((address) => address.toLowerCase() === walletAddress.toLowerCase());
    const isBookmarkPending = Boolean(walletPending[walletAddress]);

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

                const overviewResult = await fetchWalletOverview(walletAddress, 'solana');
                setOverview(overviewResult);
                setSelectedPeriod(overviewResult.selectedPeriod ?? '24H');
            } catch (err) {
                console.error('Failed to fetch wallet overview:', err);
                setError(err instanceof Error ? err.message : 'Failed to load wallet data');
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

    useEffect(() => {
        if (!walletAddress || walletAddress === 'null') {
            return;
        }

        if (!enableIntelligence) {
            setIntelligence(null);
            return;
        }

        const loadIntelligence = async () => {
            try {
                const intelligenceResult = await fetchWalletIntelligence(walletAddress, 'solana');
                setIntelligence(intelligenceResult);
            } catch (err) {
                console.error('Failed to fetch wallet intelligence:', err);
                setIntelligence(null);
            }
        };

        loadIntelligence();

        if (autoRefresh) {
            const interval = setInterval(loadIntelligence, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [walletAddress, enableIntelligence, autoRefresh, refreshInterval]);

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
    const firstFund = intelligence?.analysis?.firstFund ?? null;
    const firstFundAddress = firstFund?.funderAddress ?? null;
    const firstFundLabel = getFirstFundDisplayLabel(firstFund);
    const walletAgeDays = resolveWalletAgeDays(firstFund);
    const walletAgeLabel = walletAgeDays != null
        ? formatLocalizedWalletAge(walletAgeDays, {
            day: String(tr('walletPage.walletAgeUnitDay')),
            month: String(tr('walletPage.walletAgeUnitMonth')),
            year: String(tr('walletPage.walletAgeUnitYear')),
        })
        : null;

    const name = label || (identityStatus === 'known' && identityName ? identityName : tr('walletPage.defaultWalletName'));
    const displayedAddress = identityStatus === 'unknown'
        ? shortenWalletAddress(walletAddress)
        : walletAddress;

    const selectedStats = overview?.periods?.[selectedPeriod] ?? null;
    const holdings = overview?.holdings ?? null;

    const totalAssetValue = holdings?.totalAssetValueUsd ?? overview?.totalAssetValueUsd ?? null;
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
        if (!user || !walletAddress || walletAddress === 'null') {
            return;
        }

        void toggleWallet(walletAddress);
    };

    const handleCreateAlert = () => {
        console.log('Create alert clicked');
    };

    const handleShare = () => {
        console.log('Share clicked');
    };

    const handleCompare = () => {
        window.location.assign(`/comparison/wallets?wallets=${encodeURIComponent(walletAddress)}`);
    };

    const handleOpenFirstFunder = (funderAddress: string) => {
        navigate(`/wallets/${encodeURIComponent(funderAddress)}`);
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
                        {firstFundAddress && firstFundLabel && (
                            <button
                                type="button"
                                className={styles.inlineTagButton}
                                onClick={() => handleOpenFirstFunder(firstFundAddress)}
                                aria-label={`${String(tr('walletPage.openFirstFunderWallet'))} ${firstFundLabel}`}
                            >
                                <Tag size="sm" type="blue" style={{ cursor: 'pointer' }}>
                                    {String(tr('walletPage.firstFunderTag'))}: {firstFundLabel}
                                </Tag>
                            </button>
                        )}
                        {!firstFund && intelligence && (
                            <Tag size="sm" type="cool-gray">
                                {String(tr('walletPage.firstFunderUnavailable'))}
                            </Tag>
                        )}
                        {walletAgeLabel && (
                            <Tag size="sm" type="warm-gray">
                                {String(tr('walletPage.walletAgeTag'))}: {walletAgeLabel}
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
                        <Tooltip label={isBookmarked ? tr('wallet.bookmarked') : tr('wallet.bookmarkWallet')} align="bottom-left">
                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={handleBookmark}
                                aria-label="Bookmark wallet"
                                disabled={!user || isBookmarkPending}
                            >
                                {isBookmarked ? <BookmarkFilled size={20} /> : <Bookmark size={20} />}
                            </button>
                        </Tooltip>
                        <Tooltip label={tr('wallet.createAlert')} align="bottom-left">
                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={handleCreateAlert}
                                aria-label="Create alert"
                            >
                                <Notification size={20} />
                            </button>
                        </Tooltip>
                        <Tooltip label={tr('wallet.compareWallet')} align="bottom-left">
                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={handleCompare}
                                aria-label="Compare wallet"
                            >
                                <Repeat size={20} />
                            </button>
                        </Tooltip>
                        <Tooltip label={tr('wallet.shareWallet')} align="bottom-left">
                            <button
                                type="button"
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
                            type="button"
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
                                    type="button"
                                    className={styles.menuItem}
                                    onClick={() => {
                                        handleBookmark();
                                        setIsUtilityMenuOpen(false);
                                    }}
                                    disabled={!user || isBookmarkPending}
                                >
                                    {isBookmarked ? <BookmarkFilled size={16} /> : <Bookmark size={16} />}
                                    <span>{isBookmarked ? tr('wallet.bookmarked') : tr('wallet.bookmarkWallet')}</span>
                                </button>
                                <button
                                    type="button"
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
                                    type="button"
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
                                    type="button"
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
                                <SelectItem key={option.key} value={option.key} text={tr(option.labelKey)} />
                            ))}
                        </Select>
                    </div>
                </div>

                {/* Stats rows (vertical, like TokenOverviewStats) */}
                <div className={styles.statsSection}>
                    <div className={styles.statColumn}>
                        <WalletOverviewValueSection
                            value={totalAssetValue}
                            unrealizedPnlInPeriod={selectedStats?.pnl?.unrealizedUsd}
                            loading={loading}
                        />
                    </div>

                    <WalletOverviewPnLSection
                        totalPnL={totalPnL}
                        realizedPnL={pnlRealized}
                        unrealizedPnL={pnlUnrealized}
                        loading={loading}
                    />

                    <WalletOverviewTradingSection
                        tradingVolume={tradingVolume}
                        buyTransactionCount={buyTransactionCount}
                        buyTradingVolume={buyVolumeUsd}
                        sellTransactionCount={sellTransactionCount}
                        sellTradingVolume={sellVolumeUsd}
                        loading={loading}
                        tokenAmountTraded={tokenTraded}
                        tokenAmountHolding={numberOfTokenHolding}
                    />


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

