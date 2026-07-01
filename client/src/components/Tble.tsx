import { ChartTag } from "@/components/charts/shared/ChartControls";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  Search,
  X,
} from "lucide-react";
import {
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useUserTheme } from "@/contexts/ThemeContext";
import styles from "./Tble.module.scss";

export enum TbleSortType {
  String = "string",
  Number = "number",
}

export enum TbleFilterType {
  Select = "select",
  Range = "range",
  Composite = "composite",
}

export interface TbleSortConfig {
  type: TbleSortType;
  field?: string;
}

export type TbleFilterConfig =
  | { type: TbleFilterType.Select; field?: string }
  | { type: TbleFilterType.Range; field?: string; min?: number; max?: number; step?: number }
  | { type: TbleFilterType.Composite; filters: Record<string, TbleFilterConfig | null> };

type RangeFilterValue = { min?: number; max?: number };
interface CompositeFilterValue {
  [key: string]: FilterValue;
}
type FilterValue = string[] | RangeFilterValue | CompositeFilterValue | null;
type SortDirection = "asc" | "desc";

interface TblHdr {
  header: string;
  key: string;
  align?: "start" | "center" | "end";
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  style?: CSSProperties;
}

export interface TblRw {
  id: string;
  [key: string]: unknown;
}

type CellRenderer = (value: unknown, row: TblRw, rowIndex: number) => ReactNode;

interface TblProps {
  rows: TblRw[];
  headers: TblHdr[];
  title?: ReactNode;
  description?: ReactNode;
  hideHeaders?: boolean;
  loading?: boolean;
  height?: number | string;
  toolBar?: ReactNode;
  stickyHeader?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  boxed?: boolean;
  pageSizes?: number[];
  marginTop?: number;
  pageUnknown?: boolean;
  onRowClick?: (row: TblRw, rowIndex: number) => void;
  sortConfigs?: Record<string, TbleSortConfig>;
  filterSchema?: Record<string, TbleFilterConfig | null>;
  cellRenderers?: Record<string, CellRenderer>;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  searchFields?: string[];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  className?: string;
  size?: string;
  "aria-label"?: string;
}

function getFieldValue(row: TblRw, key: string, field?: string): unknown {
  if (field) return row[field];
  return row[key];
}

function toComparableString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isObjectValue(value: FilterValue): value is RangeFilterValue | CompositeFilterValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isRangeValue(value: FilterValue): value is RangeFilterValue {
  return Boolean(
    isObjectValue(value) &&
    ("min" in value || "max" in value) &&
    Object.values(value).every((entry) => entry == null || typeof entry === "number"),
  );
}

function isCompositeValue(value: FilterValue): value is CompositeFilterValue {
  return Boolean(isObjectValue(value) && !isRangeValue(value));
}

function getDefaultFilterState(schema: TbleFilterConfig | null | undefined): FilterValue {
  if (!schema) return null;
  if (schema.type === TbleFilterType.Select) return [];
  if (schema.type === TbleFilterType.Range) return { min: undefined, max: undefined };
  return Object.fromEntries(
    Object.entries(schema.filters)
      .filter(([, childSchema]) => Boolean(childSchema))
      .map(([childKey, childSchema]) => [childKey, getDefaultFilterState(childSchema)]),
  );
}

function isFilterActive(schema: TbleFilterConfig | null | undefined, value: FilterValue): boolean {
  if (!schema) return false;
  if (schema.type === TbleFilterType.Select) return Array.isArray(value) && value.length > 0;
  if (schema.type === TbleFilterType.Range) return isRangeValue(value) && (value.min != null || value.max != null);
  if (!isCompositeValue(value)) return false;
  return Object.entries(schema.filters).some(([childKey, childSchema]) =>
    isFilterActive(childSchema, value[childKey] ?? null),
  );
}

