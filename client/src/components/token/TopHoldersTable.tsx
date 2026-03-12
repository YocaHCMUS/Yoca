import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { formatAddress } from "@/util/format";
import { SOLSCAN_ACCOUNT_URL } from "@/config/constants";
import {
    DataTable,
    DataTableSkeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableHeader,
    TableRow,
} from "@carbon/react";
import type { InferResponseType } from "hono/client";
import styles from "./TopHoldersTable.module.scss";

type TopHoldersData = InferResponseType<
  (typeof client.api.tokens.holders)[":address"]["$get"],
  200
>;

interface TopHoldersTableProps {
  holders: TopHoldersData;
  loading?: boolean;
}

export function TopHoldersTable({
  holders,
  loading = false,
}: TopHoldersTableProps) {
  const { tr } = useLocalization();

  const HEADERS = [
    { key: "rank", header: tr("token.topHolders.rank") },
    { key: "address", header: tr("token.topHolders.address") },
    { key: "percentage", header: tr("token.topHolders.percent") },
  ];

  if (loading) {
    return (
      <DataTableSkeleton
        headers={HEADERS}
        rowCount={10}
        showHeader={false}
        showToolbar={false}
      />
    );
  }

  if (!holders || holders.length === 0) {
    return null;
  }

  const rows = holders.map((holder, idx) => ({
    id: holder.holderAddress,
    rank: idx + 1,
    address: holder.holderAddress,
    percentage: `${Number(holder.percentage).toFixed(2)}%`,
  }));

  return (
    <TableContainer className={styles.tableContainer}>
      <DataTable rows={rows} headers={HEADERS} size="lg">
        {({
          rows: tableRows,
          headers,
          getTableProps,
          getHeaderProps,
          getRowProps,
          getCellProps,
        }) => (
          <Table {...getTableProps()} className={styles.table}>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader
                    {...getHeaderProps({ header })}
                    key={header.key}
                  >
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows.map((row) => (
                <TableRow {...getRowProps({ row })} key={row.id}>
                  {row.cells.map((cell) => {
                    if (cell.info.header === "address") {
                      return (
                        <TableCell {...getCellProps({ cell })} key={cell.id}>
                          <a
                            href={`${SOLSCAN_ACCOUNT_URL}/${cell.value}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.addressLink}
                          >
                            {formatAddress(cell.value as string)}
                          </a>
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell {...getCellProps({ cell })} key={cell.id}>
                        {cell.value as React.ReactNode}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </TableContainer>
  );
}
