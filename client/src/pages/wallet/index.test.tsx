// @vitest-environment jsdom
/**
 * Tests for the Wallet Page (index.tsx)
 *
 * Scope: integration checks for portfolio table data preparation and label
 * fallback behaviour.  Full page rendering is expensive to bootstrap (router,
 * localisation, multiple chart hooks) so these tests exercise the mapper and
 * cell-renderer logic that the page composes, rather than mounting the entire
 * page tree.
 *
 * Full smoke-test of the rendered page is covered by the manual verification
 * checklist in WALLET_PORTFOLIO_PHASE2_FRONTEND_PLAN.md §6.5.
 */

import {
    mapPortfolioItems,
    buildPortfolioMetaMap,
    resolveTokenLabel,
} from '@/util/wallet-portfolio-mapper';
import type { WalletPortfolioItem } from '@/services/wallet/walletApi';
import { describe, it, expect } from 'vitest';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const solItem: WalletPortfolioItem = {
    tokenAddress: 'native',
    symbol: 'SOL',
    name: 'Solana',
    logoUri: 'https://cdn.example.com/sol.png',
    amount: 10,
    priceUsd: 150,
    valueUsd: 1500,
    change24hPercent: 5,
};

const wrappedSolItem: WalletPortfolioItem = {
    tokenAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    logoUri: 'https://cdn.example.com/wsol.png',
    amount: 1,
    priceUsd: 150,
    valueUsd: 150,
    change24hPercent: 2,
};

const unknownItem: WalletPortfolioItem = {
    tokenAddress: 'TokenXYZ123456789',
    symbol: '',
    amount: 200,
    valueUsd: 0,
};

const noMetaItem: WalletPortfolioItem = {
    tokenAddress: '',
    symbol: '',
    amount: 1,
    valueUsd: 10,
};

// ─── Portfolio table data preparation ──────────────────────────────────────────

describe('WalletPage portfolio data preparation', () => {
    describe('label fallback rendering (mixed metadata portfolio)', () => {
        it('shows SOL label for native SOL tokens', () => {
            const { rows } = mapPortfolioItems([solItem]);
            expect(rows[0][0]).toBe('SOL');
        });

        it('shows Wrapped SOL label for WSOL mint tokens', () => {
            const { rows } = mapPortfolioItems([wrappedSolItem]);
            expect(rows[0][0]).toBe('Wrapped SOL');
        });

        it('falls back to shortened tokenAddress for tokens without symbol/name', () => {
            // 'TokenXYZ123456789' → first4='Toke', last4='6789'
            const label = resolveTokenLabel(unknownItem);
            expect(label).toBe('Toke\u20266789');
        });

        it('returns "Unknown" when all identification fields are absent', () => {
            expect(resolveTokenLabel(noMetaItem)).toBe('Unknown');
        });
    });

    describe('numeric column stability for sorting', () => {
        it('price column (1) is numeric', () => {
            const { rows } = mapPortfolioItems([solItem]);
            expect(typeof rows[0][1]).toBe('number');
            expect(rows[0][1]).toBe(150);
        });

        it('amount column (2) is numeric', () => {
            const { rows } = mapPortfolioItems([solItem]);
            expect(typeof rows[0][2]).toBe('number');
            expect(rows[0][2]).toBe(10);
        });

        it('value column (3) is numeric', () => {
            const { rows } = mapPortfolioItems([solItem]);
            expect(typeof rows[0][3]).toBe('number');
            expect(rows[0][3]).toBe(1500);
            expect(rows[0]).toHaveLength(4);
        });
    });

    describe('filtering - empty portfolio', () => {
        it('produces empty arrays for an empty portfolio', () => {
            const { rows, meta } = mapPortfolioItems([]);
            expect(rows).toHaveLength(0);
            expect(meta).toHaveLength(0);
        });
    });

    describe('logo URI availability in meta map', () => {
        it('metaMap returns logoUri for enriched tokens', () => {
            const { meta } = mapPortfolioItems([solItem]);
            const map = buildPortfolioMetaMap(meta);
            expect(map.get('SOL')?.logoUri).toBe('https://cdn.example.com/sol.png');
        });

        it('metaMap returns undefined logoUri for unenriched tokens', () => {
            const { meta } = mapPortfolioItems([unknownItem]);
            const map = buildPortfolioMetaMap(meta);
            const label = resolveTokenLabel(unknownItem);
            expect(map.get(label)?.logoUri).toBeUndefined();
        });

        it('missing logoUri does not break row rendering (no exception)', () => {
            expect(() => mapPortfolioItems([noMetaItem])).not.toThrow();
        });
    });
});
