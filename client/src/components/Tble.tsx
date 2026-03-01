import {
  DataTable,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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

interface TblProps {
  loading?: boolean;
  hideHeaders?: boolean;
  headers: TblHdr[];
  rows: TblRw[];
}

export default function Tble({
  loading = false,
  hideHeaders = false,
  headers,
  rows,
}: TblProps) {
  return loading ? (
    <DataTableSkeleton
      headers={headers}
      showHeader={false}
      showToolbar={false}
    />
  ) : (
    <DataTable rows={rows} headers={headers}>
      {({
        rows,
        headers,
        getTableProps,
        getHeaderProps,
        getRowProps,
        getCellProps,
      }) => (
        <Table {...getTableProps()}>
          {!hideHeaders && (
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader
                    {...getHeaderProps({ header })}
                    style={(header as any).style}
                  >
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
          )}
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
  );
}
