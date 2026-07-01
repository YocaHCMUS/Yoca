export function clamp(value: number, min: number, max: number): number {
    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
}

export function safeDivide(numerator: number, denominator: number, fallback: number | null = null): number | null {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
        return fallback;
    }

    return numerator / denominator;
}

export function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
}

export function average(values: number[]): number | null {
    if (values.length === 0) {
        return null;
    }

    return sum(values) / values.length;
}

export function median(values: number[]): number | null {
    if (values.length === 0) {
        return null;
    }

    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 1) {
        return sorted[middle];
    }

    return (sorted[middle - 1] + sorted[middle]) / 2;
}