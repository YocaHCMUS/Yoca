import { cds } from "@/util/carbon-theme";
import { CaretDown, CaretUp } from "@carbon/react/icons";
import { Txt } from "./Txt";

type Direction = "in" | "out" | "none" | "auto";

export function TrendNum({
  value,
  direction = "auto",
  prefixes = "arrow",
  epsilon = 1e-20,
  mono = false,
  size = "md",
  formatter,
}: {
  value: number | null;
  prefixes?: "plus-minus" | "arrow" | "none";
  direction?: Direction;
  mono?: boolean;
  size?: "sm" | "md" | "lg";
  epsilon?: number;
  formatter: (value: number | null) => string;
}) {
  // Handle null value
  if (value == null) {
    return <Txt mono={mono} size={size}>{formatter(value)}</Txt>;
  }

  // Determine sign based on direction override
  let sign: number;
  let displayValue: number;

  if (direction == "in") {
    sign = 1;
    displayValue = Math.abs(value);
  } else if (direction == "out") {
    sign = -1;
    displayValue = Math.abs(value);
  } else if (direction == "none") {
    sign = 0;
    displayValue = value;
  } else { // "auto"
    if (Math.abs(value) < epsilon) {
      sign = 0;
      displayValue = 0;
    } else {
      sign = Math.sign(value);
      displayValue = Math.abs(value);
    }
  }

  // If sign is 0, we show neutral styling
  const isPositive = sign > 0;
  const isNegative = sign < 0;

  // Build prefix
  let prefix: React.ReactNode = null;
  if (prefixes == "arrow") {
    if (isPositive) prefix = <CaretUp size={18} />;
    else if (isNegative) prefix = <CaretDown size={18} />;
    // No prefix for zero
  } else if (prefixes == "plus-minus") {
    if (isPositive) prefix = <Txt mono={mono} size={size}>+</Txt>;
    else if (isNegative) prefix = <Txt mono={mono} size={size}>-</Txt>;
    // No prefix for zero
  }

  // Determine color
  let color  : string = cds.textSecondary; // default (neutral)
  if (isPositive) color = cds.supportSuccess;
  else if (isNegative) color = cds.supportError;

  // Format the display value
  const formatted = formatter(displayValue);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        color,
      }}
    >
      {prefix} <Txt mono={mono} size={size} >{formatted}</Txt>
    </div>
  );
}