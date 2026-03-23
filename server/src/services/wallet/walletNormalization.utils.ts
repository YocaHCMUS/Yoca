export function roundUsd(value: number): number {
    return Number(value.toFixed(2));
}

export function normalizeBalanceDelta(
    change: { amount: number; decimals: number },
): number {
    const amountRaw = Number(change.amount);
    const decimals = Number(change.decimals);
    if (!Number.isFinite(amountRaw) || !Number.isFinite(decimals)) {
        return 0;
    }

    return amountRaw / 10 ** Math.max(0, decimals);
}
