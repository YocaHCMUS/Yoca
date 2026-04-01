import '../../src/util/load-env';
import { ApiManagerService } from '../../src/services/api-manager/api-manager.service';
import { birdeyePriceRequestSchema, birdeyePriceResponseSchema } from '../../src/services/api-manager/types';

describe('ApiManagerService', () => {
    let api: any;
    beforeEach(() => {
        api = new ApiManagerService();
    });

    it('coalesces identical requests', async () => {
        let callCount = 0;
        const fetcher = async () => {
            callCount++;
            return { price: 1.23, symbol: 'SOL', timestamp: Date.now() };
        };
        const params = { tokenAddress: 'So11111111111111111111111111111111111111112' };
        const [a, b] = await Promise.all([
            api.call('birdeye', 'price', params, fetcher, {
                requestSchema: birdeyePriceRequestSchema,
                responseSchema: birdeyePriceResponseSchema,
            }),
            api.call('birdeye', 'price', params, fetcher, {
                requestSchema: birdeyePriceRequestSchema,
                responseSchema: birdeyePriceResponseSchema,
            }),
        ]);
        expect(a).toEqual(b);
        expect(callCount).toBe(1);
    });
});
