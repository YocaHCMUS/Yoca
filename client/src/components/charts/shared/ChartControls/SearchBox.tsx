import { Search } from "lucide-react";
import { type KeyboardEventHandler, type Ref } from "react";
import styles from "./ChartControls.module.scss";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  inputRef?: Ref<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  disabled?: boolean;
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  ariaLabel,
  inputRef,
  onKeyDown,
  disabled = false,
}: SearchBoxProps) {
  return (
    <label className={styles.searchBox} data-disabled={disabled}>
      <Search size={15} />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        disabled={disabled}
      />
    </label>
  );
}
