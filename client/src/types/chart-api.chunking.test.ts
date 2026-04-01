import { describe, expect, it } from 'vitest';
import type {
    BalanceRequestParams,
    BalanceTrendResponse,
    PnLChartResponse,
    PnLRequestParams,
} from './chart-api.types';

describe('chart-api non-chunk contracts', () => {
    it('accepts simplified balance request params', () => {
        const params: BalanceRequestParams = {
            wallets: 'wallet-1',
            timePeriod: 'All',
            timezone: 'UTC',
        };

        expect(params.wallets).toBe('wallet-1');
        expect(params.timePeriod).toBe('All');
    });

    it('accepts simplified pnl request params', () => {
        const params: PnLRequestParams = {
            wallets: 'wallet-1,wallet-2',
            period: '30D',
            aggregation: 'daily',
        };

        expect(params.wallets).toBe('wallet-1,wallet-2');
        expect(params.aggregation).toBe('daily');
    });

    it('accepts balance responses without chunk metadata', () => {
        const response: BalanceTrendResponse = {
            series: [{ name: 'Total', data: [{ timestamp: 1, value: 100 }] }],
            metadata: {
                currency: 'USD',
                timezone: 'UTC',
                aggregation: 'daily',
            },
        };

        expect(response.series[0].name).toBe('Total');
        expect(response.metadata.currency).toBe('USD');
    });

    it('accepts pnl responses without chunk metadata', () => {
        const response: PnLChartResponse = {
            dailyPnL: [{ timestamp: 1, value: 1 }],
            cumulativePnL: [{ timestamp: 1, value: 1 }],
            metadata: { currency: 'USD' },
        };

        expect(response.dailyPnL?.length).toBe(1);
        expect(response.metadata.currency).toBe('USD');
    });
});
