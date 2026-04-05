/**
 * Tests for wallet-portfolio-mapper
 *
 * Covers:
 *  - resolveTokenLabel fallback chain
 *  - mapPortfolioItems numeric column preservation
 *  - mapPortfolioItems missing logoUri handling
 *  - buildPortfolioMetaMap lookup correctness
 */

import { describe, it, expect } from 'vitest';
import {
    resolveTokenLabel,
    mapPortfolioItems,
    buildPortfolioMetaMap,
} from './wallet-portfolio-mapper';
import type { WalletPortfolioItem } from '@/services/wallet/walletApi';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeItem(overrides: Partial<WalletPortfolioItem> = {}): WalletPortfolioItem {
    return {
        tokenAddress: 'TokenAddress1234567890',
        symbol: 'SOL',
        name: 'Solana',
        logoUri: 'https://cdn.example.com/sol.png',
        amount: 10,
        priceUsd: 150,
        valueUsd: 1500,
        change24hPercent: 5,
        ...overrides,
    };
}

// ─── resolveTokenLabel ────────────────────────────────────────────────────────

describe('resolveTokenLabel', () => {
    it('returns symbol when present', () => {
        expect(resolveTokenLabel(makeItem({ symbol: 'SOL' }))).toBe('SOL');
    });

    it('returns Wrapped SOL when tokenAddress is canonical WSOL mint', () => {
        expect(
            resolveTokenLabel(
                makeItem({
                    tokenAddress: 'So11111111111111111111111111111111111111112',
                    symbol: 'SOL',
                    name: 'Solana',
                }),
            ),
        ).toBe('Wrapped SOL');
    });

    it('returns SOL when tokenAddress is native alias mint', () => {
        expect(
            resolveTokenLabel(
                makeItem({
                    tokenAddress: 'So11111111111111111111111111111111111111111',
                    symbol: 'SOL',
                    name: 'Solana',
                }),
            ),
        ).toBe('SOL');
    });

    it('falls back to name when symbol is empty', () => {
        expect(resolveTokenLabel(makeItem({ symbol: '' }))).toBe('Solana');
    });

    it('falls back to name when symbol is whitespace', () => {
        expect(resolveTokenLabel(makeItem({ symbol: '   ' }))).toBe('Solana');
    });

    it('falls back to shortened tokenAddress when symbol and name are absent', () => {
        const addr = 'TokenXYZ123456789';
        const label = resolveTokenLabel(
            makeItem({ symbol: '', name: '', tokenAddress: addr }),
        );
        expect(label).toBe(`${addr.slice(0, 4)}\u2026${addr.slice(-4)}`);
    });

    it('uses full address when it is ≤ 8 chars long', () => {
        expect(resolveTokenLabel(makeItem({ symbol: '', name: '', tokenAddress: 'SHORT' }))).toBe('SHORT');
    });

    it('returns "Unknown" when all fields are absent', () => {
        expect(
            resolveTokenLabel({ symbol: '', name: undefined, tokenAddress: '' }),
        ).toBe('Unknown');
    });
});

// ─── mapPortfolioItems ────────────────────────────────────────────────────────

describe('mapPortfolioItems', () => {
    it('produces the correct number of rows', () => {
        const items = [makeItem(), makeItem({ symbol: 'USDC', tokenAddress: 'EP...' })];
        const { rows } = mapPortfolioItems(items);
        expect(rows).toHaveLength(2);
    });

    it('column 0 contains the resolved label', () => {
        const { rows } = mapPortfolioItems([makeItem({ symbol: 'SOL' })]);
        expect(rows[0][0]).toBe('SOL');
    });

    it('column 1 (priceUsd) is a number, not a formatted string', () => {
        const { rows } = mapPortfolioItems([makeItem({ priceUsd: 123.45 })]);
        expect(typeof rows[0][1]).toBe('number');
        expect(rows[0][1]).toBe(123.45);
    });

    it('column 2 (amount) is a number', () => {
        const { rows } = mapPortfolioItems([makeItem({ amount: 42.5 })]);
        expect(typeof rows[0][2]).toBe('number');
        expect(rows[0][2]).toBe(42.5);
    });

    it('column 3 (valueUsd) is a number', () => {
        const { rows } = mapPortfolioItems([makeItem({ valueUsd: 6375 })]);
        expect(typeof rows[0][3]).toBe('number');
        expect(rows[0][3]).toBe(6375);
    });

    it('defaults missing numeric fields to 0', () => {
        const { rows } = mapPortfolioItems([
            makeItem({ priceUsd: undefined, amount: 0, valueUsd: 0, change24hPercent: undefined }),
        ]);
        expect(rows[0][1]).toBe(0);
        expect(rows[0][2]).toBe(0);
        expect(rows[0][3]).toBe(0);
        expect(rows[0]).toHaveLength(4);
    });

    it('produces parallel meta with logoUri', () => {
        const uri = 'https://cdn.example.com/sol.png';
        const { meta } = mapPortfolioItems([makeItem({ logoUri: uri })]);
        expect(meta[0].logoUri).toBe(uri);
    });

    it('produces parallel meta with fullName when provided', () => {
        const { meta } = mapPortfolioItems([makeItem({ name: 'Solana' })]);
        expect(meta[0].fullName).toBe('Solana');
    });

    it('sets fullName to undefined when name is absent', () => {
        const { meta } = mapPortfolioItems([makeItem({ name: undefined })]);
        expect(meta[0].fullName).toBeUndefined();
    });

    it('sets logoUri to undefined when absent', () => {
        const { meta } = mapPortfolioItems([makeItem({ logoUri: undefined })]);
        expect(meta[0].logoUri).toBeUndefined();
    });

    it('meta label matches row label', () => {
        const { rows, meta } = mapPortfolioItems([makeItem({ symbol: 'SOL' })]);
        expect(meta[0].label).toBe(rows[0][0]);
    });

    it('handles empty input gracefully', () => {
        const { rows, meta } = mapPortfolioItems([]);
        expect(rows).toHaveLength(0);
        expect(meta).toHaveLength(0);
    });
});

// ─── buildPortfolioMetaMap ────────────────────────────────────────────────────

describe('buildPortfolioMetaMap', () => {
    it('builds a map keyed by label', () => {
        const { meta } = mapPortfolioItems([makeItem({ symbol: 'SOL' })]);
        const map = buildPortfolioMetaMap(meta);
        expect(map.has('SOL')).toBe(true);
        expect(map.get('SOL')?.logoUri).toBe('https://cdn.example.com/sol.png');
    });

    it('first occurrence wins when duplicate labels exist', () => {
        const meta = [
            { label: 'SOL', logoUri: 'first.png', tokenAddress: 'addr1' },
            { label: 'SOL', logoUri: 'second.png', tokenAddress: 'addr2' },
        ];
        const map = buildPortfolioMetaMap(meta);
        expect(map.get('SOL')?.logoUri).toBe('first.png');
    });

    it('returns empty map for empty input', () => {
        expect(buildPortfolioMetaMap([])).toHaveLength(0);
    });
});
