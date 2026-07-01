import { Search } from "lucide-react";
import { type Ref } from "react";
import styles from "./ChartControls.module.scss";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  inputRef?: Ref<HTMLInputElement>;
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Search",
  ariaLabel,
  inputRef,
}: SearchBoxProps) {
  return (
    <label className={styles.searchBox}>
      <Search size={15} />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
    </label>
  );
}
