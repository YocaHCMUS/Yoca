import semStyle from "@/styles/_semantic.module.scss";
import { CaretUp } from "@carbon/react/icons";

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
      <span className={semStyle.positive}>
        <CaretUp size={18} /> {formatter(value)}
      </span>
    );
  } else {
    return (
      <span className={semStyle.negative}>
        <CaretUp size={18} /> {formatter(Math.abs(value))}
      </span>
    );
  }
}
