import overwriteStyles from "@/styles/_overwrite.module.scss";
import {
  DataTable,
  InlineLoading,
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
import { type ReactNode } from "react";

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
  stickyHeader?: boolean;
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
  stickyHeader = false,
  ...dataTableProps
}: TblProps) {
  const headerLookup = Object.fromEntries(
    headers.map((h) => [h.key, h]),
  ) as Record<string, TblHdr>;

  if (loading && rows.length == 0) {
    return (
      <TableContainer
        title={
          <Stack>
            <Stack>
              <strong style={{ textTransform: "uppercase" }}>{title}</strong>
              <span className={overwriteStyles.tblDsc}>{description}</span>
            </Stack>
            <div className={overwriteStyles.tblToolbar}>
              <div className={overwriteStyles.tblToolbarContent}>{toolBar}</div>
            </div>
          </Stack>
        }
        className={overwriteStyles.tbl}
      >
        <Stack
          style={{
            height,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <InlineLoading description="Loading" />
        </Stack>
      </TableContainer>
    );
  }

  const cellStyle = (key: string): React.CSSProperties => {
    const header = headerLookup[key];

    if (stickyHeader) {
      return {
        paddingBlock: 0,

        display: "flex",
        alignItems: "center",
        justifyContent:
          header?.align == "end"
            ? "flex-end"
            : header?.align == "center"
              ? "center"
              : "flex-start",
        inlineSize: header?.width,
      };
    }

    return {
      paddingBlock: 0,
      textAlign: header?.align || "start",
      verticalAlign: "middle",
      width: header?.width,
    };
  };

  return (
    <TableContainer
      title={
        <Stack>
          <Stack>
            <strong style={{ textTransform: "uppercase" }}>{title}</strong>
            <span className={overwriteStyles.tblDsc}>{description}</span>
          </Stack>
          <div className={overwriteStyles.tblToolbar}>
            <div className={overwriteStyles.tblToolbarContent}>{toolBar}</div>
          </div>
        </Stack>
      }
      className={overwriteStyles.tbl}
    >
      <DataTable
        rows={rows}
        headers={headers}
        stickyHeader={stickyHeader}
        {...dataTableProps}
      >
        {({
          rows,
          headers,
          getTableProps,
          getHeaderProps,
          getRowProps,
          getCellProps,
        }) => (
          <div
            style={{
              height,
              ...(stickyHeader ? {} : { tableLayout: "fixed", width: "100%" }),
            }}
          >
            <Table {...getTableProps()}>
              <TableHead hidden={hideHeaders}>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader
                      {...getHeaderProps({ header })}
                      key={header.key}
                      style={{
                        ...cellStyle(header.key),
                        textTransform: "uppercase",
                      }}
                    >
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {rows.length == 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={headers.length}
                      style={{
                        paddingBlockStart: 0,
                        textAlign: "center",
                        height: "100px",
                      }}
                    >
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map((cell) => (
                        <TableCell
                          {...getCellProps({ cell })}
                          key={cell.id}
                          style={cellStyle(cell.info.header)}
                        >
                          {cell.value}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DataTable>
    </TableContainer>
  );
}
