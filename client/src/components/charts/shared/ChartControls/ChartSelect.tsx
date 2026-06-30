import { ChevronDown, Search, type LucideIcon } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./ChartControls.module.scss";

interface ChartSelectProps<TItem> {
  id: string;
  label: string;
  placeholder: ReactNode;
  value: TItem | null;
  items: readonly TItem[];
  onChange: (value: TItem | null) => void;
  getKey: (item: TItem) => string;
  getSearchText: (item: TItem) => string;
  renderValue: (item: TItem) => ReactNode;
  renderOption: (item: TItem) => ReactNode;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  actionIcon?: LucideIcon;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  className?: string;
}

export function ChartSelect<TItem>({
  id,
  label,
  placeholder,
  value,
  items,
  onChange,
  getKey,
  getSearchText,
  renderValue,
  renderOption,
  searchPlaceholder = "Search",
  emptyText = "No results",
  disabled = false,
  actionIcon: ActionIcon,
  actionLabel,
  actionDisabled = false,
  onAction,
  className = "",
}: ChartSelectProps<TItem>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    searchRef.current?.focus();

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) =>
      getSearchText(item).toLowerCase().includes(normalizedQuery),
    );
  }, [getSearchText, items, query]);

  return (
    <div ref={rootRef} className={`${styles.selectRoot} ${className}`}>
      <div className={styles.selectShell}>
        <button
          id={id}
          type="button"
          className={styles.trigger}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label}
          title={label}
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className={styles.triggerValue}>
            {value ? renderValue(value) : (
              <span className={styles.placeholder}>{placeholder}</span>
            )}
          </span>
        </button>
        <button
          type="button"
          className={styles.selectChevronButton}
          aria-label={`${label} menu`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          title={label}
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
        >
          <ChevronDown
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
            size={16}
          />
        </button>
        {ActionIcon && onAction ? (
          <>
            <span className={styles.selectDivider} aria-hidden="true" />
            <button
              type="button"
              className={styles.selectActionButton}
              aria-label={actionLabel}
              title={actionLabel}
              disabled={disabled || actionDisabled}
              onClick={onAction}
            >
              <ActionIcon size={16} />
            </button>
          </>
        ) : null}
      </div>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.searchRow}>
            <Search size={15} />
            <input
              ref={searchRef}
              className={styles.searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>
          <div className={styles.list} role="listbox" aria-label={label}>
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <button
                  key={getKey(item)}
                  type="button"
                  className={styles.option}
                  role="option"
                  aria-selected={value != null && getKey(value) === getKey(item)}
                  onClick={() => {
                    onChange(item);
                    setIsOpen(false);
                    setQuery("");
                  }}
                >
                  {renderOption(item)}
                </button>
              ))
            ) : (
              <div className={styles.empty}>{emptyText}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
