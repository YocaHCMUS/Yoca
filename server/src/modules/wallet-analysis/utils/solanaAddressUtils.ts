import { PublicKey } from "@solana/web3.js";

export function isValidSolanaAddress(address: string): boolean {
    const normalized = address.trim();
    if (normalized.length === 0) {
        return false;
    }

    try {
        const key = new PublicKey(normalized);
        return key.toBase58() === normalized;
    } catch {
        return false;
    }
}