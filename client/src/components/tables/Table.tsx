import { useState, useRef, useEffect } from "react";
import { TableWrapper, type ActiveFilter } from '../charts/shared/TableWrapper';
import type { ExportFormat } from '../charts/shared/ExportMenu';
import { DataTable, Table as CarbonTable, TableHead, TableRow, TableHeader, TableBody, TableCell, Pagination, Button, IconButton, Slider, Checkbox, CheckboxGroup, TableContainer } from "@carbon/react";
import { Filter } from "@carbon/react/icons";
import styles from './Table.module.scss';


type CellRenderer = (value: any, row: any[], rowIndex: number) => React.ReactNode;

export enum SortType {
    String = 'string',
    Date = 'date',
    Priority = 'priority',
    Number = 'number'
}

export enum FilterType {
    Select = 'select',
    Range = 'range'
}

export interface FilterConfig {
    type: FilterType;
    min?: number;
    max?: number;
    step?: number;
}

export interface SortConfig {
    type: SortType;
    priorityMap?: Record<string, number>;
}

export interface TableProps {
    title: string;
    headers: string[];
    initialFilters: Partial<any>;
    fetcher: Promise<any>;
    filterSchema: Record<number, FilterConfig>;
    classnames?: string[];
    cellRenderers?: (CellRenderer | null)[];
    dataEntries?: any[][];
    isSortable?: boolean[];
    sortConfigs?: Record<number, SortConfig>; 
}

