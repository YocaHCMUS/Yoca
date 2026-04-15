import sharedStyles from "@/components/charts/shared/ChartStyle.module.scss";
import { PERIOD_OPTIONS, type PeriodOption } from "@/config/periodOptions";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { TimePeriod } from "@/types/chart-filters.types";
import React from "react";
import styles from "./PeriodSelector.module.scss";

interface PeriodSelectorProps {
  value: TimePeriod;
  onChange: (key: TimePeriod) => void;
  options?: PeriodOption[];
  compact?: boolean;
  className?: string;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  value,
  onChange,
  options = PERIOD_OPTIONS,
  compact = false,
  className,
}) => {
  const { tr } = useLocalization();

  return (
    <div
      className={`${sharedStyles.chartToggle} ${styles.container} ${compact ? styles.compact : ""} ${className || ""}`}
      role="toolbar"
      aria-label={tr("charts.timePeriod")}
      data-html2canvas-ignore="true"
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            className={`${sharedStyles.chartToggleButton} ${styles.button} ${active ? styles.active : ""}`}
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
          >
            {tr(opt.labelKey)}
          </button>
        );
      })}
    </div>
  );
};

export default PeriodSelector;
