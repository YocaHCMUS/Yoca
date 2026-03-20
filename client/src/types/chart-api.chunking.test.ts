import { describe, expect, it } from 'vitest';
import type {
    BalanceRequestParams,
    BalanceTrendResponse,
    PnLChartResponse,
    PnLRequestParams,
} from './chart-api.types';

describe('chart-api chunking types', () => {
    it('accepts cursor/limit params for balance requests', () => {
        const params: BalanceRequestParams = {
            wallets: 'wallet-1',
            timePeriod: 'All',
            limit: 180,
            cursor: 'opaque-cursor',
        };

        expect(params.limit).toBe(180);
        expect(params.cursor).toBe('opaque-cursor');
    });

    it('accepts cursor/limit params for pnl requests', () => {
        const params: PnLRequestParams = {
            wallets: 'wallet-1,wallet-2',
            period: '30D',
            aggregation: 'daily',
            limit: 120,
            cursor: 'opaque-cursor',
        };

        expect(params.limit).toBe(120);
        expect(params.cursor).toBe('opaque-cursor');
    });

    it('accepts pageInfo/chunkInfo metadata on balance responses', () => {
        const response: BalanceTrendResponse = {
            series: [{ name: 'Total', data: [{ timestamp: 1, value: 100 }] }],
            metadata: {
                currency: 'USD',
                timezone: 'UTC',
                aggregation: 'daily',
            },
            pageInfo: {
                pageSize: 180,
                hasMore: true,
                nextCursor: 'next',
                source: 'mixed',
            },
            chunkInfo: {
                chunkFromSec: 1,
                chunkToSec: 10,
                requestedFromSec: 0,
                requestedToSec: 100,
                effectiveAggregation: 'daily',
            },
        };

        expect(response.pageInfo?.hasMore).toBe(true);
        expect(response.chunkInfo?.effectiveAggregation).toBe('daily');
    });

    it('accepts pageInfo/chunkInfo metadata on pnl responses', () => {
        const response: PnLChartResponse = {
            dailyPnL: [{ timestamp: 1, value: 1 }],
            cumulativePnL: [{ timestamp: 1, value: 1 }],
            metadata: { currency: 'USD' },
            pageInfo: {
                pageSize: 120,
                hasMore: false,
                nextCursor: null,
                source: 'mixed',
            },
            chunkInfo: {
                chunkFromSec: 1,
                chunkToSec: 10,
                requestedFromSec: 0,
                requestedToSec: 100,
                effectiveAggregation: 'weekly',
            },
        };

        expect(response.pageInfo?.nextCursor).toBeNull();
        expect(response.chunkInfo?.effectiveAggregation).toBe('weekly');
    });
});
