import { cds } from "@/util/carbon-theme";
import { CaretDown, CaretUp } from "@carbon/react/icons";

export function TrendNum({
  value,
  prefixes = "arrow",
  epsilon = 1e-20,
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
  // Temporarily removed this feature
  // if (Math.abs(value) < epsilon) {
  //   return <span>{formatter(0)}</span>;
  // }

  let prefix: React.ReactNode = null;
  const formattedValue = formatter(Math.abs(value));

  if (prefixes == "arrow") {
    prefix = value > 0 ? <CaretUp size={18} /> : <CaretDown size={18} />;
  } else if (prefixes == "plus-minus") {
    prefix = value > 0 ? <p>+</p> : <p>-</p>;
  }
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        color: value > 0 ? cds.supportSuccess : cds.supportError,
      }}
    >
      {prefix} <span>{formattedValue}</span>
    </div>
  );
}
