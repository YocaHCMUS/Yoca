import { Stack, Tooltip } from "@carbon/react";
import {
    type ComponentProps,
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


export function TokenIdentityCell({
    symbol,
    fullName,
    imageUrl,
    imageSize = 30,
    tooltipAlign = "right",
    emphasizeSymbol = false,

}: TokenIdentityCellProps): React.ReactElement {
    const normalizedSymbol = symbol?.trim().toUpperCase() || "UNKNOWN";
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
