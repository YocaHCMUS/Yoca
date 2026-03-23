import { useLocalization } from "@/contexts/LocalizationContext";
import overwriteStyles from "@/styles/_overwrite.module.scss";
import {
  DataTable,
  InlineLoading,
  Pagination,
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
import { useEffect, useMemo, useState, type ReactNode } from "react";

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
  enablePagination?: boolean;
  pageSize?: number;
  pageSizes?: number[];
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
  enablePagination = false,
  pageSize = 8,
  pageSizes = [8, 16, 24, 32],
  ...dataTableProps
}: TblProps) {
  const { tr } = useLocalization();
  const headerLookup = Object.fromEntries(
    headers.map((h) => [h.key, h]),
  ) as Record<string, TblHdr>;
  const safePageSize = Math.max(1, pageSize);
  const totalPages = enablePagination
    ? Math.max(1, Math.ceil(rows.length / safePageSize))
    : 1;
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(safePageSize);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const rowsToRender = useMemo(() => {
    if (!enablePagination) {
      return rows;
    }

    const startIdx = (currentPage - 1) * currentPageSize;
    return rows.slice(startIdx, startIdx + currentPageSize);
  }, [enablePagination, rows, currentPage, currentPageSize]);

  const cellStyle = (key: string): React.CSSProperties => {
    const header = headerLookup[key];

    if (stickyHeader) {
      return {
        paddingBlock: 0,
        display: "flex",
        alignItems: "center",
        textAlign: header?.align || "start",
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
          <InlineLoading description={tr("common.loading")} />
        </Stack>
      </TableContainer>
    );
  }

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
        rows={rowsToRender}
        headers={headers}
        stickyHeader={stickyHeader}
        {...dataTableProps}
      >
        {({
          rows: internalRows,
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
                {internalRows.length == 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={headers.length}
                      style={{
                        paddingBlockStart: 0,
                        textAlign: "center",
                        height: "100px",
                      }}
                    >
                      {tr("common.noData")}
                    </TableCell>
                  </TableRow>
                ) : (
                  internalRows.map((row) => (
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
            {enablePagination && (
              <Pagination
                page={currentPage}
                pageSize={currentPageSize}
                pageSizes={pageSizes}
                totalItems={rows.length}
                forwardText={tr("table.nextPage")}
                backwardText={tr("table.previousPage")}
                itemsPerPageText={tr("table.itemsPerPageText")}
                pageRangeText={(current: number, total: number) =>
                  tr("table.pageRangeText", {
                    count: current,
                    total: total,
                  })
                }
                itemRangeText={(min: number, max: number, total: number) =>
                  tr("table.itemRangeText", {
                    min,
                    max,
                    count: total,
                  })
                }
                onChange={({ page, pageSize }) => {
                  setCurrentPage(page);
                  setCurrentPageSize(pageSize);
                }}
              />
            )}
          </div>
        )}
      </DataTable>
    </TableContainer>
  );
}
