import type { ExportFormat } from "@/components/charts/shared/ExportMenu"
import { useState } from "react";
import { TableWrapper } from '../charts/shared/TableWrapper';
import { DataTable, Table as CarbonTable, TableHead, TableRow, TableHeader, TableBody, TableCell, Pagination } from "@carbon/react";
import { ArrowUp, ArrowDown, CaretUp, CaretDown } from "@carbon/icons-react";


type CellRenderer = (value: any, row: any[], rowIndex: number) => React.ReactNode;

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
    isSortable = []
}) => {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortColumn, setSortColumn] = useState<number | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    const paginatedRows = dataEntries.slice(start, end);

    // Apply sorting if a column is selected
    const sortedData = sortColumn !== null 
        ? [...paginatedRows].sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];
            
            // Handle null/undefined values
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            
            // Compare values
            let comparison = 0;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
            } else {
                comparison = String(aVal).localeCompare(String(bVal));
            }
            
            return sortDirection === 'asc' ? comparison : -comparison;
        })
        : paginatedRows;


    

    /**
     * Handle export functionality
     */
    const handleExport = async (format: ExportFormat) => {
        if (format === 'csv') {
            // Export as CSV
            const csvHeaders = headers.join(',');
            const csvRows = sortedData.map(row =>
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


    /**
     * Handle column sorting
     */
    const handleSort = (columnIndex: number) => {
        if (sortColumn === columnIndex) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnIndex);
            setSortDirection('asc');
        }
    };

    // Transform headers for Carbon DataTable
    const carbonHeaders = headers.map((header, index) => ({
        key: `header-${index}`,
        header: header
    }));

    // Constructing the rows for Carbon DataTable
    const rows = sortedData.map((row, rowIndex) => {
        const rowData: any = {
            id: `row-${rowIndex}`
        };
        
        // Map each entry to a corresponding header key
        row.forEach((entry, index) => {
            const renderer = cellRenderers[index];
            const className = classnames[index] || '';
            
            // Use custom renderer if provided, otherwise default rendering
            if (renderer) {
                rowData[`header-${index}`] = renderer(entry, row, rowIndex);
            } else if (className) {
                rowData[`header-${index}`] = (
                    <span className={className}>
                        {entry}
                    </span>
                );
            } else {
                rowData[`header-${index}`] = entry;
            }
        });
        
        return rowData;
    });

    return (
        <TableWrapper
            title={title}
            onExport={handleExport}
            isEmpty={dataEntries.length === 0}
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                    <DataTable rows={rows} headers={carbonHeaders}>
                        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
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
                                                    onClick={isColumnSortable ? () => handleSort(index) : undefined}
                                                    style={isColumnSortable ? { cursor: 'pointer' } : undefined}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {header.header}
                                                        {isColumnSortable && sortColumn === index && (
                                                            sortDirection === 'asc' 
                                                                ? <CaretUp size={16} /> 
                                                                : <CaretDown size={16} />
                                                        )}
                                                    </div>
                                                </TableHeader>
                                            );
                                        })}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map(row => {
                                        const { key, ...rowProps } = getRowProps({ row });
                                        return (
                                            <TableRow key={key} {...rowProps}>
                                                {row.cells.map(cell => (
                                                    <TableCell key={cell.id}>{cell.value}</TableCell>
                                                ))}
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
                        totalItems={sortedData.length}
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

