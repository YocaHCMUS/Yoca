import type { ProtocolInfo } from "../types/normalizedWalletEvent";

function normalizeSource(source?: string | null): string {
    return String(source ?? "").trim().toUpperCase();
}

export function mapProtocolSource(source?: string | null): ProtocolInfo {
    const normalized = normalizeSource(source);

    if (!normalized) {
        return { name: "Unknown", category: "UNKNOWN", programId: null };
    }

    if (normalized.includes("JUPITER")) {
        return { name: "Jupiter", category: "DEX", programId: null };
    }
    if (normalized.includes("RAYDIUM")) {
        return { name: "Raydium", category: "DEX", programId: null };
    }
    if (normalized.includes("ORCA")) {
        return { name: "Orca", category: "DEX", programId: null };
    }
    if (normalized.includes("METEORA")) {
        return { name: "Meteora", category: "DEX", programId: null };
    }
    if (normalized.includes("PHOENIX")) {
        return { name: "Phoenix", category: "DEX", programId: null };
    }
    if (normalized.includes("MAGIC_EDEN") || normalized.includes("MAGICEDEN")) {
        return { name: "Magic Eden", category: "NFT_MARKETPLACE", programId: null };
    }
    if (normalized.includes("TENSOR")) {
        return { name: "Tensor", category: "NFT_MARKETPLACE", programId: null };
    }
    if (normalized.includes("KAMINO")) {
        return { name: "Kamino", category: "LENDING", programId: null };
    }
    if (normalized.includes("MARGINFI")) {
        return { name: "MarginFi", category: "LENDING", programId: null };
    }
    if (normalized.includes("MARINADE")) {
        return { name: "Marinade", category: "STAKING", programId: null };
    }
    if (normalized.includes("SYSTEM_PROGRAM") || normalized === "SYSTEM") {
        return { name: "System Program", category: "SYSTEM", programId: null };
    }
    if (normalized.includes("CEX")) {
        return { name: source ?? "Unknown", category: "CEX", programId: null };
    }

    return { name: source ?? "Unknown", category: "UNKNOWN", programId: null };
}