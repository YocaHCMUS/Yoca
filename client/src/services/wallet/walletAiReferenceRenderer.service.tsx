import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import type { WalletAiReferenceEntry } from "@/services/wallet/walletApi.ts";
import type { ReactNode } from "react";

const REF_MARKER_REGEX = /\bref:(\d+)\b/gi;

function getShortAddress(address?: string): string {
    if (!address) {
        return "Reference";
    }

    const normalized = address.trim();
    if (normalized.length <= 10) {
        return normalized;
    }

    return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function getReferenceSymbol(entry: WalletAiReferenceEntry): string {
    const symbol = entry.symbol?.trim();
    if (symbol && symbol.toUpperCase() !== "N/A") {
        return symbol;
    }

    const name = entry.name?.trim();
    if (name && name.length > 0) {
        return name;
    }

    if (entry.type === "wallet") {
        return getShortAddress(entry.address);
    }

    return "Reference";
}

function getReferenceName(entry: WalletAiReferenceEntry): string {
    const name = entry.name?.trim();
    if (name && name.length > 0) {
        return name;
    }

    const address = entry.address?.trim();
    if (address && address.length > 0) {
        return address;
    }

    return `ref:${entry.ref_id}`;
}

function buildReferenceMap(
    reference?: WalletAiReferenceEntry[],
): Map<number, WalletAiReferenceEntry> {
    if (!Array.isArray(reference) || reference.length === 0) {
        return new Map();
    }

    const map = new Map<number, WalletAiReferenceEntry>();

    for (const entry of reference) {
        if (typeof entry?.ref_id === "number" && Number.isFinite(entry.ref_id)) {
            map.set(entry.ref_id, entry);
        }
    }

    return map;
}

export function renderWalletAiReferenceText(
    text: string | null | undefined,
    reference?: WalletAiReferenceEntry[],
    keyPrefix = "ref",
): ReactNode {
    const source = String(text ?? "").trim();
    if (!source) {
        return "-";
    }

    const referenceMap = buildReferenceMap(reference);
    if (referenceMap.size === 0) {
        return source;
    }

    REF_MARKER_REGEX.lastIndex = 0;

    const segments: ReactNode[] = [];
    let lastIndex = 0;
    let markerIndex = 0;

    for (const match of source.matchAll(REF_MARKER_REGEX)) {
        const fullMatch = match[0];
        const markerText = match[1];
        const markerStart = match.index ?? -1;

        if (markerStart < 0) {
            continue;
        }

        if (markerStart > lastIndex) {
            segments.push(source.slice(lastIndex, markerStart));
        }

        const refId = Number(markerText);
        const entry = referenceMap.get(refId);

        if (!entry) {
            segments.push(fullMatch);
        } else {
            segments.push(
                <span
                    key={`${keyPrefix}-${markerIndex}-${refId}`}
                    style={{
                        display: "inline-flex",
                        verticalAlign: "middle",
                        marginInline: 4,
                    }}
                >
                    <TokenIdentityCell
                        symbol={getReferenceSymbol(entry)}
                        fullName={getReferenceName(entry)}
                        imageUrl={entry.logoUri}
                        imageSize={30}
                        emphasizeSymbol
                    />
                </span>,
            );
        }

        markerIndex += 1;
        lastIndex = markerStart + fullMatch.length;
    }

    if (lastIndex < source.length) {
        segments.push(source.slice(lastIndex));
    }

    return segments.length > 0 ? segments : source;
}

export function renderWalletAiReferenceList(
    values: string[] | null | undefined,
    reference?: WalletAiReferenceEntry[],
    keyPrefix = "ref-list",
): ReactNode {
    if (!Array.isArray(values) || values.length === 0) {
        return "-";
    }

    return (
        <span style={{ display: "inline-grid", gap: 6 }}>
            {values.map((item, index) => (
                <span key={`${keyPrefix}-${index}`}>
                    {renderWalletAiReferenceText(item, reference, `${keyPrefix}-${index}`)}
                </span>
            ))}
        </span>
    );
}
