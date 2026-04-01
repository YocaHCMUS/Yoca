import overwriteStyles from "@/styles/_overwrite.module.scss";
import {
  DataTable,
  InlineLoading,
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
}

function buildPageItems(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", totalPages] as const;
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ] as const;
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
  ...dataTableProps
}: TblProps) {
  const headerLookup = Object.fromEntries(
    headers.map((h) => [h.key, h]),
  ) as Record<string, TblHdr>;
  const hasToolBar = Boolean(toolBar);
  const safePageSize = Math.max(1, pageSize);
  const totalPages = enablePagination
    ? Math.max(1, Math.ceil(rows.length / safePageSize))
    : 1;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const rowsToRender = useMemo(() => {
    if (!enablePagination) {
      return rows;
    }

    const startIdx = (currentPage - 1) * safePageSize;
    return rows.slice(startIdx, startIdx + safePageSize);
  }, [enablePagination, rows, currentPage, safePageSize]);

  const hasPagination = enablePagination && totalPages > 1;
  const pageItems = useMemo(
    () => buildPageItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  if (loading && rows.length == 0) {
    return (
      <TableContainer
        title={
          title || description ? (
            <div className={overwriteStyles.tblHeadWrap}>
              <div>
                <strong className={overwriteStyles.tblTitle}>{title}</strong>
                <span className={overwriteStyles.tblDsc}>{description}</span>
              </div>
              {hasToolBar && (
                <div className={overwriteStyles.tblToolbar}>
                  <div className={overwriteStyles.tblToolbarContent}>
                    {toolBar}
                  </div>
                </div>
              )}
            </div>
          ) : null
        }
        className={overwriteStyles.tbl}
      >
        <div
          style={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <InlineLoading description="Loading" />
        </div>
      </TableContainer>
    );
  }

  return (
    <TableContainer
      title={
        title || description ? (
          <div className={overwriteStyles.tblHeadWrap}>
            <div>
              <strong className={overwriteStyles.tblTitle}>{title}</strong>
              <span className={overwriteStyles.tblDsc}>{description}</span>
            </div>
            {hasToolBar && (
              <div className={overwriteStyles.tblToolbar}>
                <div className={overwriteStyles.tblToolbarContent}>
                  {toolBar}
                </div>
              </div>
            )}
          </div>
        ) : null
      }
      className={overwriteStyles.tbl}
    >
      <DataTable rows={rowsToRender} headers={headers} {...dataTableProps}>
        {({
          rows,
          headers,
          getTableProps,
          getHeaderProps,
          getRowProps,
          getCellProps,
        }) => (
          <div style={{ height, display: "flex", flexDirection: "column" }}>
            <div className={overwriteStyles.tblTableArea}>
              <Table {...getTableProps()}>
                <TableHead hidden={hideHeaders}>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader
                        {...getHeaderProps({ header })}
                        style={{
                          verticalAlign: "middle",
                          inlineSize: headerLookup[header.key].width,
                          textAlign:
                            headerLookup[header.key].align === "start"
                              ? "left"
                              : headerLookup[header.key].align === "end"
                                ? "right"
                                : "center",
                          justifyContent:
                            headerLookup[header.key].align === "start"
                              ? "flex-start"
                              : headerLookup[header.key].align === "end"
                                ? "flex-end"
                                : "center",
                        }}
                      >
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={headers.length}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          height: "100px",
                        }}
                      >
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell
                            {...getCellProps({ cell })}
                            style={{
                              verticalAlign: "middle",
                              inlineSize: headerLookup[cell.info.header].width,
                              textAlign:
                                headerLookup[cell.info.header].align === "start"
                                  ? "left"
                                  : headerLookup[cell.info.header].align ===
                                      "end"
                                    ? "right"
                                    : "center",
                              justifyContent:
                                headerLookup[cell.info.header].align === "start"
                                  ? "flex-start"
                                  : headerLookup[cell.info.header].align ===
                                      "end"
                                    ? "flex-end"
                                    : "center",
                            }}
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

            {hasPagination && (
              <div className={overwriteStyles.tblPagerWrap}>
                <button
                  type="button"
                  className={overwriteStyles.tblPagerBtn}
                  disabled={currentPage == 1}
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  aria-label="Previous page"
                >
                  &lt;
                </button>

                {pageItems.map((item, idx) => {
                  if (item == "ellipsis") {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        className={overwriteStyles.tblPagerEllipsis}
                      >
                        ...
                      </span>
                    );
                  }

                  return (
                    <button
                      key={item}
                      type="button"
                      className={`${overwriteStyles.tblPagerBtn} ${item == currentPage ? overwriteStyles.tblPagerBtnActive : ""}`}
                      onClick={() => setCurrentPage(item)}
                      aria-label={`Page ${item}`}
                      aria-current={item == currentPage ? "page" : undefined}
                    >
                      {item}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className={overwriteStyles.tblPagerBtn}
                  disabled={currentPage == totalPages}
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  aria-label="Next page"
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
        )}
      </DataTable>
    </TableContainer>
  );
}
