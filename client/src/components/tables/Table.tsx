import { useState, useRef, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { TableWrapper, type ActiveFilter } from './TableWrapper';
import type { ExportFormat } from '../charts/shared/ExportMenu';
import { DataTable, DataTableSkeleton, Table as CarbonTable, TableHead, TableRow, TableHeader, TableBody, TableCell, Pagination, Button, IconButton, Slider, Checkbox, CheckboxGroup, TableContainer, Tag } from "@carbon/react";
import { Filter } from "@carbon/react/icons";
import styles from './Table.module.scss';

/** Rich column header (min width / alignment) — same idea as `Tble` headers. */
export type TableColumnHeader =
    | string
    | {
        header: string;
        minWidth?: string | number;
        align?: 'start' | 'center' | 'end';
    };

export function tableHeaderLabel(h: TableColumnHeader): string {
    return typeof h === 'string' ? h : h.header;
}

function normalizeTableHeaders(headers: TableColumnHeader[]): {
    labels: string[];
    minWidths: (string | number | undefined)[];
    aligns: ('start' | 'center' | 'end' | undefined)[];
} {
    const labels: string[] = [];
    const minWidths: (string | number | undefined)[] = [];
    const aligns: ('start' | 'center' | 'end' | undefined)[] = [];
    for (const h of headers) {
        if (typeof h === 'string') {
            labels.push(h);
            minWidths.push(undefined);
            aligns.push(undefined);
        } else {
            labels.push(h.header);
            minWidths.push(h.minWidth);
            aligns.push(h.align);
        }
    }
    return { labels, minWidths, aligns };
}


type CellRenderer = (value: any, row: any[], rowIndex: number) => React.ReactNode;

export enum SortType {
    String = 'string',
    Date = 'date',
    Priority = 'priority',
    Number = 'number'
}

export enum FilterType {
    Select = 'select',
    Range = 'range',
    Date = 'date',
    Composite = 'composite'
}

export interface FilterSelectConfig {
    type: FilterType.Select;
    field?: string;
}

export interface FilterRangeConfig {
    type: FilterType.Range;
    field?: string;
    min?: number;
    max?: number;
    step?: number;
}

export interface FilterDateConfig {
    type: FilterType.Date;
    field?: string;
}

export interface FilterCompositeConfig {
    type: FilterType.Composite;
    filters: Record<string, FilterConfig | null>;
}

export interface FilterIgnoredConfig {
    type: null;
}

export type FilterConfig =
    | FilterSelectConfig
    | FilterRangeConfig
    | FilterDateConfig
    | FilterCompositeConfig
    | FilterIgnoredConfig;

interface FilterRangeValue {
    min?: number;
    max?: number;
}

interface FilterDateValue {
    from?: string;
    to?: string;
}

interface FilterCompositeState {
    [key: string]: string[] | FilterRangeValue | FilterDateValue | FilterCompositeState | null;
}

type FilterStateValue = string[] | FilterRangeValue | FilterDateValue | FilterCompositeState | null;

function isFilterRangeValue(value: FilterStateValue): value is FilterRangeValue {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        ("min" in value || "max" in value),
    );
}

function isFilterDateValue(value: FilterStateValue): value is FilterDateValue {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        ("from" in value || "to" in value),
    );
}

export interface SortConfig {
    type: SortType;
    priorityMap?: Record<string, number>;
    field?: string;
}

export interface ServerPaginationConfig {
    enabled: boolean;
    hasMore: boolean;
    isLoading?: boolean;
    onPageChange: (page: number) => void | boolean | Promise<void | boolean>;
}

export interface TableProps {
    title: string;
    headers: TableColumnHeader[];
    initialFilters: Partial<any>;
    fetcher: Promise<any>;
    filterSchema: Record<number, FilterConfig | null>;
    actions?: React.ReactNode;
    classnames?: string[];
    cellRenderers?: (CellRenderer | null)[];
    dataEntries?: any[][];
    isSortable?: boolean[];
    sortConfigs?: Record<number, SortConfig>;
    maxHeight?: number;
    /** Called when the user clicks a data row. Receives the original row array and its index inside dataEntries. */
    onRowClick?: (row: any[], rowIndex: number) => void;
    /** Optional row-level className callback for stateful row styling (e.g., selected row). */
    rowClassName?: (row: any[], rowIndex: number) => string | undefined;
    /** Enable CSV export menu in table header (default: true). */
    enableExport?: boolean;
    serverPagination?: ServerPaginationConfig;
    loading?: boolean;
}

function isEnabledFilterConfig(
    schema: FilterConfig | null,
): schema is Exclude<FilterConfig, FilterIgnoredConfig> {
    return Boolean(schema && schema.type !== null);
}

