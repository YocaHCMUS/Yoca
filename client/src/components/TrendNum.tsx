import semStyle from "@/styles/_semantic.module.scss";
import { Stack } from "@carbon/react";
import { CaretUp, CaretDown } from "@carbon/react/icons";

export function TrendNum({
  value,
  formatter,
}: {
  value: number | null;
  formatter: (value: number | null) => string;
}) {
  if (value == null || Math.abs(value) < 0.0005) {
    return <span>{formatter(value == null ? null : 0)}</span>;
  } else if (value >= 0.0005) {
    return (
      <span className={semStyle.positive} style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
        <CaretUp size={16} /> {formatter(value)}
      </span>
    );
  } else {
    return (
      <span className={semStyle.negative} style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
        <CaretDown size={16} /> {formatter(Math.abs(value))}
      </span>
    );
  }
}
