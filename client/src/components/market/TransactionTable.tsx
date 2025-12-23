import React, { useState } from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Pagination,
} from '@carbon/react';
import { CheckmarkFilled, CloseFilled } from '@carbon/icons-react';
import { TableWrapper } from '../charts/shared/TableWrapper';
import type { ExportFormat } from '../charts/shared/ExportMenu';
import styles from './TransactionTable.module.scss';

interface Transaction {
  id: string;
  signature: string;
  type: 'Buy' | 'Sell';
  token: string;
  amount: number;
  price: number;
  total: number;
  timestamp: string;
  status: 'Success' | 'Failed';
}

const headers = [
  { key: 'signature', header: 'Signature' },
  { key: 'type', header: 'Type' },
  { key: 'token', header: 'Token' },
  { key: 'amount', header: 'Amount' },
  { key: 'price', header: 'Price' },
  { key: 'total', header: 'Total' },
  { key: 'timestamp', header: 'Time' },
  { key: 'status', header: 'Status' },
];

export const TransactionTable: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Mock data - replace with actual API call
  const transactions: Transaction[] = Array.from({ length: 50 }, (_, i) => ({
    id: `tx-${i}`,
    signature: `${Math.random().toString(36).substring(2, 10)}...${Math.random().toString(36).substring(2, 6)}`,
    type: i % 2 === 0 ? 'Buy' : 'Sell',
    token: ['SOL', 'USDC', 'JTO', 'BONK'][i % 4],
    amount: Math.random() * 1000,
    price: Math.random() * 200,
    total: Math.random() * 10000,
    timestamp: new Date(Date.now() - Math.random() * 86400000).toLocaleTimeString(),
    status: i % 10 === 0 ? 'Failed' : 'Success',
  }));

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedRows = transactions.slice(start, end);

  const rows = paginatedRows.map(tx => ({
    id: tx.id,
    signature: (
      <code className={styles.signature} title={tx.signature}>
        {tx.signature}
      </code>
    ),
    type: (
      <span className={tx.type === 'Buy' ? styles.typeBuy : styles.typeSell}>
        {tx.type}
      </span>
    ),
    token: <span className={styles.token}>{tx.token}</span>,
    amount: tx.amount.toFixed(4),
    price: `$${tx.price.toFixed(2)}`,
    total: `$${tx.total.toFixed(2)}`,
    timestamp: tx.timestamp,
    status: (
      <span className={tx.status === 'Success' ? styles.statusSuccess : styles.statusFailed}>
        {tx.status === 'Success' ? <CheckmarkFilled size={16} /> : <CloseFilled size={16} />}
        {tx.status}
      </span>
    ),
  }));

  /**
   * Handle export functionality
   */
  const handleExport = async (format: ExportFormat) => {
    if (format === 'csv') {
      // Export as CSV
      const csvHeaders = headers.map(h => h.header).join(',');
      const csvRows = transactions.map(tx =>
        [
          tx.signature,
          tx.type,
          tx.token,
          tx.amount.toFixed(4),
          tx.price.toFixed(2),
          tx.total.toFixed(2),
          tx.timestamp,
          tx.status,
        ].join(',')
      );
      const csvContent = [csvHeaders, ...csvRows].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <TableWrapper
      title="Recent Transactions"
      onExport={handleExport}
      isEmpty={transactions.length === 0}
    >
      <div className={styles.transactionTable}>
        <DataTable rows={rows} headers={headers}>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map(header => {
                    const { key, ...headerProps } = getHeaderProps({ header });
                    return (
                      <TableHeader key={key} {...headerProps}>
                        {header.header}
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
            </Table>
          )}
        </DataTable>
        <Pagination
          page={page}
          pageSize={pageSize}
          pageSizes={[10, 20, 30, 50]}
          totalItems={transactions.length}
          onChange={({ page, pageSize }) => {
            setPage(page);
            setPageSize(pageSize);
          }}
        />
      </div>
    </TableWrapper>
  );
};