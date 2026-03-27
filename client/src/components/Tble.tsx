import { useLocalization } from "@/contexts/LocalizationContext";
import overwriteStyles from "@/styles/_overwrite.module.scss";
import { cds } from "@/util/carbon-theme";
import {
  DataTable,
  InlineLoading,
  Layer,
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
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

interface TblHdr {
  header: string;
  key: string;
  align?: "start" | "center" | "end";
  width?: number | string;
  style?: CSSProperties;
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
  boxed?: boolean;
  pageSizes?: number[];
  marginTop?: number;
}

export default function Tble({
  rows,
  headers,
  title,
  description,
  hideHeaders = false,
  loading = false,
  height,
  toolBar,
  boxed = false,
  stickyHeader = false,
  enablePagination = false,
  pageSize = 16,
  pageSizes = [8, 16, 24, 32],
  marginTop = 0,
  ...dataTableProps
}: TblProps) {
  const { tr } = useLocalization();
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(Math.max(1, pageSize));

  const totalPages = useMemo(
    () =>
      enablePagination
        ? Math.max(1, Math.ceil(rows.length / currentPageSize))
        : 1,
    [enablePagination, rows.length, currentPageSize],
  );

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const rowsToRender = useMemo(() => {
    if (!enablePagination) return rows;
    const startIdx = (currentPage - 1) * currentPageSize;
    return rows.slice(startIdx, startIdx + currentPageSize);
  }, [enablePagination, rows, currentPage, currentPageSize]);

  const getCellConfiguration = (key: string) => {
    const header = headers.find((h) => h.key == key);
    const alignmentClass =
      header?.align == "end"
        ? overwriteStyles.alignEnd
        : header?.align == "center"
          ? overwriteStyles.alignCenter
          : overwriteStyles.alignStart;

    return {
      className: `${alignmentClass} ${stickyHeader ? overwriteStyles.stickyCell : ""}`,
      style: {
        width: header?.width,
        inlineSize: stickyHeader ? header?.width : undefined,
        verticalAlign: stickyHeader ? undefined : "middle",
      } as CSSProperties,
    };
  };

  const RenderHeader = title && (
    <Stack gap={1}>
      <Stack
        gap={1}
        className={overwriteStyles.titleContainer}
        style={{ paddingLeft: boxed ? 16 : undefined }}
      >
        <strong className={overwriteStyles.titleText}>{title}</strong>
        <span className={overwriteStyles.tblDsc}>{description}</span>
      </Stack>
      <div className={overwriteStyles.tblToolbar}>
        <div
          className={overwriteStyles.tblToolbarContent}
          style={{ paddingRight: boxed ? 4 : undefined }}
        >
          {toolBar}
        </div>
      </div>
    </Stack>
  );

  if (loading || rows.length == 0) {
    return (
      <TableContainer
        title={RenderHeader}
        className={`${overwriteStyles.tbl} ${boxed ? overwriteStyles.tblBoxed : ""}`}
      >
        <Stack
          gap={1}
          className={overwriteStyles.loadingContainer}
          style={{ height }}
        >
          {loading ? (
            <InlineLoading description={tr("common.loading")} />
          ) : (
            <p>{tr("common.noData")}</p>
          )}
        </Stack>
      </TableContainer>
    );
  }

  return (
    <Layer>
      <TableContainer
        title={RenderHeader}
        className={`${overwriteStyles.tbl} ${boxed ? overwriteStyles.tblBoxed : ""}`}
        style={{ marginTop }}
      >
        <DataTable
          rows={rowsToRender}
          headers={headers}
          stickyHeader={stickyHeader}
          {...dataTableProps}
        >
          {({
            rows: internalRows,
            headers: internalHeaders,
            getTableProps,
            getHeaderProps,
            getRowProps,
            getCellProps,
          }) => (
            <div
              style={{
                height,
                ...(!stickyHeader && { tableLayout: "fixed", width: "100%" }),
              }}
            >
              <Table {...getTableProps()}>
                <TableHead hidden={hideHeaders}>
                  <TableRow>
                    {internalHeaders.map((header) => {
                      const config = getCellConfiguration(header.key);
                      return (
                        <TableHeader
                          {...getHeaderProps({ header })}
                          key={header.key}
                          className={`${overwriteStyles.headerCell} ${config.className}`}
                          style={config.style}
                        >
                          {header.header}
                        </TableHeader>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {internalRows.map((row) => (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map((cell) => {
                        const config = getCellConfiguration(cell.info.header);
                        return (
                          <TableCell
                            {...getCellProps({ cell })}
                            key={cell.id}
                            className={config.className}
                            style={config.style}
                          >
                            {cell.value}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {enablePagination && (
                <Pagination
                  style={{ height: "3rem", background: cds.layer01 }}
                  page={currentPage}
                  pageSize={currentPageSize}
                  pageSizes={pageSizes}
                  totalItems={rows.length}
                  forwardText={tr("table.nextPage")}
                  backwardText={tr("table.previousPage")}
                  itemsPerPageText={tr("table.itemsPerPageText")}
                  pageRangeText={(current, total) =>
                    tr("table.pageRangeText", { count: current, total })
                  }
                  itemRangeText={(min, max, total) =>
                    tr("table.itemRangeText", { min, max, count: total })
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
    </Layer>
  );
}
