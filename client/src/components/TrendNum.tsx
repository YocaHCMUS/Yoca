import semStyle from "@/styles/_semantic.module.scss";
import { Stack } from "@carbon/react";
import { CaretDown, CaretUp } from "@carbon/react/icons";

export function TrendNum({
  value,
  formatter,
}: {
  value: number | null;
  formatter: (value: number | null) => string;
}) {
  if (!value) {
    return <span>{formatter(value)}</span>;
  } else if (value > 0) {
    return (
      <Stack orientation="horizontal" className={semStyle.positive}>
        <CaretUp size={18} /> {formatter(value)}
      </Stack>
    );
  } else {
    return (
      <Stack orientation="horizontal" className={semStyle.negative}>
        <CaretDown size={18} /> {formatter(Math.abs(value))}
      </Stack>
    );
  }
}
