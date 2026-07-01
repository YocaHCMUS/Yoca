import { type ComponentType, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import styles from "./ChartControls.module.scss";

export interface SegmentedControlOption<TValue extends string> {
  value: TValue;
  label: string;
  icon?: ComponentType<{ size?: number }>;
}

interface SegmentedControlProps<TValue extends string> {
  options: readonly SegmentedControlOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  ariaLabel: string;
  className?: string;
  iconOnly?: boolean;
  disabled?: boolean;
  renderLabel?: (option: SegmentedControlOption<TValue>) => ReactNode;
}

export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
  iconOnly = false,
  disabled = false,
  renderLabel,
}: SegmentedControlProps<TValue>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState({ width: 0, offsetX: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLButtonElement>(
      '[data-active="true"]',
    );
    if (!activeBtn) return;
    setSliderStyle({
      width: activeBtn.offsetWidth,
      offsetX: activeBtn.offsetLeft,
    });
  }, [value, options]);

  return (
    <div
      ref={containerRef}
      className={`${styles.segmented} ${className}`}
      role="toolbar"
      aria-label={ariaLabel}
      data-html2canvas-ignore="true"
    >
      <div
        className={styles.slider}
        style={{
          width: sliderStyle.width,
          transform: `translateX(${sliderStyle.offsetX}px)`,
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            data-active={active}
            className={`${styles.segment} ${active ? styles.segmentActive : ""} ${iconOnly ? styles.segmentIconOnly : ""}`}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            disabled={disabled}
          >
            {Icon ? <Icon size={16} /> : null}
            {!iconOnly && (renderLabel ? renderLabel(option) : option.label)}
          </button>
        );
      })}
    </div>
  );
}