function matchesFilterSchema(
  row: TblRw,
  fallbackKey: string,
  schema: TbleFilterConfig | null | undefined,
  value: FilterValue,
): boolean {
  if (!schema || !isFilterActive(schema, value)) return true;

  if (schema.type === TbleFilterType.Select) {
    if (!Array.isArray(value)) return true;
    return value.includes(toComparableString(getFieldValue(row, fallbackKey, schema.field)));
  }

  if (schema.type === TbleFilterType.Range) {
    if (!isRangeValue(value)) return true;
    const numeric = toNumber(getFieldValue(row, fallbackKey, schema.field));
    if (value.min != null && numeric < value.min) return false;
    if (value.max != null && numeric > value.max) return false;
    return true;
  }

  if (!isCompositeValue(value)) return true;
  return Object.entries(schema.filters).every(([childKey, childSchema]) =>
    matchesFilterSchema(row, childKey, childSchema, value[childKey] ?? null),
  );
}

function formatFilterValue(schema: TbleFilterConfig | null | undefined, value: FilterValue): string {
  if (!schema) return "";
  if (schema.type === TbleFilterType.Select) return Array.isArray(value) ? value.join(", ") : "";
  if (schema.type === TbleFilterType.Range && isRangeValue(value)) {
    const min = value.min != null ? String(value.min) : "*";
    const max = value.max != null ? String(value.max) : "*";
    return `${min}-${max}`;
  }
  if (schema.type === TbleFilterType.Composite && isCompositeValue(value)) {
    return Object.entries(schema.filters)
      .map(([childKey, childSchema]) => {
        const childValue = value[childKey] ?? null;
        if (!isFilterActive(childSchema, childValue)) return null;
        return `${childKey}: ${formatFilterValue(childSchema, childValue)}`;
      })
      .filter(Boolean)
      .join("; ");
  }
  return "";
}

function isRenderableCellValue(value: unknown): value is ReactNode {
  return (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    isValidElement(value)
  );
}

