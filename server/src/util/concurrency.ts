/**
 * PURPOSE: Run async mapping with an explicit concurrency cap.
 * USAGE:
 * const results = await mapWithConcurrency(items, 3, async (item) => process(item));
 */
export async function mapWithConcurrency<TItem, TResult>(
    items: TItem[],
    concurrencyLimit: number,
    mapper: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> {
    if (items.length === 0) {
        return [];
    }

    const normalizedLimit = Math.max(1, Math.floor(concurrencyLimit));
    const workerCount = Math.min(normalizedLimit, items.length);
    const results = new Array<TResult>(items.length);
    let nextIndex = 0;

    const worker = async () => {
        while (true) {
            const currentIndex = nextIndex;
            if (currentIndex >= items.length) {
                return;
            }

            nextIndex += 1;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}
