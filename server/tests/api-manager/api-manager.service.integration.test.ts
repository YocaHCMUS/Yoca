import '../../src/util/load-env';
import { ApiManagerService } from '../../src/services/api-manager/api-manager.service';
import { birdeyePriceRequestSchema, birdeyePriceResponseSchema } from '../../src/services/api-manager/types';

describe('ApiManagerService Integration', () => {
    let api: any;
    beforeEach(() => {
        api = new ApiManagerService();
    });

    it('should only call fetcher once for burst requests (integration)', async () => {
        let callCount = 0;
        const fetcher = async () => {
            callCount++;
            return { price: 2.34, symbol: 'SOL', timestamp: Date.now() };
        };
        const params = { tokenAddress: 'So11111111111111111111111111111111111111112' };
        const promises = Array.from({ length: 10 }, () =>
            api.call('birdeye', 'price', params, fetcher, {
                requestSchema: birdeyePriceRequestSchema,
                responseSchema: birdeyePriceResponseSchema,
            })
        );
        const results = await Promise.all(promises);
        expect(results.every(r => r.price === results[0].price)).toBe(true);
        expect(callCount).toBe(1);
    });

    it('should cache and return result from Redis/DB', async () => {
        let callCount = 0;
        const fetcher = async () => {
            callCount++;
            return { price: 3.45, symbol: 'SOL', timestamp: Date.now() };
        };
        const params = { tokenAddress: 'So11111111111111111111111111111111111111112' };
        // First call populates cache
        await api.call('birdeye', 'price', params, fetcher, {
            requestSchema: birdeyePriceRequestSchema,
            responseSchema: birdeyePriceResponseSchema,
        });
        // Second call should hit cache, not fetcher
        await api.call('birdeye', 'price', params, fetcher, {
            requestSchema: birdeyePriceRequestSchema,
            responseSchema: birdeyePriceResponseSchema,
        });
        expect(callCount).toBe(1);
    });
});
