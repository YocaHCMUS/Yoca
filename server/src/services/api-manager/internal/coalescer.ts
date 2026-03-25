// In-Flight Coalescer implementation
const inFlight = new Map<string, Promise<any>>();

export function coalesce<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (inFlight.has(key)) {
        return inFlight.get(key)!;
    }

    const promise = fetcher().finally(() => {
        inFlight.delete(key);
    });
    inFlight.set(key, promise);
    return promise;
}
