import overwriteStyles from "@/styles/_overwrite.module.scss";
import {
  DataTable,
  DataTableSkeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  type DataTableProps,
} from "@carbon/react";
import type { ReactNode } from "react";

interface TblHdr {
  header: string;
  key: string;
  align?: "start" | "center" | "end";
  width?: number | string;
  style?: React.CSSProperties;
}

interface TblRw {
  id: string;
  [key: string]: ReactNode;
}

interface TblProps
  extends Omit<DataTableProps<TblRw, any[]>, "rows" | "headers"> {
  rows: TblRw[];
  headers: TblHdr[];
  title?: ReactNode;
  description?: ReactNode;
  hideHeaders?: boolean;
  loading?: boolean;
  height?: number | string;
  toolBar?: ReactNode;
  toolBarHeight?: number | string;
}

export default function Tble({
  rows,
  headers,
  title,
  description,
  hideHeaders = false,
  loading = false,
  height = 600,
  toolBar,
  ...dataTableProps
}: TblProps) {
  const headerLookup = Object.fromEntries(
    headers.map((header) => [header.key, header]),
  );

  return loading ? (
    <DataTableSkeleton headers={headers} showHeader={!hideHeaders} />
  ) : (
    <TableContainer
      title={
        <Stack
          orientation="horizontal"
          style={{
            width: "100%",
            justifyContent: "space-between",
            alignItems: "end",
          }}
        >
          <Stack>
            <strong style={{ textTransform: "uppercase" }}>{title}</strong>
            <span className={overwriteStyles.tblDsc}>{description}</span>
          </Stack>
          {toolBar}
        </Stack>
      }
      className={overwriteStyles.tbl}
    >
      <DataTable rows={rows} headers={headers} {...dataTableProps}>
        {({
          rows,
          headers,
          getTableProps,
          getHeaderProps,
          getRowProps,
          getCellProps,
        }) => (
          <div style={{ height }}>
            <Table {...getTableProps()}>
              <TableHead hidden={hideHeaders}>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader
                      {...getHeaderProps({ header })}
                      style={{
                        paddingBlockStart: 0,
                        display: "flex",
                        alignItems: "center",
                        inlineSize: headerLookup[header.key].width,
                        justifyContent: headerLookup[header.key].align,
                      }}
                    >
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow {...getRowProps({ row })}>
                    {row.cells.map((cell) => (
                      <TableCell
                        {...getCellProps({ cell })}
                        style={{
                          paddingBlockStart: 0,
                          display: "flex",
                          alignItems: "center",
                          inlineSize: headerLookup[cell.info.header].width,
                          justifyContent: headerLookup[cell.info.header].align,
                        }}
                      >
                        {cell.value}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DataTable>
    </TableContainer>
  );
}
