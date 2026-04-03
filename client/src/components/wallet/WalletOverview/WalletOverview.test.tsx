import type { ReactNode, SelectHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    fetchWalletOverview: vi.fn(),
    fetchWalletIntelligence: vi.fn(),
    fetchWalletTags: vi.fn(),
}));

vi.mock('react-router', async () => {
    const actual = await vi.importActual<typeof import('react-router')>('react-router');
    return {
        ...actual,
        useNavigate: () => mocks.navigate,
    };
});

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ user: null }),
}));

vi.mock('@/contexts/LocalizationContext', () => ({
    useLocalization: () => ({
        tr: (key: string) => key,
        fmt: {
            num: {
                currency: (value: number | null) => (value == null ? '—' : `$${value.toFixed(2)}`),
                percent: (value: number | null) => (value == null ? '—' : `${value.toFixed(2)}%`),
                decimal: (value: number | null) => String(value ?? '—'),
                compact: {
                    currency: (value: number | null) => (value == null ? '—' : `$${value.toFixed(2)}`),
                },
            },
        },
    }),
}));

vi.mock('@/services/wallet/walletApi', () => ({
    fetchWalletOverview: mocks.fetchWalletOverview,
    fetchWalletIntelligence: mocks.fetchWalletIntelligence,
}));

vi.mock('@/services/wallet/walletTagsApi', () => ({
    fetchWalletTags: mocks.fetchWalletTags,
    saveWalletTags: vi.fn(),
}));

vi.mock('@/components/wallet/WalletLabelModal/WalletLabelModal', () => ({
    WalletLabelModal: () => null,
}));

vi.mock('@/components/wallet/WalletTagsModal/WalletTagsModal', () => ({
    WalletTagsModal: () => null,
}));

vi.mock('@carbon/react', () => ({
    CopyButton: ({ onClick }: { onClick?: () => void }) => (
        <button type="button" onClick={onClick}>copy</button>
    ),
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
    Tag: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Select: ({ children, hideLabel: _hideLabel, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { hideLabel?: boolean }) => (
        <select {...props}>{children}</select>
    ),
    SelectItem: ({ value, text }: { value: string; text: string }) => (
        <option value={value}>{text}</option>
    ),
    SkeletonPlaceholder: () => <div />,
}));

vi.mock('@carbon/react/icons', () => ({
    Bookmark: () => <span />,
    BookmarkFilled: () => <span />,
    Edit: () => <span />,
    Menu: () => <span />,
    Notification: () => <span />,
    Repeat: () => <span />,
    Share: () => <span />,
    Tag: () => <span />,
}));

import { WalletOverview } from './WalletOverview';

afterEach(() => {
    vi.clearAllMocks();
});

describe('WalletOverview first-fund tags', () => {
    it('renders the first-funder tag and navigates to the funder wallet on click', async () => {
        mocks.fetchWalletOverview.mockResolvedValue({
            address: 'TargetWallet1111111111111111111111111111111111',
            availablePeriods: ['24H'],
            selectedPeriod: '24H',
            holdings: {
                totalAssetValueUsd: 0,
                change24hPercent: null,
                tokensHoldingCount: 0,
                source: 'overview-cache',
            },
            periods: {
                '24H': {
                    tradingVolumeUsd: null,
                    buy: { transactionCount: null, volumeUsd: null },
                    sell: { transactionCount: null, volumeUsd: null },
                    tokensTradedCount: null,
                    transactionCount: null,
                    pnl: { totalUsd: null, realizedUsd: null, unrealizedUsd: null },
                    source: 'none',
                },
                '7D': {
                    tradingVolumeUsd: null,
                    buy: { transactionCount: null, volumeUsd: null },
                    sell: { transactionCount: null, volumeUsd: null },
                    tokensTradedCount: null,
                    transactionCount: null,
                    pnl: { totalUsd: null, realizedUsd: null, unrealizedUsd: null },
                    source: 'none',
                },
                '30D': {
                    tradingVolumeUsd: null,
                    buy: { transactionCount: null, volumeUsd: null },
                    sell: { transactionCount: null, volumeUsd: null },
                    tokensTradedCount: null,
                    transactionCount: null,
                    pnl: { totalUsd: null, realizedUsd: null, unrealizedUsd: null },
                    source: 'none',
                },
                '90D': {
                    tradingVolumeUsd: null,
                    buy: { transactionCount: null, volumeUsd: null },
                    sell: { transactionCount: null, volumeUsd: null },
                    tokensTradedCount: null,
                    transactionCount: null,
                    pnl: { totalUsd: null, realizedUsd: null, unrealizedUsd: null },
                    source: 'none',
                },
                All: {
                    tradingVolumeUsd: null,
                    buy: { transactionCount: null, volumeUsd: null },
                    sell: { transactionCount: null, volumeUsd: null },
                    tokensTradedCount: null,
                    transactionCount: null,
                    pnl: { totalUsd: null, realizedUsd: null, unrealizedUsd: null },
                    source: 'none',
                },
            },
            legacy: {
                totalAssetValueUsd: 0,
                tradingVolumeUsd24h: null,
                pnlUsdTotal: null,
                transactionCount24h: null,
                tokensTradedCount: null,
                tokensHoldingCount: 0,
                metricsPeriod: '24H',
            },
            totalAssetValueUsd: 0,
            tradingVolumeUsd24h: null,
            pnlUsdTotal: null,
            transactionCount24h: null,
            tokensTradedCount: null,
            tokensHoldingCount: 0,
        });
        mocks.fetchWalletIntelligence.mockResolvedValue({
            address: 'TargetWallet1111111111111111111111111111111111',
            identity: {
                status: 'known',
                type: 'team',
                name: 'Target Wallet',
                category: 'wallet',
                tags: [],
                domainNames: [],
                provider: 'helius',
                providerVersion: 'wallet-api-beta',
                resolvedAt: new Date().toISOString(),
            },
            analysis: {
                riskScore: 22,
                riskLevel: 'low',
                signals: ['known_entity'],
                counterpartyProfile: {
                    exchangeInteractions24h: 0,
                    uniqueKnownEntities7d: 0,
                },
                firstFund: {
                    targetAddress: 'TargetWallet1111111111111111111111111111111111',
                    funderAddress: 'FunderWallet111111111111111111111111111111111',
                    funderName: 'Alpha Fund',
                    funderType: 'team',
                    funderLabel: 'Alpha Fund',
                    firstFundDate: '2024-01-01T00:00:00.000Z',
                    firstFundTimestampSec: 1704067200,
                    walletAgeDays: 400,
                    walletAgeLabel: '1y 1m',
                    signature: 'sig-123',
                },
            },
            metadata: {
                cache: {
                    identityHit: true,
                    analysisHit: true,
                    ttlSec: 60,
                    staleIdentity: false,
                },
                provider: {},
            },
        });
        mocks.fetchWalletTags.mockResolvedValue([]);

        render(<WalletOverview walletAddress="TargetWallet1111111111111111111111111111111111" autoRefresh={false} />);

        const funderButton = await screen.findByRole('button', { name: /open first funder wallet alpha fund/i });
        expect(screen.getByText('First funder: Alpha Fund')).toBeInTheDocument();
        expect(screen.getByText('Wallet age: 1y 1m')).toBeInTheDocument();

        fireEvent.click(funderButton);

        expect(mocks.navigate).toHaveBeenCalledWith('/wallets/FunderWallet111111111111111111111111111111111');
    });
});