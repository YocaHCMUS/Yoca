import styles from "./SparklineChart.module.scss";

interface SparklineChartProps {
  data: number[] | null;
  positive?: boolean;
  width?: number;
  height?: number;
}

export default function SparklineChart({
  data,
  positive,
  width = 120,
  height = 40,
}: SparklineChartProps) {
  if (!data || data.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        className={styles.sparkline}
        style={{ display: "block", verticalAlign: "middle", width: "100%", height: "100%", maxHeight: height }}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const padX = 2;
  const padY = 3;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const pts = data
    .map((val, i) => {
      const x = padX + (i / (data.length - 1)) * innerW;
      const y = padY + innerH - ((val - min) / range) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  const isPositive = positive ?? (data[data.length - 1] >= data[0]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      className={`${styles.sparkline} ${isPositive ? styles.up : styles.down}`}
      style={{ display: "block", verticalAlign: "middle", width: "100%", height: "100%", maxHeight: height }}
      preserveAspectRatio="none"
    >
      <polyline points={pts} />
    </svg>
  );
}
