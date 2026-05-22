import { TrendNum } from "./TrendNum";

export type ForceSign = "positive" | "negative";

type TrendNumWithSignProps = {
    value: number | null;
    prefixes?: "plus-minus" | "arrow" | "none";
    epsilon?: number;
    formatter: (value: number | null) => string;
    forceSign?: ForceSign;
};

export function TrendNumWithSign({ value, forceSign, ...rest }: TrendNumWithSignProps) {
    let coercedValue: number | null = value;

    if (value != null && (forceSign === "positive" || forceSign === "negative")) {
        const mag = Math.abs(value);
        coercedValue = forceSign === "positive" ? mag : -mag;
    }

    return <TrendNum value={coercedValue} {...rest} />;
}

export default TrendNumWithSign;
