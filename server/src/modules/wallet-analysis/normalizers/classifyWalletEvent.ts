import type {
    WalletEventClassification,
    WalletEventDirection,
    WalletEventDraft,
} from "../types/normalizedWalletEvent";

function includesText(haystack: string | null | undefined, needle: string): boolean {
    return String(haystack ?? "").toLowerCase().includes(needle);
}

function directionFromMovements(
    movements: Array<{ directionForWallet: WalletEventDirection }>,
): WalletEventDirection {
    let hasIn = false;
    let hasOut = false;

    for (const movement of movements) {
        if (movement.directionForWallet === "IN") {
            hasIn = true;
        } else if (movement.directionForWallet === "OUT") {
            hasOut = true;
        }
    }

    if (hasIn && hasOut) {
        return "BOTH";
    }
    if (hasIn) {
        return "IN";
    }
    if (hasOut) {
        return "OUT";
    }
    if (movements.length > 0) {
        return "NEUTRAL";
    }
    return "UNKNOWN";
}

export function classifyWalletEvent(eventDraft: WalletEventDraft): WalletEventClassification {
    const warnings = [...(eventDraft.warnings ?? [])];
    const tokenDirections = directionFromMovements(eventDraft.tokenTransfers);
    const nativeDirections = directionFromMovements(eventDraft.nativeTransfers);

    if (eventDraft.swap != null) {
        return { type: "SWAP", direction: "BOTH", warnings };
    }

    if (eventDraft.nftEvent != null) {
        if (eventDraft.nftEvent.action === "TRANSFER_IN" || eventDraft.nftEvent.action === "PURCHASE") {
            return { type: eventDraft.nftEvent.action === "PURCHASE" ? "NFT_PURCHASE" : "NFT_TRANSFER_IN", direction: "IN", warnings };
        }
        if (eventDraft.nftEvent.action === "TRANSFER_OUT" || eventDraft.nftEvent.action === "SALE") {
            return { type: eventDraft.nftEvent.action === "SALE" ? "NFT_SALE" : "NFT_TRANSFER_OUT", direction: "OUT", warnings };
        }
    }

    if (eventDraft.tokenTransfers.length > 0) {
        if (tokenDirections === "IN") {
            return { type: "TOKEN_TRANSFER_IN", direction: "IN", warnings };
        }
        if (tokenDirections === "OUT") {
            return { type: "TOKEN_TRANSFER_OUT", direction: "OUT", warnings };
        }
        if (tokenDirections === "BOTH") {
            warnings.push("Multiple token movements were detected without a confirmed swap parser result.");
            return { type: "UNKNOWN", direction: "BOTH", warnings };
        }
    }

    if (eventDraft.nativeTransfers.length > 0) {
        if (nativeDirections === "IN") {
            return { type: "NATIVE_TRANSFER_IN", direction: "IN", warnings };
        }
        if (nativeDirections === "OUT") {
            return { type: "NATIVE_TRANSFER_OUT", direction: "OUT", warnings };
        }
    }

    const transactionType = String(eventDraft.transactionType ?? "").toUpperCase();
    const description = String(eventDraft.description ?? "").toLowerCase();

    if (eventDraft.protocol?.category === "BRIDGE" || includesText(transactionType, "BRIDGE") || includesText(description, "bridge")) {
        return { type: "BRIDGE", direction: "NEUTRAL", warnings };
    }
    if (includesText(transactionType, "UNSTAKE") || includesText(description, "unstake")) {
        return { type: "UNSTAKE", direction: "NEUTRAL", warnings };
    }
    if (includesText(transactionType, "STAKE") || includesText(description, "stake")) {
        return { type: "STAKE", direction: "NEUTRAL", warnings };
    }
    if (includesText(transactionType, "AIRDROP") || includesText(description, "airdrop") || includesText(description, "claim")) {
        return { type: "AIRDROP_CLAIM", direction: "NEUTRAL", warnings };
    }
    if (includesText(transactionType, "APPROVE") || includesText(transactionType, "AUTHORITY") || includesText(description, "approve") || includesText(description, "authority")) {
        return { type: "APPROVAL_OR_AUTHORITY_CHANGE", direction: "NEUTRAL", warnings };
    }

    return { type: "UNKNOWN", direction: "UNKNOWN", warnings };
}