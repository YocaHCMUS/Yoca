import semStyle from "@/styles/_semantic.module.scss";
import { Stack } from "@carbon/react";
import { CaretDown, CaretUp } from "@carbon/react/icons";

export function TrendNum({
  value,
  prefixes = "arrow",
  epsilon = 1e-8,
  formatter,
}: {
  value: number | null;
  prefixes?: "plus-minus" | "arrow" | "none";
  epsilon?: number; // treat values with absolute value less than epsilon as 0
  formatter: (value: number | null) => string;
}) {
  if (value == null) {
    return <span>{formatter(value)}</span>;
  }
  if (Math.abs(value) < epsilon) {
    return <span>{formatter(0)}</span>;
  }

  let prefix: React.ReactNode = null;
  let formattedValue = formatter(Math.abs(value));

  if (prefixes == "arrow") {
    prefix = value > 0 ? <CaretUp size={18} /> : <CaretDown size={18} />;
  } else if (prefixes == "plus-minus") {
    prefix = value > 0 ? <p>+</p> : <p>-</p>;
  }

  const className = value > 0 ? semStyle.positive : semStyle.negative;

  return (
    <Stack
      orientation="horizontal"
      style={{ justifyContent: "start" }}
      className={className}
    >
      {prefix} <p>{formattedValue}</p>
    </Stack>
  );
}