export const Table: React.FC<TableProps> = ({
    title,
    headers,
    initialFilters,
    filterSchema,
    classnames = [],
    cellRenderers = [],
    dataEntries = [],
    isSortable = [],
    sortConfigs
}) => {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortIndex, setSortIndex] = useState(0);
    const [searchValue, setSearchValue] = useState("");
    const [filters, setFilters] = useState<Partial<any>>(initialFilters);
    const [openFilterModal, setOpenFilterModal] = useState<number | null>(null);
    const [tempFilterValue, setTempFilterValue] = useState<any>(null);
    const [popupAlignment, setPopupAlignment] = useState<'left' | 'right'>('right');
    const filterPopupRef = useRef<HTMLDivElement>(null);
    const filterButtonRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
    const tableContainerRef = useRef<HTMLDivElement>(null);

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

    /**
     * Open filter modal for specific column
     */
    const openFilterForColumn = (columnIndex: number) => {
        const buttonElement = filterButtonRefs.current[columnIndex];
        const tableContainer = tableContainerRef.current;
        
        if (buttonElement && tableContainer) {
            const buttonRect = buttonElement.getBoundingClientRect();
            const tableRect = tableContainer.getBoundingClientRect();
            const popupWidth = 280; // min-width from CSS, risky value
            const spaceFromTableStart = buttonRect.right - tableRect.left;
            
            // If not enough space from table start to button right, align to left
            setPopupAlignment(spaceFromTableStart < popupWidth ? 'left' : 'right');
        }
        setOpenFilterModal(columnIndex);
        // Initialize with existing filter or empty array for Select type
        const schema = filterSchema[columnIndex];
        if (schema?.type === FilterType.Select) {
            setTempFilterValue(filters[columnIndex] || []);
        } else {
            setTempFilterValue(filters[columnIndex] || null);
        }
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
        // For Select type, only apply if array has items
        if (schema?.type === FilterType.Select) {
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
        } else if (tempFilterValue !== null && tempFilterValue !== undefined) {
            setFilters(prev => ({
                ...prev,
                [columnIndex]: tempFilterValue
            }));
        }
        setPage(1);
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
        setPage(1);
    };

    /**
     * Generate active filters for display
     */
    const getActiveFilters = (): ActiveFilter[] => {
        const active: ActiveFilter[] = [];
        
        Object.entries(filters).forEach(([columnIndex, filterValue]) => {
            const colIdx = parseInt(columnIndex);
            const schema = filterSchema[colIdx];
            const columnName = headers[colIdx] || `Column ${colIdx}`;
            
            if (!schema || !filterValue) return;
            
            let displayText = '';
            
            if (schema.type === FilterType.Range) {
                const rangeFilter = filterValue as { min?: number; max?: number };
                if (rangeFilter.min !== undefined && rangeFilter.max !== undefined) {
                    displayText = `${rangeFilter.min} - ${rangeFilter.max}`;
                } else if (rangeFilter.min !== undefined) {
                    displayText = `≥ ${rangeFilter.min}`;
                } else if (rangeFilter.max !== undefined) {
                    displayText = `≤ ${rangeFilter.max}`;
                }
            } else if (Array.isArray(filterValue)) {
                displayText = filterValue.join(', ');
            } else {
                displayText = String(filterValue);
            }
            
            if (displayText && filterValue !== 'all' && !(Array.isArray(filterValue) && filterValue.length === 0)) {
                active.push({
                    columnIndex: colIdx,
                    columnName,
                    value: filterValue,
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
                
                if (!schema) continue;

                if (schema.type === FilterType.Range) {
                    // Handle range filter
                    const numValue = Number(row[colIdx]);
                    if (isNaN(numValue)) continue;
                    
                    const rangeFilter = filterValue as { min?: number; max?: number };
                    if (!rangeFilter) continue;
                    
                    if (rangeFilter.min !== undefined && numValue < rangeFilter.min) {
                        return false;
                    }
                    if (rangeFilter.max !== undefined && numValue > rangeFilter.max) {
                        return false;
                    }
                } else {
                    // Handle select filter (multi-select with OR logic)
                    if (Array.isArray(filterValue) && filterValue.length > 0) {
                        const cellValue = String(row[colIdx]);
                        if (!filterValue.includes(cellValue)) {
                            return false;
                        }
                    } else if (filterValue && filterValue !== 'all') {
                        const cellValue = String(row[colIdx]);
                        if (cellValue !== filterValue) {
                            return false;
                        }
                    }
                }
            }
        }
        
        return true;
    });

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    const paginatedRows = filteredData.slice(start, end);


    /**
     * Handle export functionality
     */
    const handleExport = async (format: ExportFormat) => {
        if (format === 'csv') {
            // Export as CSV (filtered data)
            const csvHeaders = headers.join(',');
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
    const carbonHeaders = headers.map((header, index) => ({
        key: `header-${index}`,
        header: header,
        index: index,
        sortConfig: sortConfigs?.[index], // Attach config to the header
        isSortable: !!sortConfigs?.[index] // Only enable sort if config exists
    }));

    const rows = paginatedRows.map((row, rowIndex) => {
        const rowData: any = { id: `row-${rowIndex}` };
        row.forEach((entry, index) => {
            // Store raw data for sorting
            rowData[`header-${index}`] = entry; 
        });
        return rowData;
    });

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

        // 1. Dynamic Logic Selection
        switch (columnConfig.type) {
            case SortType.Priority:
                console.log("priority");
                const map = columnConfig.priorityMap || {};
                comparison = (map[cellA] ?? 99) - (map[cellB] ?? 99);
                break;
            case SortType.Date:
                console.log("date");
                const dateA = new Date(cellA).getTime();
                const dateB = new Date(cellB).getTime();
                console.log(`cellA: ${cellA} - ${dateA}; cellB: ${cellB} - ${dateB}`);
                // Handle invalid dates
                if (isNaN(dateA) && isNaN(dateB)) comparison = 0;
                else if (isNaN(dateA)) comparison = 1;
                else if (isNaN(dateB)) comparison = -1;
                else comparison = dateA - dateB;
                break;
            case SortType.Number:
                console.log("number");
                comparison = Number(cellA) - Number(cellB);
                break;
            default:
                console.log("default");
                comparison = String(cellA).localeCompare(String(cellB), locale);
        }
        // 3. Apply Directionality
        return sortDirection === sortStates.DESC ? comparison * -1 : comparison;
    };

    /**
     * Render filter popup for specific column index
     */
    const renderFilterPopup = (columnIndex: number) => {
        if (openFilterModal !== columnIndex) return null;
        
        const schema = filterSchema[columnIndex];
        const columnHeader = headers[columnIndex] || `Column ${columnIndex}`;
        
        if (!schema) return null;

        return (
            <div 
                className={`${styles.filterPopup} ${popupAlignment === 'left' ? styles.filterPopupLeft : styles.filterPopupRight}`} 
                ref={filterPopupRef}
            >
                <div className={styles.filterPopupContent}>
                    <div className={styles.filterPopupHeader}>
                        Filter: {columnHeader}
                    </div>
                    {schema.type === FilterType.Range ? (
                        <Slider 
                            ariaLabelInput="Minimum Value" 
                            unstable_ariaLabelInputUpper="Maximum Value" 
                            value={tempFilterValue?.min ?? schema.min ?? 0}
                            unstable_valueUpper={tempFilterValue?.max ?? schema.max ?? 100}
                            min={schema.min ?? 0}
                            max={schema.max ?? 100}
                            step={schema.step ?? 1}
                            stepMultiplier={10}
                            hideTextInput={true}
                            onChange={(value: any) => {
                                setTempFilterValue((prev: any) => ({
                                    ...(prev || {}),
                                    min: value.value,
                                    max: value.valueUpper
                                }));
                            }}
                        />
                    ) : (
                        <CheckboxGroup
                            legendText="Select values (multiple allowed)"
                        >
                            {(() => {
                                const allValues = Array.from(
                                    new Set(dataEntries.map(row => String(row[columnIndex])))
                                ).sort();
                                const selectedValues = Array.isArray(tempFilterValue) ? tempFilterValue : [];
                                const allSelected = allValues.length > 0 && allValues.every(v => selectedValues.includes(v));
                                const indeterminate = selectedValues.length > 0 && allValues.some(v => selectedValues.includes(v)) && !allSelected;
                                
                                return (
                                    <>
                                        <Checkbox
                                            id={`filter-checkbox-${columnIndex}-select-all`}
                                            labelText="Select All"
                                            checked={allSelected}
                                            indeterminate={indeterminate}
                                            onChange={(e: any, { checked }: { checked: boolean }) => {
                                                if (checked) {
                                                    setTempFilterValue(allValues);
                                                } else {
                                                    setTempFilterValue([]);
                                                }
                                            }}
                                        />
                                        {allValues.map(value => {
                                            return (
                                                <Checkbox
                                                    key={value}
                                                    id={`filter-checkbox-${columnIndex}-${value}`}
                                                    labelText={value}
                                                    checked={selectedValues.includes(value)}
                                                    onChange={(e: any, { checked }: { checked: boolean }) => {
                                                        const currentValues = Array.isArray(tempFilterValue) ? [...tempFilterValue] : [];
                                                        if (checked) {
                                                            setTempFilterValue([...currentValues, value]);
                                                        } else {
                                                            setTempFilterValue(currentValues.filter(v => v !== value));
                                                        }
                                                    }}
                                                />
                                            );
                                        })}
                                    </>
                                );
                            })()}
                        </CheckboxGroup>
                    )}
                    <div className={styles.filterPopupActions}>
                        <Button
                            kind="secondary"
                            size="sm"
                            onClick={closeFilterModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            kind="primary"
                            size="sm"
                            onClick={() => applyFilter(columnIndex)}
                        >
                            Apply
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <TableWrapper
                title={title}
                onExport={handleExport}
                isEmpty={filteredData.length === 0}
                enableToolbar={true}
                searchPlaceholder="Search table..."
                searchValue={searchValue}
                onSearchChange={(value) => {
                    setSearchValue(value);
                    setPage(1);
                }}
                activeFilters={getActiveFilters()}
                onRemoveFilter={removeFilter}
            >
            <div className={styles.tableWrapper}>
                <div ref={tableContainerRef}>
                    <DataTable
                        rows={rows} 
                        headers={carbonHeaders} 
                        sortRow={universalSortRow}
                        >
                        {({ rows, headers, getTableProps, getHeaderProps, getRowProps, getCellProps, getTableContainerProps }) => (
                            <CarbonTable {...getTableProps()}>
                                <TableContainer
                                    className={styles.tableContainer}
                                    >
                                <TableHead>
                                    <TableRow className={styles.stickyHeader}>
                                        {headers.map((header, index) => {
                                            const isColumnSortable = isSortable[index] ?? false;
                                            const { key, ...headerProps } = getHeaderProps({ 
                                                header,
                                                isSortable: isColumnSortable
                                            });
                                            return (
                                                <TableHeader 
                                                    key={key} 
                                                    {...headerProps}
                                                    className={isColumnSortable ? styles.sortableHeader : undefined}
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
                                                                <IconButton 
                                                                    label={`Filter ${header.header}`}
                                                                    align="bottom-right"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openFilterForColumn(index);
                                                                    }}
                                                                    kind = 'ghost'
                                                                    size="sm"
                                                                    data-filter-button
                                                                >
                                                                    <Filter/>
                                                                </IconButton>
                                                                {renderFilterPopup(index)}
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
                                        return (
                                            <TableRow key={key} {...rowProps}>
                                                {row.cells.map((cell, cellIndex) => {
                                                    // Extract raw value and apply renderer/class logic here
                                                    const rawValue = cell.value;
                                                    const renderer = cellRenderers[cellIndex];
                                                    const className = classnames[cellIndex];

                                                    return (
                                                        <TableCell key={cell.id}>
                                                            {renderer 
                                                                ? renderer(rawValue, paginatedRows[rowIndex], rowIndex) 
                                                                : <span className={className}>{rawValue}</span>
                                                            }
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>                                        
                                        );
                                    })}
                                </TableBody>
                            </TableContainer>
                        </CarbonTable>
                        )}
                    </DataTable>
                </div>
                {/* <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }} ref={tableContainerRef}>
                </div> */}
                <div className={styles.paginationContainer}>
                    <Pagination
                        page={page}
                        pageSize={pageSize}
                        pageSizes={[10, 20, 30, 50]}
                        totalItems={filteredData.length}
                        onChange={({ page, pageSize }) => {
                            setPage(page);
                            setPageSize(pageSize);
                        }}
                    />
                </div>
            </div>
        </TableWrapper>
    );
} 

