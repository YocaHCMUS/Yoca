import overwriteStyles from "@/styles/_overwrite.module.scss";
import { ContentSwitcher, Switch } from "@carbon/react";
import type { CSSProperties } from "react";

type WidthSize = "sm" | "md" | "lg" | "xl" | "2xl";

const widthSize: Record<WidthSize, number> = {
  sm: 8,
  md: 12.5,
  lg: 16,
  xl: 25,
  "2xl": 32,
};

type FilterOption<V extends string | number> = {
  value: V;
  label: string;
};

interface FilterSwitchProps<V extends string | number> {
  options: readonly FilterOption<V>[];
  value: V;
  onChange: (value: V) => void;
  width?: WidthSize | number;
  style?: CSSProperties;
}

function isNumber(value: unknown): value is number {
  return Number.isFinite(value);
}

export function FilterSwitch<V extends string | number>({
  value,
  options,
  onChange,
  width = "md",
  style,
}: FilterSwitchProps<V>) {
  const selectedIndex = options.findIndex((opt) => opt.value == value);

  return (
    <ContentSwitcher
      className={overwriteStyles.fltrOpt}
      onChange={({ name }) => {
        if (!name) return;
        const selected = options.find((opt) => opt.label == name);
        if (selected) {
          onChange(selected.value);
        }
      }}
      selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
      size="md"
      style={{
        inlineSize: isNumber(width)
          ? width
          : `${widthSize[width as WidthSize]}rem`,
        ...style,
      }}
    >
      {options.map((opt, optIdx) => (
        <Switch key={optIdx} name={opt.label} text={opt.label} />
      ))}
    </ContentSwitcher>
  );
}