function getFilterTargetValue(
    rowValue: unknown,
    field?: string,
): unknown {
    if (
        field &&
        rowValue != null &&
        typeof rowValue === "object" &&
        !Array.isArray(rowValue) &&
        field in (rowValue as Record<string, unknown>)
    ) {
        return (rowValue as Record<string, unknown>)[field];
    }

    return rowValue;
}

function getSortTargetValue(
    rowValue: unknown,
    field?: string,
): unknown {
    return getFilterTargetValue(rowValue, field);
}

function getDefaultFilterState(schema: FilterConfig | null): FilterStateValue {
    if (!schema || schema.type === null) {
        return null;
    }

    switch (schema.type) {
        case FilterType.Select:
            return [];
        case FilterType.Range:
            return { min: schema.min, max: schema.max };
        case FilterType.Date:
            return { from: undefined, to: undefined };
        case FilterType.Composite:
            return Object.fromEntries(
                Object.entries(schema.filters).map(([key, childSchema]) => [
                    key,
                    getDefaultFilterState(childSchema),
                ]),
            );
        default:
            return null;
    }
}

function isFilterStateActive(
    schema: FilterConfig | null,
    value: FilterStateValue,
): boolean {
    if (!schema || schema.type === null || value == null) {
        return false;
    }

    switch (schema.type) {
        case FilterType.Select:
            return Array.isArray(value) && value.length > 0;
        case FilterType.Range: {
            if (!isFilterRangeValue(value)) {
                return false;
            }

            return (
                value.min !== undefined ||
                value.max !== undefined
            );
        }
        case FilterType.Date: {
            if (!isFilterDateValue(value)) {
                return false;
            }

            return value.from !== undefined || value.to !== undefined;
        }
        case FilterType.Composite:
            return Object.entries(schema.filters).some(([key, childSchema]) => {
                if (!isEnabledFilterConfig(childSchema)) {
                    return false;
                }

                return isFilterStateActive(childSchema, (value as Record<string, FilterStateValue | null>)[key] ?? null);
            });
        default:
            return false;
    }
}

function getFilterDisplayText(
    schema: FilterConfig | null,
    value: FilterStateValue,
): string {
    if (!schema || schema.type === null || value == null) {
        return "";
    }

    switch (schema.type) {
        case FilterType.Select:
            return Array.isArray(value) ? value.join(", ") : String(value);
        case FilterType.Range: {
            if (!isFilterRangeValue(value)) {
                return String(value);
            }

            if (value.min !== undefined && value.max !== undefined) {
                return `${value.min} - ${value.max}`;
            }

            if (value.min !== undefined) {
                return `≥ ${value.min}`;
            }

            if (value.max !== undefined) {
                return `≤ ${value.max}`;
            }

            return "";
        }
        case FilterType.Date: {
            if (!isFilterDateValue(value)) {
                return String(value);
            }

            if (value.from && value.to) {
                return `${value.from} - ${value.to}`;
            }

            if (value.from) {
                return `From ${value.from}`;
            }

            if (value.to) {
                return `To ${value.to}`;
            }

            return "";
        }
        case FilterType.Composite:
            return Object.entries(schema.filters)
                .map(([key, childSchema]) => {
                    if (!isEnabledFilterConfig(childSchema)) {
                        return "";
                    }

                    const childValue = (value as Record<string, FilterStateValue | null>)[key] ?? null;
                    const childDisplayText = getFilterDisplayText(childSchema, childValue);
                    return childDisplayText ? `${key}: ${childDisplayText}` : "";
                })
                .filter(Boolean)
                .join("; ");
        default:
            return String(value);
    }
}

function matchesFilterSchema(
    rowValue: unknown,
    schema: FilterConfig | null,
    value: FilterStateValue,
    fallbackField?: string,
): boolean {
    if (!schema || schema.type === null || value == null) {
        return true;
    }

    switch (schema.type) {
        case FilterType.Select: {
            const targetValue = getFilterTargetValue(rowValue, schema.field ?? fallbackField);
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    return true;
                }

                return value.includes(String(targetValue ?? ""));
            }

            return String(targetValue ?? "") === String(value);
        }
        case FilterType.Range: {
            const targetValue = getFilterTargetValue(rowValue, schema.field ?? fallbackField);
            const numericValue = Number(targetValue);
            const rangeValue = value;

            if (Number.isNaN(numericValue) || !isFilterRangeValue(rangeValue)) {
                return true;
            }

            if (rangeValue.min !== undefined && numericValue < rangeValue.min) {
                return false;
            }

            if (rangeValue.max !== undefined && numericValue > rangeValue.max) {
                return false;
            }

            return true;
        }
        case FilterType.Date: {
            const targetValue = getFilterTargetValue(rowValue, schema.field ?? fallbackField);
            const targetTime = new Date(String(targetValue ?? "")).getTime();
            const dateValue = value;

            if (Number.isNaN(targetTime) || !isFilterDateValue(dateValue)) {
                return true;
            }

            if (dateValue.from) {
                const fromTime = new Date(dateValue.from).getTime();
                if (!Number.isNaN(fromTime) && targetTime < fromTime) {
                    return false;
                }
            }

            if (dateValue.to) {
                const toTime = new Date(dateValue.to).getTime();
                if (!Number.isNaN(toTime) && targetTime > toTime) {
                    return false;
                }
            }

            return true;
        }
        case FilterType.Composite:
            return Object.entries(schema.filters).every(([key, childSchema]) => {
                if (!isEnabledFilterConfig(childSchema)) {
                    return true;
                }

                return matchesFilterSchema(
                    rowValue,
                    childSchema,
                    (value as Record<string, FilterStateValue | null>)[key] ?? null,
                    key,
                );
            });
        default:
            return true;
    }
}

