import overwriteStyles from "@/styles/_overwrite.module.scss";
import { ContentSwitcher, Switch, Tooltip } from "@carbon/react";

type FilterOption<V extends string> = {
  value: V;
  label: string;
};

interface FilterSwitchProps<V extends string> {
  options: readonly FilterOption<V>[];
  value: V;
  onChange: (value: V) => void;
  tooltipLabel: string;
}

export function FilterSwitch<V extends string>({
  value,
  options,
  onChange,
  tooltipLabel,
}: FilterSwitchProps<V>) {
  const selectedIndex = options.findIndex((opt) => opt.value == value);

  return (
    <Tooltip label={tooltipLabel} enterDelayMs={2000} align="bottom">
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
        size="sm"
        style={{ minInlineSize: 200 }}
      >
        {options.map((opt, optIdx) => (
          <Switch key={optIdx} name={opt.label} text={opt.label} />
        ))}
      </ContentSwitcher>
    </Tooltip>
  );
}
