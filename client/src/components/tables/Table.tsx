import type { ExportFormat } from "@/components/charts/shared/ExportMenu"
import { useState } from "react";
import { TableWrapper } from '../charts/shared/TableWrapper';
import { DataTable, Table as CarbonTable, TableHead, TableRow, TableHeader, TableBody, TableCell, Pagination } from "@carbon/react";


type CellRenderer = (value: any, row: any[], rowIndex: number) => React.ReactNode;

export enum SortType {
    String = 'string',
    Date = 'date',
    Priority = 'priority',
    Number = 'number'
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
    filterSchema: any;
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
    fetcher,
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

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    const paginatedRows = dataEntries.slice(start, end);


    /**
     * Handle export functionality
     */
    const handleExport = async (format: ExportFormat) => {
        if (format === 'csv') {
            // Export as CSV
            const csvHeaders = headers.join(',');
            const csvRows = paginatedRows.map(row =>
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

    return (
        <TableWrapper
            title={title}
            onExport={handleExport}
            isEmpty={dataEntries.length === 0}
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                    <DataTable
                        rows={rows} 
                        headers={carbonHeaders} 
                        sortRow={universalSortRow}
                        >
                        {({ rows, headers, getTableProps, getHeaderProps, getRowProps, getCellProps }) => (
                            <CarbonTable {...getTableProps()}>
                                <TableHead>
                                    <TableRow>
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
                                                    // onClick={() => setSortIndex(index)}
                                                    style={isColumnSortable ? { cursor: 'pointer' } : undefined}
                                                >
                                                    {header.header}
                                                </TableHeader>
                                            );
                                        })}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((row, rowIndex) => {
                                        const { key, ...rowProps } = getRowProps({ row });
                                        return (
                                        //     <TableRow key={key} {...rowProps}>
                                        //         {row.cells.map(cell => (
                                        //             <TableCell key={cell.id}>{cell.value}</TableCell>
                                        //         ))}
                                        //     </TableRow>
                                            <TableRow {...getRowProps({ row })}>
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
                            </CarbonTable>
                        )}
                    </DataTable>
                </div>
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: '1rem' }}>
                    <Pagination
                        page={page}
                        pageSize={pageSize}
                        pageSizes={[10, 20, 30, 50]}
                        totalItems={paginatedRows.length}
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