function getFilterCandidateValues(
    dataEntries: any[][],
    columnIndex: number,
    schema: FilterConfig,
    fallbackField?: string,
): string[] {
    const values = new Set<string>();

    for (const row of dataEntries) {
        const targetValue = getFilterTargetValue(row[columnIndex], schema.type === FilterType.Select || schema.type === FilterType.Range ? schema.field ?? fallbackField : fallbackField);
        if (targetValue == null) {
            continue;
        }

        const normalized = String(targetValue);
        if (normalized.length > 0) {
            values.add(normalized);
        }
    }

    return Array.from(values).sort();
}

export const Table: React.FC<TableProps> = ({
    title,
    headers,
    initialFilters,
    filterSchema,
    actions,
    classnames = [],
    cellRenderers = [],
    dataEntries = [],
    isSortable = [],
    sortConfigs,
    maxHeight,
    onRowClick,
    rowClassName,
    enableExport = true,
    serverPagination,
    loading = false,
}) => {
    const { tr } = useLocalization();
    const { labels: headerLabels, minWidths: headerMinWidths, aligns: headerAligns } =
        normalizeTableHeaders(headers);

    const [clientPage, setClientPage] = useState(1);
    const [clientPageSize, setClientPageSize] = useState(20);
    // const [sortIndex, setSortIndex] = useState(0);
    const [searchValue, setSearchValue] = useState("");
    const [filters, setFilters] = useState<Partial<Record<number, FilterStateValue>>>(initialFilters);
    const [openFilterModal, setOpenFilterModal] = useState<number | null>(null);
    const [tempFilterValue, setTempFilterValue] = useState<FilterStateValue>(null);
    const [popupAlignment, setPopupAlignment] = useState<'left' | 'right'>('right');
    const [popupPosition, setPopupPosition] = useState<CSSProperties>({});
    const filterPopupRef = useRef<HTMLDivElement>(null);
    const filterButtonRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const { themeRef } = useUserTheme();

    const isServerPagination = Boolean(serverPagination?.enabled);
    // Pagination UI is always client-side; server mode only controls when to load more data.
    const page = clientPage;
    const pageSize = clientPageSize;

    // Handle click outside to close popup
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterPopupRef.current && !filterPopupRef.current.contains(event.target as Node)) {
                // Check if click is not on a filter button
                const target = event.target as HTMLElement;
                if (!target.closest('[data-filter-button]')) {
                    closeFilterModal();
                }
            }
        };

        if (openFilterModal !== null) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [openFilterModal]);

    useEffect(() => {
        if (openFilterModal === null) {
            setPopupPosition({});
            return;
        }

        const updatePopupPosition = () => {
            const buttonElement = filterButtonRefs.current[openFilterModal];

            if (!buttonElement) {
                return;
            }

            const buttonRect = buttonElement.getBoundingClientRect();
            const popupWidth = 380;
            const popupOffset = 12;
            const viewportWidth = window.innerWidth;
            const top = buttonRect.bottom + popupOffset;

            const alignLeft = viewportWidth - buttonRect.right < popupWidth;

            if (alignLeft) {
                const left = Math.max(
                    popupOffset,
                    Math.min(buttonRect.left, viewportWidth - popupWidth - popupOffset),
                );
                setPopupAlignment('left');
                setPopupPosition({ top, left });
                return;
            }

            const right = Math.max(popupOffset, viewportWidth - buttonRect.right);
            setPopupAlignment('right');
            setPopupPosition({ top, right });
        };

        updatePopupPosition();
        window.addEventListener('resize', updatePopupPosition);
        window.addEventListener('scroll', updatePopupPosition, true);

        return () => {
            window.removeEventListener('resize', updatePopupPosition);
            window.removeEventListener('scroll', updatePopupPosition, true);
        };
    }, [openFilterModal]);

    /**
     * Open filter modal for specific column
     */
    const openFilterForColumn = (columnIndex: number) => {
        const buttonElement = filterButtonRefs.current[columnIndex];
        if (buttonElement) {
            const buttonRect = buttonElement.getBoundingClientRect();
            const popupWidth = 380;
            const popupOffset = 12;
            const viewportWidth = window.innerWidth;

            const alignLeft = viewportWidth - buttonRect.right < popupWidth;

            if (alignLeft) {
                const left = Math.max(
                    popupOffset,
                    Math.min(buttonRect.left, viewportWidth - popupWidth - popupOffset),
                );
                setPopupAlignment('left');
                setPopupPosition({ top: buttonRect.bottom + popupOffset, left });
            } else {
                const right = Math.max(popupOffset, viewportWidth - buttonRect.right);
                setPopupAlignment('right');
                setPopupPosition({ top: buttonRect.bottom + popupOffset, right });
            }
        }
        setOpenFilterModal(columnIndex);
        const schema = filterSchema[columnIndex];
        setTempFilterValue(filters[columnIndex] ?? getDefaultFilterState(schema ?? null));
    };

    /**
     * Close filter modal
     */
    const closeFilterModal = () => {
        setOpenFilterModal(null);
        setTempFilterValue(null);
    };

    /**
     * Apply filter from modal
     */
    const applyFilter = (columnIndex: number) => {
        const schema = filterSchema[columnIndex];
        if (!isEnabledFilterConfig(schema)) {
            setClientPage(1);
            closeFilterModal();
            return;
        }

        if (schema.type === FilterType.Select) {
            if (Array.isArray(tempFilterValue) && tempFilterValue.length > 0) {
                setFilters(prev => ({
                    ...prev,
                    [columnIndex]: tempFilterValue
                }));
            } else {
                // Remove filter if no items selected
                setFilters(prev => {
                    const newFilters = { ...prev };
                    delete newFilters[columnIndex];
                    return newFilters;
                });
            }
        } else if (schema.type === FilterType.Range) {
            if (isFilterRangeValue(tempFilterValue)) {
                setFilters(prev => ({
                    ...prev,
                    [columnIndex]: tempFilterValue
                }));
            } else {
                setFilters(prev => {
                    const newFilters = { ...prev };
                    delete newFilters[columnIndex];
                    return newFilters;
                });
            }
        } else if (schema.type === FilterType.Composite) {
            if (isFilterStateActive(schema, tempFilterValue)) {
                setFilters(prev => ({
                    ...prev,
                    [columnIndex]: tempFilterValue
                }));
            } else {
                setFilters(prev => {
                    const newFilters = { ...prev };
                    delete newFilters[columnIndex];
                    return newFilters;
                });
            }
        } else if (tempFilterValue !== null && tempFilterValue !== undefined) {
            setFilters(prev => ({
                ...prev,
                [columnIndex]: tempFilterValue
            }));
        }
        setClientPage(1);
        closeFilterModal();
    };

    /**
     * Remove specific filter
     */
    const removeFilter = (columnIndex: number) => {
        setFilters(prev => {
            const newFilters = { ...prev };
            delete newFilters[columnIndex];
            return newFilters;
        });
        setClientPage(1);
    };

    /**
     * Generate active filters for display
     */
    const getActiveFilters = (): ActiveFilter[] => {
        const active: ActiveFilter[] = [];

        Object.entries(filters).forEach(([columnIndex, filterValue]) => {
            const colIdx = parseInt(columnIndex);
            const schema = filterSchema[colIdx];
            const columnName = headerLabels[colIdx] || `Column ${colIdx}`;
            const resolvedFilterValue = (filterValue ?? null) as FilterStateValue;

            if (!isEnabledFilterConfig(schema) || !isFilterStateActive(schema, resolvedFilterValue)) return;

            const displayText = getFilterDisplayText(schema, resolvedFilterValue);

            if (displayText && !(Array.isArray(resolvedFilterValue) && resolvedFilterValue.length === 0)) {
                active.push({
                    columnIndex: colIdx,
                    columnName,
                    value: resolvedFilterValue,
                    displayText
                });
            }
        });

        return active;
    };

    // Apply search and filter to data
    const filteredData = dataEntries.filter(row => {
        // Apply search filter
        if (searchValue) {
            const matchesSearch = row.some(cell => {
                const cellValue = String(cell).toLowerCase();
                return cellValue.includes(searchValue.toLowerCase());
            });
            if (!matchesSearch) return false;
        }

        // Apply column filters
        if (filterSchema && Object.keys(filters).length > 0) {
            for (const [columnIndex, filterValue] of Object.entries(filters)) {
                const colIdx = parseInt(columnIndex);
                const schema = filterSchema[colIdx];
                const resolvedFilterValue = (filterValue ?? null) as FilterStateValue;

                if (!isEnabledFilterConfig(schema)) continue;

                if (!matchesFilterSchema(row[colIdx], schema, resolvedFilterValue)) {
                    return false;
                }
            }
        }

        return true;
    });

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    const paginatedRows = filteredData.slice(start, end);
    const maxLoadedClientPage = Math.max(1, Math.ceil(filteredData.length / pageSize));

    useEffect(() => {
        if (clientPage > maxLoadedClientPage) {
            setClientPage(maxLoadedClientPage);
        }
    }, [clientPage, maxLoadedClientPage]);


    /**
     * Handle export functionality
     */
    const handleExport = async (format: ExportFormat) => {
        if (format === 'csv') {
            // Export as CSV (filtered data)
            const csvHeaders = headerLabels.join(',');
            const csvRows = filteredData.map(row =>
                row.map(entry =>
                    typeof entry === 'string' ? `"${entry.replace(/"/g, '""')}"` : entry
                ).join(',')
            );
            const csvContent = [csvHeaders, ...csvRows].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `table-export-${Date.now()}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        }
    };

    // Transform headers for Carbon DataTable
    const carbonHeaders = headerLabels.map((label, index) => ({
        key: `header-${index}`,
        header: label,
        index: index,
        sortConfig: sortConfigs?.[index],
        isSortable: !!sortConfigs?.[index],
        minWidth: headerMinWidths[index],
        align: headerAligns[index],
    }));
    const skeletonHeaders = carbonHeaders.map(({ key, header }) => ({ key, header }));

    const rows = paginatedRows.map((row, rowIndex) => {
        const rowData: any = { id: `row-${page}-${rowIndex}` };
        row.forEach((entry, index) => {
            // Store raw data for sorting
            rowData[`header-${index}`] = entry;
        });
        return rowData;
    });

    const toRenderableCellValue = (value: unknown): string | number | boolean => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }

        if (value == null) {
            return '';
        }

        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    };

    /**  
    * Handle custom sorts
    */
    const universalSortRow = (
        cellA: any,
        cellB: any,
        { key, sortDirection, sortStates, locale }: any
    ) => {
        // Guard against undefined key
        if (!key) {
            console.log("key not found / undefined");
            return String(cellA).localeCompare(String(cellB), locale);
        }

        // Find the config for the current column
        const colIndex = parseInt(key.split('-')[1], 10);
        const columnConfig = sortConfigs?.[colIndex];

        let comparison = 0;

        if (!columnConfig) {
            console.log("columnConfig not found / undefined");
            return String(cellA).localeCompare(String(cellB), locale);
        }

        const sortTargetField = columnConfig.field;
        const sortValueA = getSortTargetValue(cellA, sortTargetField);
        const sortValueB = getSortTargetValue(cellB, sortTargetField);

        // 1. Dynamic Logic Selection
        switch (columnConfig.type) {
            case SortType.Priority:
                console.log("priority");
                const map = columnConfig.priorityMap || {};
                comparison = (map[sortValueA as any] ?? 99) - (map[sortValueB as any] ?? 99);
                break;
            case SortType.Date:
                console.log("date");
                const dateA = new Date(sortValueA as any).getTime();
                const dateB = new Date(sortValueB as any).getTime();
                console.log(`cellA: ${sortValueA} - ${dateA}; cellB: ${sortValueB} - ${dateB}`);
                // Handle invalid dates
                if (isNaN(dateA) && isNaN(dateB)) comparison = 0;
                else if (isNaN(dateA)) comparison = 1;
                else if (isNaN(dateB)) comparison = -1;
                else comparison = dateA - dateB;
                break;
            case SortType.Number:
                console.log("number");
                comparison = Number(sortValueA) - Number(sortValueB);
                break;
            default:
                console.log("default");
                comparison = String(sortValueA ?? "").localeCompare(String(sortValueB ?? ""), locale);
        }
        // 3. Apply Directionality
        return sortDirection === sortStates.DESC ? comparison * -1 : comparison;
    };

    /**
     * Render filter popup for specific column index
     */
    const renderFilterControl = (
        schema: FilterConfig,
        value: FilterStateValue,
        setValue: (nextValue: FilterStateValue) => void,
        columnIndex: number,
        keyPath?: string,
    ): React.ReactNode => {
        if (schema.type === null) {
            return null;
        }

        if (schema.type === FilterType.Composite) {
            const compositeValue =
                value && typeof value === "object" && !Array.isArray(value)
                    ? value
                    : {};

            return (
                <div className={styles.filterPopupContentGrid}>
                    {Object.entries(schema.filters).map(([childKey, childSchema]) => {
                        if (!isEnabledFilterConfig(childSchema)) {
                            return null;
                        }

                        const childValue =
                            (compositeValue as Record<string, FilterStateValue | null>)[childKey] ??
                            getDefaultFilterState(childSchema);

                        const itemClass = [
                            styles.filterPopupItem,
                            childSchema.type === FilterType.Range ? styles.filterPopupItemRange : '',
                            childSchema.type === FilterType.Select ? styles.filterPopupItemSelect : '',
                            childSchema.type === FilterType.Date ? styles.filterPopupItemDate : '',
                        ].filter(Boolean).join(' ');

                        return (
                            <div key={`${columnIndex}-${keyPath ?? "root"}-${childKey}`} className={itemClass}>
                                <div className={styles.filterPopupHeader}>
                                    {childKey}
                                </div>
                                {renderFilterControl(
                                    childSchema,
                                    childValue,
                                    (nextValue) => {
                                        setValue({
                                            ...(compositeValue as Record<string, FilterStateValue | null>),
                                            [childKey]: nextValue,
                                        });
                                    },
                                    columnIndex,
                                    childKey,
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (schema.type === FilterType.Range) {
            const rangeValue =
                isFilterRangeValue(value)
                    ? value
                    : getDefaultFilterState(schema);
            const resolvedRangeValue = rangeValue as FilterRangeValue | null;

            return (
                <Slider
                    ariaLabelInput="Minimum Value"
                    unstable_ariaLabelInputUpper="Maximum Value"
                    value={resolvedRangeValue?.min ?? schema.min ?? 0}
                    unstable_valueUpper={resolvedRangeValue?.max ?? schema.max ?? 100}
                    min={schema.min ?? 0}
                    max={schema.max ?? 100}
                    step={schema.step ?? 1}
                    stepMultiplier={10}
                    hideTextInput={true}
                    onChange={(nextValue: any) => {
                        setValue({
                            ...(resolvedRangeValue ?? {}),
                            min: nextValue.value,
                            max: nextValue.valueUpper,
                        });
                    }}
                />
            );
        }

        if (schema.type === FilterType.Date) {
            const dateValue =
                isFilterDateValue(value)
                    ? value
                    : getDefaultFilterState(schema);
            const resolvedDateValue = dateValue as FilterDateValue | null;

            return (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                        <span>{tr("table.from")}</span>
                        <input
                            type="date"
                            value={resolvedDateValue?.from ?? ""}
                            onChange={(event) => {
                                setValue({
                                    ...(resolvedDateValue ?? {}),
                                    from: event.target.value || undefined,
                                });
                            }}
                        />
                    </label>
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                        <span>{tr("table.to")}</span>
                        <input
                            type="date"
                            value={resolvedDateValue?.to ?? ""}
                            onChange={(event) => {
                                setValue({
                                    ...(resolvedDateValue ?? {}),
                                    to: event.target.value || undefined,
                                });
                            }}
                        />
                    </label>
                </div>
            );
        }

        const selectedValues = Array.isArray(value) ? value : [];
        const candidateValues = getFilterCandidateValues(
            dataEntries,
            columnIndex,
            schema,
            keyPath,
        );
        const allSelected =
            candidateValues.length > 0 &&
            candidateValues.every((candidate) => selectedValues.includes(candidate));
        const indeterminate =
            selectedValues.length > 0 &&
            candidateValues.some((candidate) => selectedValues.includes(candidate)) &&
            !allSelected;

        return (
            <CheckboxGroup legendText="">
                <Checkbox
                    id={`filter-checkbox-${columnIndex}-${keyPath ?? "root"}-select-all`}
                    labelText={tr("table.selectAll")}
                    checked={allSelected}
                    indeterminate={indeterminate}
                    onChange={(_event: unknown, { checked }: { checked: boolean }) => {
                        setValue(checked ? candidateValues : []);
                    }}
                />
                {candidateValues.map((candidateValue) => (
                    <Checkbox
                        key={candidateValue}
                        id={`filter-checkbox-${columnIndex}-${keyPath ?? "root"}-${candidateValue}`}
                        labelText={candidateValue}
                        checked={selectedValues.includes(candidateValue)}
                        onChange={(_event: unknown, { checked }: { checked: boolean }) => {
                            const currentValues = Array.isArray(value) ? [...value] : [];
                            if (checked) {
                                setValue([...currentValues, candidateValue]);
                            } else {
                                setValue(currentValues.filter((candidate) => candidate !== candidateValue));
                            }
                        }}
                    />
                ))}
            </CheckboxGroup>
        );
    };

    const renderFilterPopup = () => {
        if (openFilterModal === null) return null;

        const schema = filterSchema[openFilterModal];
        const columnHeader = headerLabels[openFilterModal] || `Column ${openFilterModal}`;

        if (!isEnabledFilterConfig(schema)) return null;

        const popupValue = tempFilterValue ?? getDefaultFilterState(schema);
        const popup = (
            <div
                className={`${styles.filterPopup} ${popupAlignment === 'left' ? styles.filterPopupLeft : styles.filterPopupRight}`}
                ref={filterPopupRef}
                style={popupPosition}
            >
                <div className={styles.filterPopupContent}>
                    <div className={styles.filterPopupTitle}>
                        {tr("table.filterLabel", { column: columnHeader })}
                    </div>
                    {renderFilterControl(
                        schema,
                        popupValue,
                        setTempFilterValue,
                        openFilterModal,
                    )}
                    <div className={styles.filterPopupActions}>
                        <Button
                            kind="secondary"
                            size="sm"
                            onClick={closeFilterModal}
                        >
                            {tr("common.cancel")}
                        </Button>
                        <Button
                            kind="primary"
                            size="sm"
                            onClick={() => applyFilter(openFilterModal)}
                        >
                            {tr("table.apply")}
                        </Button>
                    </div>
                </div>
            </div>
        );

        const portalTarget = themeRef.current;
        return portalTarget ? createPortal(popup, portalTarget) : popup;
    };

    const paginationTotalItems = isServerPagination
        ? serverPagination?.hasMore
            // Keep exactly one extra "virtual" page available to trigger load-more.
            ? Math.max(1, Math.ceil(filteredData.length / pageSize)) * pageSize + 1
            : filteredData.length
        : filteredData.length;

    return (
        <TableWrapper
            title={title}
            actions={actions}
            onExport={handleExport}
            enableExport={enableExport}
            isEmpty={!loading && filteredData.length === 0}
            enableToolbar={true}
            searchValue={searchValue}
            onSearchChange={(value) => {
                setSearchValue(value);
                setClientPage(1);
            }}
        >
            <div className={styles.tableWrapper}>
                <div ref={tableContainerRef} className={styles.tableViewport}>
                    {loading ? (
                        <DataTableSkeleton
                            headers={skeletonHeaders}
                            rowCount={3}
                            showHeader={false}
                            showToolbar={false}
                        />
                    ) : (
                        <DataTable
                            rows={rows}
                            headers={carbonHeaders}
                            sortRow={universalSortRow}
                        >
                            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                                <TableContainer
                                    className={styles.tableContainer}
                                    style={maxHeight ? { maxHeight: `${maxHeight}px` } : undefined}
                                >
                                    {getActiveFilters().length > 0 && (
                                        <div className={styles.activeFilters}>
                                            {getActiveFilters().map((filter) => (
                                                <Tag
                                                    key={filter.columnIndex}
                                                    type="blue"
                                                    filter
                                                    onClose={() => removeFilter(filter.columnIndex)}
                                                    title={`Filter: ${filter.columnName} = ${filter.displayText}`}
                                                >
                                                    {filter.columnName}: {filter.displayText}
                                                </Tag>
                                            ))}
                                        </div>
                                    )}
                                    <CarbonTable {...getTableProps()} className={styles.stretchTable}>
                                        <TableHead>
                                            <TableRow className={styles.stickyHeader}>
                                                {headers.map((header, index) => {
                                                    const isColumnSortable = isSortable[index] ?? false;
                                                    const h = header as {
                                                        key: string;
                                                        header: string;
                                                        minWidth?: string | number;
                                                        align?: 'start' | 'center' | 'end';
                                                    };
                                                    const { key, className: carbonThClass, style: carbonThStyle, ...headerPropsRest } = getHeaderProps({
                                                        header,
                                                        isSortable: isColumnSortable
                                                    });
                                                    const activeFilter = getActiveFilters().find(f => f.columnIndex === index);
                                                    const thExtra: CSSProperties = {};
                                                    if (h.minWidth != null) {
                                                        thExtra.minWidth = h.minWidth;
                                                    }
                                                    const alignClass =
                                                        h.align === 'end'
                                                            ? styles.headerThAlignEnd
                                                            : h.align === 'center'
                                                                ? styles.headerThAlignCenter
                                                                : h.align === 'start'
                                                                    ? styles.headerThAlignStart
                                                                    : undefined;
                                                    return (
                                                        <TableHeader
                                                            key={key}
                                                            {...headerPropsRest}
                                                            className={[
                                                                carbonThClass,
                                                                isColumnSortable ? styles.sortableHeader : '',
                                                                styles.tableHeaderThFull,
                                                                alignClass,
                                                            ].filter(Boolean).join(' ')}
                                                            style={{ ...(carbonThStyle as CSSProperties | undefined), ...thExtra }}
                                                            title={typeof h.header === 'string' ? h.header : undefined}
                                                        >
                                                            <div className={styles.headerContent}>
                                                                <span className={styles.headerText}>
                                                                    {header.header}
                                                                </span>
                                                                {filterSchema[index] && (
                                                                    <div
                                                                        className={styles.headerCell}
                                                                        ref={(el) => { filterButtonRefs.current[index] = el; }}
                                                                    >
                                                                        <div
                                                                            aria-label={activeFilter ? `Filter: ${activeFilter.displayText}` : `Filter ${header.header}`}
                                                                            role="button"
                                                                            tabIndex={0}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                openFilterForColumn(index);
                                                                            }}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                                    e.stopPropagation();
                                                                                    openFilterForColumn(index);
                                                                                }
                                                                            }}
                                                                            className={[
                                                                                'cds--btn cds--btn--ghost cds--btn--sm cds--btn--icon-only',
                                                                                activeFilter ? styles.activeFilterButton : '',
                                                                                styles.headerFilterTrigger
                                                                            ].filter(Boolean).join(' ')}
                                                                            data-filter-button
                                                                        >
                                                                            <Filter />
                                                                        </div>

                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableHeader>
                                                    );
                                                })}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {rows.map((row, rowIndex) => {
                                                const { key, ...rowProps } = getRowProps({ row });
                                                const rowId = String(row.id ?? "");
                                                const parsedRowIndex = Number.parseInt(rowId.split("-").pop() ?? "", 10);
                                                const originalRow = Number.isInteger(parsedRowIndex)
                                                    ? paginatedRows[parsedRowIndex]
                                                    : paginatedRows[rowIndex];
                                                const safeRow = Array.isArray(originalRow) ? originalRow : [];
                                                const originalIndex = onRowClick
                                                    ? dataEntries.indexOf(originalRow)
                                                    : -1;
                                                const resolvedRowClass = rowClassName
                                                    ? rowClassName(safeRow, originalIndex)
                                                    : undefined;
                                                return (
                                                    <TableRow
                                                        key={key}
                                                        {...rowProps}
                                                        onClick={onRowClick ? () => onRowClick(safeRow, originalIndex) : undefined}
                                                        className={[rowProps.className, resolvedRowClass].filter(Boolean).join(' ')}
                                                        style={onRowClick ? { cursor: 'pointer' } : undefined}
                                                    >
                                                        {row.cells.map((cell, cellIndex) => {
                                                            const rawValue = cell.value;
                                                            const renderer = cellRenderers[cellIndex];
                                                            const className = classnames[cellIndex];

                                                            return (
                                                                <TableCell key={cell.id}>
                                                                    {renderer
                                                                        ? renderer(rawValue, safeRow, rowIndex)
                                                                        : <span className={className}>{toRenderableCellValue(rawValue)}</span>
                                                                    }
                                                                </TableCell>
                                                            );
                                                        })}
                                                    </TableRow>
                                                );
                                            })}

                                            {rows.length === 0 && (
                                                <TableRow className={styles.noHover}>
                                                    <TableCell colSpan={headers.length} style={{ textAlign: 'center', padding: '2rem' }}>
                                                        <div style={{ minHeight: '222px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {tr("common.noData")}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </CarbonTable>
                                </TableContainer>
                            )}
                        </DataTable>
                    )}
                </div>
                {renderFilterPopup()}
                {/* <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }} ref={tableContainerRef}>
                </div> */}
                <div className={styles.paginationContainer}>
                    <Pagination
                        page={page}
                        pageSize={pageSize}
                        pageSizes={[20, 30, 40, 50]}
                        totalItems={paginationTotalItems}
                        itemsPerPageText={tr("table.itemsPerPageText")}
                        pageRangeText={(current, total) => tr("table.pageRangeText", { count: current, total })}
                        itemRangeText={(min, max, total) => tr("table.itemRangeText", { min, max, count: total })}
                        forwardText={tr("table.nextPage")}
                        backwardText={tr("table.previousPage")}
                        onChange={({ page: nextPage, pageSize: nextPageSize }) => {
                            if (isServerPagination) {
                                if (serverPagination?.isLoading) {
                                    return;
                                }

                                if (nextPageSize !== pageSize) {
                                    setClientPageSize(nextPageSize);
                                    const resizedMaxPage = Math.max(1, Math.ceil(filteredData.length / nextPageSize));
                                    setClientPage(Math.min(nextPage, resizedMaxPage));
                                    return;
                                }

                                if (nextPage <= maxLoadedClientPage) {
                                    setClientPage(nextPage);
                                    return;
                                }

                                const requestingLoadMorePage =
                                    page === maxLoadedClientPage &&
                                    nextPage === page + 1;
                                if (requestingLoadMorePage && serverPagination?.hasMore) {
                                    void (async () => {
                                        try {
                                            const didLoad = await serverPagination.onPageChange(nextPage);
                                            if (didLoad === false) {
                                                return;
                                            }
                                            setClientPage(nextPage);
                                        } catch {
                                            // Parent handles error reporting and loading state.
                                        }
                                    })();
                                }
                                return;
                            }

                            setClientPage(nextPage);
                            setClientPageSize(nextPageSize);
                        }}
                    />
                </div>
            </div>
        </TableWrapper>
    );
}

