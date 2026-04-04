import { Stack, Tooltip } from "@carbon/react";
import {
    type ComponentProps,
    type CSSProperties,
    useMemo,
    useState,
} from "react";

type TooltipAlign = ComponentProps<typeof Tooltip>["align"];

export interface TokenIdentityCellProps {
    symbol: string;
    fullName?: string | null;
    imageUrl?: string | null;
    imageSize?: number;
    tooltipAlign?: TooltipAlign;
    emphasizeSymbol?: boolean;
    showInitialsFallback?: boolean;
}

function getInitials(label: string): string {
    return label.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "?";
}

function getImageStyle(size: number): CSSProperties {
    return {
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
    };
}

function getInitialsStyle(size: number): CSSProperties {
    return {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "var(--cds-layer-accent, #393939)",
        color: "var(--cds-text-inverse, #ffffff)",
        fontSize: Math.max(9, Math.floor(size * 0.4)),
        fontWeight: 600,
        flexShrink: 0,
        userSelect: "none",
        lineHeight: 1,
    };
}

export function TokenIdentityCell({
    symbol,
    fullName,
    imageUrl,
    imageSize = 28,
    tooltipAlign = "right",
    emphasizeSymbol = false,
    showInitialsFallback = false,
}: TokenIdentityCellProps): React.ReactElement {
    const [imgFailed, setImgFailed] = useState(false);

    const normalizedSymbol = symbol?.trim() || "Unknown";
    const tooltipLabel = fullName?.trim() || normalizedSymbol;
    const initials = useMemo(() => getInitials(normalizedSymbol), [normalizedSymbol]);
    const showImage = Boolean(imageUrl) && !imgFailed;

    return (
        <Stack orientation="horizontal" gap={2} style={{ alignItems: "center" }}>
            {showImage ? (
                <img
                    src={imageUrl || undefined}
                    alt={normalizedSymbol}
                    width={imageSize}
                    height={imageSize}
                    style={getImageStyle(imageSize)}
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    loading="eager"
                    decoding="async"
                    onError={() => setImgFailed(true)}
                />
            ) : showInitialsFallback ? (
                <span style={getInitialsStyle(imageSize)} aria-hidden="true">
                    {initials}
                </span>
            ) : null}

            <span>
                <Tooltip label={tooltipLabel} align={tooltipAlign}>
                    {emphasizeSymbol ? (
                        <strong>{normalizedSymbol}</strong>
                    ) : (
                        <span>{normalizedSymbol}</span>
                    )}
                </Tooltip>
            </span>
        </Stack>
    );
}

export default TokenIdentityCell;
