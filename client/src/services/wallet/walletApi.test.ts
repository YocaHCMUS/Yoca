/**
 * Tests for walletApi service
 *
 * Focuses on:
 *  - WalletPortfolioItem interface compatibility (optional field contracts)
 *  - Legacy payload shapes (without logoUri) remain assignable
 *  - Typed return contract of fetchWalletPortfolio
 */

import { describe, it, expect } from 'vitest';
import type {
    WalletPortfolioItem,
    WalletTransfer,
    WalletSwapBalanceChange,
} from './walletApi';

// ─── WalletPortfolioItem interface contract ───────────────────────────────────

describe('WalletPortfolioItem', () => {
    it('accepts a fully-enriched item with all optional fields', () => {
        const item: WalletPortfolioItem = {
            tokenAddress: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Solana',
            logoUri: 'https://cdn.example.com/sol.png',
            amount: 10,
            priceUsd: 150,
            valueUsd: 1500,
            change24hPercent: 5,
        };
        expect(item.symbol).toBe('SOL');
        expect(item.logoUri).toBe('https://cdn.example.com/sol.png');
    });

    it('accepts a legacy item without optional additive metadata', () => {
        // Legacy payloads from before Phase 1 enrichment won't have logoUri / name / priceUsd
        const item: WalletPortfolioItem = {
            tokenAddress: 'TokenXYZ',
            symbol: 'XYZ',
            amount: 100,
            valueUsd: 0,
        };
        expect(item.logoUri).toBeUndefined();
        expect(item.name).toBeUndefined();
        expect(item.priceUsd).toBeUndefined();
        expect(item.change24hPercent).toBeUndefined();
    });

    it('logoUri is optional – not present on partially enriched items', () => {
        const item: WalletPortfolioItem = {
            tokenAddress: 'TokenABC',
            symbol: 'ABC',
            name: 'Abc Token',
            amount: 50,
            valueUsd: 250,
        };
        expect(item.logoUri).toBeUndefined();
    });

    it('symbol is a required string field', () => {
        const item: WalletPortfolioItem = {
            tokenAddress: 'TokenDEF',
            symbol: '',
            amount: 0,
            valueUsd: 0,
        };
        // Empty string is valid (symbol may be unavailable from provider)
        expect(typeof item.symbol).toBe('string');
    });

    it('tokenAddress is always present', () => {
        const items: WalletPortfolioItem[] = [
            { tokenAddress: 'addr1', symbol: 'T1', amount: 1, valueUsd: 1 },
            { tokenAddress: 'addr2', symbol: 'T2', amount: 2, valueUsd: 2 },
        ];
        for (const item of items) {
            expect(item.tokenAddress).toBeTruthy();
        }
    });

    it('can be used in an array (matches fetchWalletPortfolio return shape)', () => {
        const portfolio: WalletPortfolioItem[] = [
            {
                tokenAddress: 'So11111111111111111111111111111111111111112',
                symbol: 'SOL',
                name: 'Solana',
                logoUri: 'https://cdn.example.com/sol.png',
                amount: 5,
                priceUsd: 150,
                valueUsd: 750,
                change24hPercent: -2.5,
            },
            {
                tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                symbol: 'USDC',
                amount: 1000,
                valueUsd: 1000,
            },
        ];
        expect(Array.isArray(portfolio)).toBe(true);
        expect(portfolio).toHaveLength(2);
        expect(portfolio[0].logoUri).toBeDefined();
        expect(portfolio[1].logoUri).toBeUndefined();
    });
});

describe('WalletTransfer', () => {
    it('accepts additive identity and USD fields', () => {
        const transfer: WalletTransfer = {
            from: 'wallet-a',
            to: 'wallet-b',
            amount: 2,
            amountUsd: 240,
            timestamp: '2026-03-19T12:00:00.000Z',
            tokenAddress: 'So11111111111111111111111111111111111111112',
            tokenSymbol: 'SOL',
            tokenName: 'Solana',
            tokenLogoUri: 'https://cdn.example.com/sol.png',
            priceUsd: 120,
            transactionSignature: 'sig-1',
            instructionIndex: 0,
        };

        expect(transfer.tokenName).toBe('Solana');
        expect(transfer.tokenLogoUri).toContain('sol.png');
        expect(transfer.amountUsd).toBe(240);
        expect(transfer.priceUsd).toBe(120);
    });

    it('keeps legacy transfer payloads assignable', () => {
        const legacyTransfer: WalletTransfer = {
            from: 'wallet-a',
            to: 'wallet-b',
            amount: 1,
            timestamp: '2026-03-19T12:00:00.000Z',
            tokenAddress: 'mint-1',
            tokenSymbol: 'UNK',
            transactionSignature: 'legacy-sig',
            instructionIndex: 0,
        };

        expect(legacyTransfer.tokenName).toBeUndefined();
        expect(legacyTransfer.tokenLogoUri).toBeUndefined();
        expect(legacyTransfer.amountUsd).toBeUndefined();
        expect(legacyTransfer.priceUsd).toBeUndefined();
    });
});

describe('WalletSwapBalanceChange', () => {
    it('accepts additive token identity fields', () => {
        const leg: WalletSwapBalanceChange = {
            mint: 'So11111111111111111111111111111111111111112',
            amount: -1,
            decimals: 9,
            symbol: 'SOL',
            name: 'Solana',
            logoUri: 'https://cdn.example.com/sol.png',
            priceUsd: 120,
            valueUsd: 120,
        };

        expect(leg.symbol).toBe('SOL');
        expect(leg.name).toBe('Solana');
        expect(leg.logoUri).toContain('sol.png');
    });

    it('keeps legacy swap leg payloads assignable', () => {
        const legacyLeg: WalletSwapBalanceChange = {
            mint: 'mint-legacy',
            amount: 10,
            decimals: 6,
        };

        expect(legacyLeg.name).toBeUndefined();
        expect(legacyLeg.logoUri).toBeUndefined();
        expect(legacyLeg.priceUsd).toBeUndefined();
        expect(legacyLeg.valueUsd).toBeUndefined();
    });
});
