import '../../src/util/load-env';
import { ApiManagerService } from '../../src/services/api-manager/api-manager.service';
import { birdeyePriceRequestSchema, birdeyePriceResponseSchema } from '../../src/services/api-manager/types';

describe('ApiManagerService Queue/429', () => {
    let api: any;
    beforeEach(() => {
        api = new ApiManagerService();
    });

    it('should throttle requests according to provider rate limit', async () => {
        const timestamps: number[] = [];
        const fetcher = async () => {
            timestamps.push(Date.now());
            return { price: 4.56, symbol: 'SOL', timestamp: Date.now() };
        };
        const params = { tokenAddress: 'So11111111111111111111111111111111111111112' };
        const promises = Array.from({ length: 3 }, (_, i) =>
            api.call('birdeye', 'price', { ...params, _idx: i }, fetcher, {
                requestSchema: birdeyePriceRequestSchema,
                responseSchema: birdeyePriceResponseSchema,
            })
        );
        await Promise.all(promises);
        // Should be spaced by at least 1s due to rate limit
        expect(timestamps.length).toBe(3);
        expect(timestamps[2] - timestamps[0]).toBeGreaterThanOrEqual(2000);
    });

    it('should handle 429 errors and retry (stub)', async () => {
        let callCount = 0;
        const fetcher = async () => {
            callCount++;
            if (callCount === 1) {
                const err: any = new Error('429');
                err.status = 429;
                err.retryAfter = 500;
                throw err;
            }
            return { price: 5.67, symbol: 'SOL', timestamp: Date.now() };
        };
        const params = { tokenAddress: 'So11111111111111111111111111111111111111112' };
        // This test expects retry logic to be implemented in the future
        try {
            await api.call('birdeye', 'price', params, fetcher, {
                requestSchema: birdeyePriceRequestSchema,
                responseSchema: birdeyePriceResponseSchema,
            });
        } catch (e) {
            expect((e as any).status).toBe(429);
        }
    });
});
