import overwriteStyles from "@/styles/_overwrite.module.scss";
import {
  DataTable,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type DataTableProps,
} from "@carbon/react";

interface TblHdr {
  header: string;
  key: string;
  style?: React.CSSProperties;
}

interface TblRw {
  id: string;
  [key: string]: React.ReactNode;
}

interface TblProps
  extends Omit<DataTableProps<TblRw, any[]>, "rows" | "headers"> {
  rows: TblRw[];
  headers: TblHdr[];
  hideHeaders?: boolean;
  loading?: boolean;
  height?: number | string;
}

export default function Tble({
  rows,
  headers,
  hideHeaders = false,
  loading = false,
  height = 600,
  ...dataTableProps
}: TblProps) {
  return loading ? (
    <DataTableSkeleton
      headers={headers}
      showHeader={!hideHeaders}
      showToolbar={false}
    />
  ) : (
    <div className={overwriteStyles.tbl} style={{ height }}>
      <DataTable rows={rows} headers={headers} {...dataTableProps}>
        {({
          rows,
          headers,
          getTableProps,
          getHeaderProps,
          getRowProps,
          getCellProps,
        }) => (
          <Table {...getTableProps()}>
            <TableHead hidden={hideHeaders}>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader {...getHeaderProps({ header })}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow {...getRowProps({ row })}>
                  {row.cells.map((cell) => (
                    <TableCell {...getCellProps({ cell })}>
                      {cell.value}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </div>
  );
}