function toLength(value: number | string | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

export default function Tble({
  rows,
  headers,
  title,
  description,
  hideHeaders = false,
  loading = false,
  height,
  toolBar,
  boxed = false,
  stickyHeader = false,
  enablePagination = false,
  pageSize = 16,
  pageSizes = [8, 16, 24, 32],
  pageUnknown = false,
  marginTop = 0,
  onRowClick,
  sortConfigs,
  filterSchema,
  cellRenderers,
  enableSearch = false,
  searchPlaceholder,
  searchFields,
  searchValue,
  onSearchChange,
  className = "",
  size: _size,
  "aria-label": ariaLabel,
}: TblProps) {
  void _size;
  const { tr } = useLocalization();
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(Math.max(1, pageSize));
  const [sortState, setSortState] = useState<{ key: string; direction: SortDirection } | null>(null);
  const [filters, setFilters] = useState<Record<string, FilterValue>>({});
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [draftFilterValue, setDraftFilterValue] = useState<FilterValue>(null);
  const [internalSearchValue, setInternalSearchValue] = useState("");
  const [filterSearches, setFilterSearches] = useState<Record<string, string>>({});
  const { themeRef } = useUserTheme();
  const [filterPopupPos, setFilterPopupPos] = useState<CSSProperties>({});
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const [pageSizePos, setPageSizePos] = useState<CSSProperties>({});
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pageSizeTriggerRef = useRef<HTMLButtonElement>(null);
  const pageSizePopupRef = useRef<HTMLDivElement>(null);

  const resolvedSearchValue = searchValue ?? internalSearchValue;
  const resolvedSearchPlaceholder = searchPlaceholder ?? tr("table.searchPlaceholder");

  useEffect(() => {
    if (!openFilterKey) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!filterPopoverRef.current?.contains(event.target as Node)) {
        setOpenFilterKey(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFilterKey(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openFilterKey]);

  useEffect(() => {
    if (!pageSizeOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        !pageSizePopupRef.current?.contains(event.target as Node) &&
        !pageSizeTriggerRef.current?.contains(event.target as Node)
      ) {
        setPageSizeOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPageSizeOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pageSizeOpen]);

  const searchedRows = useMemo(() => {
    if (!enableSearch || !resolvedSearchValue.trim()) return rows;
    const query = resolvedSearchValue.trim().toLowerCase();
    const fields = searchFields && searchFields.length > 0
      ? searchFields
      : Array.from(new Set([...headers.map((header) => header.key), ...Object.keys(rows[0] ?? {})]));

    return rows.filter((row) =>
      fields.some((field) => toComparableString(row[field]).toLowerCase().includes(query)),
    );
  }, [enableSearch, headers, resolvedSearchValue, rows, searchFields]);

  const filteredRows = useMemo(() => {
    return searchedRows.filter((row) => {
      for (const [key, value] of Object.entries(filters)) {
        const schema = filterSchema?.[key];
        if (!matchesFilterSchema(row, key, schema, value)) return false;
      }
      return true;
    });
  }, [filterSchema, filters, searchedRows]);

  const sortedRows = useMemo(() => {
    if (!sortState) return filteredRows;
    const config = sortConfigs?.[sortState.key];
    if (!config) return filteredRows;
    const directionMultiplier = sortState.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort((left, right) => {
      const leftValue = getFieldValue(left, sortState.key, config.field);
      const rightValue = getFieldValue(right, sortState.key, config.field);
      const comparison = config.type === TbleSortType.Number
        ? toNumber(leftValue) - toNumber(rightValue)
        : toComparableString(leftValue).localeCompare(toComparableString(rightValue));
      return comparison * directionMultiplier;
    });
  }, [filteredRows, sortConfigs, sortState]);

  const totalPages = useMemo(
    () => enablePagination ? Math.max(1, Math.ceil(sortedRows.length / currentPageSize)) : 1,
    [currentPageSize, enablePagination, sortedRows.length],
  );

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, resolvedSearchValue, sortState]);

  const rowsToRender = useMemo(() => {
    if (!enablePagination) return sortedRows;
    const startIdx = (currentPage - 1) * currentPageSize;
    return sortedRows.slice(startIdx, startIdx + currentPageSize);
  }, [currentPage, currentPageSize, enablePagination, sortedRows]);

  const filterCandidateValues = useMemo(() => {
    const collect = (schema: TbleFilterConfig | null | undefined, fallbackKey: string, path: string, out: Record<string, string[]>) => {
      if (!schema) return;
      if (schema.type === TbleFilterType.Select) {
        out[path] = Array.from(
          new Set(rows.map((row) => toComparableString(getFieldValue(row, fallbackKey, schema.field))).filter(Boolean)),
        ).sort((left, right) => left.localeCompare(right));
        return;
      }
      if (schema.type === TbleFilterType.Composite) {
        for (const [childKey, childSchema] of Object.entries(schema.filters)) {
          collect(childSchema, childKey, `${path}.${childKey}`, out);
        }
      }
    };

    const candidates: Record<string, string[]> = {};
    for (const [key, schema] of Object.entries(filterSchema ?? {})) {
      collect(schema, key, key, candidates);
    }
    return candidates;
  }, [filterSchema, rows]);

  const activeFilters = Object.entries(filters)
    .filter(([key, value]) => isFilterActive(filterSchema?.[key], value))
    .map(([key, value]) => ({
      key,
      label: headers.find((header) => header.key === key)?.header ?? key,
      schema: filterSchema?.[key],
      value,
    }));

  const getCellConfiguration = (key: string) => {
    const header = headers.find((h) => h.key === key);
    return {
      className: header?.align === "end"
        ? styles.alignEnd
        : header?.align === "center"
          ? styles.alignCenter
          : styles.alignStart,
      style: {
        width: toLength(header?.width),
        minWidth: toLength(header?.minWidth ?? header?.width),
        maxWidth: toLength(header?.maxWidth),
        ...header?.style,
      } satisfies CSSProperties,
    };
  };

  const setSearch = (value: string) => {
    if (onSearchChange) onSearchChange(value);
    else setInternalSearchValue(value);
  };

  const openFilter = (key: string) => {
    const schema = filterSchema?.[key];
    if (!schema) return;
    if (openFilterKey === key) {
      setOpenFilterKey(null);
      return;
    }
    setDraftFilterValue(filters[key] ?? getDefaultFilterState(schema));
    setFilterSearches({});
    setOpenFilterKey(key);
    const btn = filterButtonRefs.current[key];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const popupWidth = 384;
      const offset = 8;
      setFilterPopupPos({
        top: rect.bottom + offset,
        left: Math.max(offset, Math.min(rect.left, window.innerWidth - popupWidth - offset)),
      });
    }
  };

  const applyFilter = () => {
    if (!openFilterKey) return;
    const schema = filterSchema?.[openFilterKey];
    setFilters((prev) => {
      const next = { ...prev };
      if (isFilterActive(schema, draftFilterValue)) next[openFilterKey] = draftFilterValue;
      else delete next[openFilterKey];
      return next;
    });
    setOpenFilterKey(null);
  };

  const removeFilter = (key: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleSort = (key: string) => {
    if (!sortConfigs?.[key]) return;
    setSortState((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "desc" };
      if (prev.direction === "desc") return { key, direction: "asc" };
      return null;
    });
  };


  const renderFilterControl = (
    schema: TbleFilterConfig,
    value: FilterValue,
    setValue: (next: FilterValue) => void,
    fallbackKey: string,
    pathKey: string,
  ): ReactNode => {
    if (schema.type === TbleFilterType.Composite) {
      return (
        <div className={styles.compositeFilter}>
          {Object.entries(schema.filters).map(([childKey, childSchema]) => {
            if (!childSchema) return null;
            const childValue = isCompositeValue(value)
              ? value[childKey] ?? getDefaultFilterState(childSchema)
              : getDefaultFilterState(childSchema);
            return (
              <div key={`${pathKey}.${childKey}`} className={styles.compositeSection}>
                <div className={styles.compositeTitle}>{childKey}</div>
                {renderFilterControl(
                  childSchema,
                  childValue,
                  (next) => {
                    const compositeValue = isCompositeValue(value) ? value : {};
                    setValue({ ...compositeValue, [childKey]: next });
                  },
                  childKey,
                  `${pathKey}.${childKey}`,
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (schema.type === TbleFilterType.Range) {
      const rangeValue = isRangeValue(value) ? value : { min: undefined, max: undefined };
      const minLimit = schema.min ?? 0;
      const maxLimit = schema.max ?? 100;
      const step = schema.step ?? 1;
      const minValue = rangeValue.min ?? minLimit;
      const maxValue = rangeValue.max ?? maxLimit;

      const updateMin = (nextMin: number) => setValue({
        ...rangeValue,
        min: Math.min(nextMin, maxValue),
      });
      const updateMax = (nextMax: number) => setValue({
        ...rangeValue,
        max: Math.max(nextMax, minValue),
      });

      return (
        <div className={styles.rangeControl}>
          <div className={styles.rangeReadout}>
            <span>{minValue}</span>
            <span>{maxValue}</span>
          </div>
          <div className={styles.dualRangeSlider}>
            <div className={styles.sliderTrack}>
              <div
                className={styles.sliderRange}
                style={{
                  left: `${((minValue - minLimit) / (maxLimit - minLimit)) * 100}%`,
                  width: `${((maxValue - minValue) / (maxLimit - minLimit)) * 100}%`,
                }}
              />
            </div>
            <input
              type="range"
              className={styles.sliderThumb}
              min={minLimit}
              max={maxLimit}
              step={step}
              value={minValue}
              aria-label="Min"
              onChange={(event) => updateMin(Number(event.target.value))}
            />
            <input
              type="range"
              className={styles.sliderThumb}
              min={minLimit}
              max={maxLimit}
              step={step}
              value={maxValue}
              aria-label="Max"
              onChange={(event) => updateMax(Number(event.target.value))}
            />
          </div>
          {/* <div className={styles.rangeInputs}>
            <label>
              <span>Min</span>
              <input
                type="number"
                step={step}
                value={rangeValue.min ?? ""}
                placeholder={String(minLimit)}
                onChange={(event) => {
                  const next = event.target.value === "" ? undefined : Number(event.target.value);
                  setValue({ ...rangeValue, min: next });
                }}
              />
            </label>
            <label>
              <span>Max</span>
              <input
                type="number"
                step={step}
                value={rangeValue.max ?? ""}
                placeholder={String(maxLimit)}
                onChange={(event) => {
                  const next = event.target.value === "" ? undefined : Number(event.target.value);
                  setValue({ ...rangeValue, max: next });
                }}
              />
            </label>
          </div> */}
        </div>
      );
    }

    const selectedValues = Array.isArray(value) ? value : [];
    const query = filterSearches[pathKey] ?? "";
    const candidates = (filterCandidateValues[pathKey] ?? [])
      .filter((candidate) => candidate.toLowerCase().includes(query.trim().toLowerCase()));

    return (
      <div className={styles.selectFilter}>
        <label className={styles.filterSearchRow}>
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setFilterSearches((prev) => ({ ...prev, [pathKey]: event.target.value }))}
            placeholder={tr("table.searchPlaceholder")}
            aria-label={tr("table.searchPlaceholder")}
          />
        </label>
        <div className={styles.checkboxList}>
          {candidates.map((candidate) => (
            <label key={`${pathKey}-${candidate}`} className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={selectedValues.includes(candidate)}
                onChange={(event) => {
                  setValue(
                    event.target.checked
                      ? [...selectedValues, candidate]
                      : selectedValues.filter((entry) => entry !== candidate),
                  );
                }}
              />
              <span>{candidate}</span>
            </label>
          ))}
          {candidates.length === 0 && <div className={styles.emptyFilter}>No results</div>}
        </div>
      </div>
    );
  };

  const renderFilterPopover = () => {
    if (!openFilterKey) return null;
    const schema = filterSchema?.[openFilterKey];
    if (!schema) return null;
    const headerLabel = headers.find((header) => header.key === openFilterKey)?.header ?? openFilterKey;

    const popup = (
      <div ref={filterPopoverRef} className={styles.filterPopover} style={filterPopupPos} role="dialog" aria-label={tr("table.filterLabel", { column: headerLabel })}>
        <div className={styles.filterPopoverHeader}>
          <strong>{tr("table.filterLabel", { column: headerLabel })}</strong>
          <button type="button" aria-label={tr("common.cancel")} onClick={() => setOpenFilterKey(null)}>
            <X size={15} />
          </button>
        </div>
        {renderFilterControl(
          schema,
          draftFilterValue ?? getDefaultFilterState(schema),
          setDraftFilterValue,
          openFilterKey,
          openFilterKey,
        )}
        <div className={styles.filterActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => setDraftFilterValue(getDefaultFilterState(schema))}>
            Clear
          </button>
          <button type="button" className={styles.primaryButton} onClick={applyFilter}>
            {tr("table.apply")}
          </button>
        </div>
      </div>
    );

    const portalTarget = themeRef.current;
    return portalTarget ? createPortal(popup, portalTarget) : popup;
  };

  const hasHeader = Boolean(title || description || toolBar || enableSearch || activeFilters.length > 0);
  const containerClass = [
    styles.root,
    boxed ? styles.boxed : "",
    stickyHeader ? styles.sticky : "",
    className,
  ].filter(Boolean).join(" ");

  if (loading || rows.length === 0) {
    return (
      <section className={containerClass} style={{ marginTop }} aria-label={ariaLabel}>
        {hasHeader && (
          <TbleHeader
            title={title}
            description={description}
            enableSearch={enableSearch}
            searchValue={resolvedSearchValue}
            searchPlaceholder={resolvedSearchPlaceholder}
            onSearchChange={setSearch}
            toolBar={toolBar}
            activeFilters={activeFilters}
            removeFilter={removeFilter}
          />
        )}
        <div className={styles.state} style={{ minHeight: height ?? "18rem" }}>
          {loading ? tr("common.loading") : tr("common.noData")}
        </div>
      </section>
    );
  }

  return (
    <section className={containerClass} style={{ marginTop }} aria-label={ariaLabel}>
      {hasHeader && (
        <TbleHeader
          title={title}
          description={description}
          enableSearch={enableSearch}
          searchValue={resolvedSearchValue}
          searchPlaceholder={resolvedSearchPlaceholder}
          onSearchChange={setSearch}
          toolBar={toolBar}
          activeFilters={activeFilters}
          removeFilter={removeFilter}
        />
      )}
      <div className={styles.tableShell} style={{ height }}>
        {renderFilterPopover()}
        <table className={styles.table}>
          {!hideHeaders && (
            <thead>
              <tr>
                {headers.map((header) => {
                  const config = getCellConfiguration(header.key);
                  const sortable = Boolean(sortConfigs?.[header.key]);
                  const filterable = Boolean(filterSchema?.[header.key]);
                  const sortActive = sortState?.key === header.key;
                  return (
                    <th key={header.key} className={`${config.className} ${styles.headerCell}`} style={config.style} scope="col">
                      <div className={styles.headerInner}>
                        <button
                          type="button"
                          className={styles.headerButton}
                          disabled={!sortable}
                          onClick={() => toggleSort(header.key)}
                        >
                          {header.header}
                        </button>
                        {sortable && sortActive && (
                          sortState.direction === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                        )}
                        {filterable && (
                          <button
                            ref={(el) => { filterButtonRefs.current[header.key] = el; }}
                            type="button"
                            className={styles.filterButton}
                            aria-label={tr("table.filterLabel", { column: header.header })}
                            onClick={(event) => {
                              event.stopPropagation();
                              openFilter(header.key);
                            }}
                          >
                            <Filter size={13} />
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
          )}
          <tbody>
            {rowsToRender.map((row) => {
              const originalIndex = rows.findIndex((item) => item.id === row.id);
              return (
                <tr
                  key={row.id}
                  className={onRowClick ? styles.clickableRow : undefined}
                  onClick={onRowClick ? () => onRowClick(row, originalIndex) : undefined}
                >
                  {headers.map((header) => {
                    const config = getCellConfiguration(header.key);
                    const renderer = cellRenderers?.[header.key];
                    const value = renderer ? renderer(row[header.key], row, originalIndex) : row[header.key];
                    return (
                      <td key={`${row.id}-${header.key}`} className={config.className} style={config.style}>
                        {renderer ? (value as ReactNode) : isRenderableCellValue(value) ? value : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {enablePagination && (
        <div className={styles.pagination}>
          <span className={styles.paginationText}>
            {pageUnknown
              ? tr("table.page", { count: currentPage })
              : tr("table.pageRangeText", { count: currentPage, total: totalPages })}
          </span>
          <label className={styles.pageSizeControl}>
            <span>{tr("table.itemsPerPageText")}</span>
            <div className={styles.customSelect}>
              <button
                ref={pageSizeTriggerRef}
                type="button"
                className={styles.customSelectTrigger}
                onClick={() => {
                  if (!pageSizeOpen) {
                    const rect = pageSizeTriggerRef.current?.getBoundingClientRect();
                    if (rect) {
                      setPageSizePos({ top: rect.bottom + 4, left: Math.max(4, rect.left) });
                    }
                  }
                  setPageSizeOpen((prev) => !prev);
                }}
              >
                {currentPageSize}
                <ChevronDown size={13} />
              </button>
              {pageSizeOpen && (() => {
                const pageSizePopup = (
                  <div ref={pageSizePopupRef} className={styles.pageSizePopup} style={pageSizePos}>
                    {pageSizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={styles.pageSizeOption}
                        aria-selected={size === currentPageSize}
                        onClick={() => {
                          setCurrentPageSize(size);
                          setPageSizeOpen(false);
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                );
                const portalTarget = themeRef.current;
                return portalTarget ? createPortal(pageSizePopup, portalTarget) : pageSizePopup;
              })()}
            </div>
          </label>
          <div className={styles.pageButtons}>
            <button type="button" aria-label={tr("table.previousPage")} disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
              <ChevronLeft size={15} />
            </button>
            <button type="button" aria-label={tr("table.nextPage")} disabled={!pageUnknown && currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function TbleHeader({
  title,
  description,
  enableSearch,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  toolBar,
  activeFilters,
  removeFilter,
}: {
  title?: ReactNode;
  description?: ReactNode;
  enableSearch: boolean;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  toolBar?: ReactNode;
  activeFilters: Array<{ key: string; label: string; schema: TbleFilterConfig | null | undefined; value: FilterValue }>;
  removeFilter: (key: string) => void;
}) {
  return (
    <div className={styles.header}>
      {(title || description) && (
        <div className={styles.titleBlock}>
          {title && <strong>{title}</strong>}
          {description && <span>{description}</span>}
        </div>
      )}
      <div className={styles.toolbar}>
        {enableSearch && (
          <label className={styles.searchBox}>
            <Search size={15} />
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search table"
            />
          </label>
        )}
        {activeFilters.map((filter) => (
          <ChartTag
            key={filter.key}
            label={`${filter.label}: ${formatFilterValue(filter.schema, filter.value)}`}
            onDismiss={() => removeFilter(filter.key)}
            dismissLabel="Clear filter"
          />
        ))}
        {toolBar}
      </div>
    </div>
  );
}





