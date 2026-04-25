import { Stack, Tooltip } from "@carbon/react";
import {
    type ComponentProps,
    type CSSProperties,
} from "react";
import { TknImg } from "../TknImg";

type TooltipAlign = ComponentProps<typeof Tooltip>["align"];

export interface TokenIdentityCellProps {
    symbol: string;
    fullName?: string | null;
    imageUrl?: string | null;
    imageSize?: number;
    tooltipAlign?: TooltipAlign;
    emphasizeSymbol?: boolean;
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
}: TokenIdentityCellProps): React.ReactElement {
    const normalizedSymbol = symbol?.trim() || "Unknown";
    const tooltipLabel = fullName?.trim() || normalizedSymbol;
    const source = imageUrl || null;

    return (
        <Stack orientation="horizontal" gap={2} style={{ alignItems: "center" }}>
            <TknImg src={source} alt={normalizedSymbol} size={imageSize} />
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
