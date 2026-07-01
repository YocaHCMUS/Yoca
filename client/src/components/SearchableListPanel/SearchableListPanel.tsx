// SearchableListPanel.tsx
import { Flex } from "@/components/Flex";
import { Search } from "@carbon/react";
import { useMemo, useCallback, useEffect, useState, type ReactNode } from "react";
import debounce from "lodash.debounce";
import { Txt } from "@/components/Txt";        // adjust import if needed
import { InlineLoading } from "@carbon/react"; // already available
import styles from "./SearchableListPanel.module.scss";

export interface SearchableListPanelProps<TItem> {
  /** Full array of items to search from */
  items: TItem[];
  /** Function that returns a searchable string for each item (e.g. `${item.name} ${item.symbol}`) */
  getSearchableText: (item: TItem) => string;
  /** Renders each item in the list, receives the item and a closePanel callback */
  renderItem: (item: TItem, closePanel: () => void) => ReactNode;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Hint shown when no query has been typed yet */
  hintText?: string;
  /** Text shown when no results match */
  emptyText?: string;
  /** Loading state (useful if you later add async search) */
  isLoading?: boolean;
  /** Debounce delay in milliseconds (default 300) */
  debounceMs?: number;
  /** Callback to close the entire dropdown panel */
  closePanel: () => void;
}

export default function SearchableListPanel<TItem>({
  items,
  getSearchableText,
  renderItem,
  searchPlaceholder = "Search...",
  hintText = "Type to search",
  emptyText = "No results",
  isLoading = false,
  debounceMs = 300,
  closePanel,
}: SearchableListPanelProps<TItem>) {
  // Local input value (updates on every keystroke)
  const [query, setQuery] = useState("");
  // Debounced query – only changes after user stops typing
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Create a stable debounced function that updates the debouncedQuery
  const debouncedSetQuery = useCallback(
    debounce((value: string) => {
      setDebouncedQuery(value);
    }, debounceMs),
    [debounceMs]
  );

  // Cancel pending debounced calls on unmount
  useEffect(() => {
    return () => {
      debouncedSetQuery.cancel();
    };
  }, [debouncedSetQuery]);

  const handleInput = (value: string) => {
    setQuery(value);
    // Schedule the debounced update
    debouncedSetQuery(value);
  };

  // Filter items based on debounced query
  const filteredItems = useMemo(() => {
    const searchTerm = debouncedQuery.trim().toLowerCase();
    if (!searchTerm) return items;
    return items.filter((item) =>
      getSearchableText(item).toLowerCase().includes(searchTerm)
    );
  }, [items, debouncedQuery, getSearchableText]);

  const showHint = !isLoading && !debouncedQuery.trim();
  const showEmpty = !isLoading && debouncedQuery.trim().length > 0 && filteredItems.length === 0;

  return (
    <Flex dir="column">
      {/* Search input row */}
      <div className={styles.searchRow}>
        <Search
          size="md"
          labelText="Search"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
        />
      </div>

      {/* Optional header (can be removed if not needed) */}
      <Flex justify="between" align="center" pInline={8} pBlockStart={8}>
        <Txt size="sm" secondary>
          Results
        </Txt>
        {/* You could add a secondary column header here if needed */}
      </Flex>

      {/* Scrollable list area */}
      <Flex dir="column" className={styles.list}>
        {showHint && (
          <Flex pInline={8} pBlock={6}>
            <Txt size="sm" secondary>
              {hintText}
            </Txt>
          </Flex>
        )}

        {isLoading && (
          <Flex pInline={8} pBlock={6}>
            <InlineLoading description="Loading..." />
          </Flex>
        )}

        {showEmpty && (
          <Flex pInline={8} pBlock={6}>
            <Txt size="sm" secondary>
              {emptyText}
            </Txt>
          </Flex>
        )}

        {!isLoading &&
          filteredItems.map((item) => renderItem(item, closePanel))}
      </Flex>
    </Flex>
  );
}