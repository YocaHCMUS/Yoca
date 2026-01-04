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
import { ArrowUp, ArrowDown } from '@carbon/icons-react';
import { TableWrapper } from '../charts/shared/TableWrapper';
import type { ExportFormat } from '../charts/shared/ExportMenu';
import styles from './TokenPerformanceTable.module.scss';

interface TokenPerformance {
  id: string;
  token: string;
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  supply: number;
}

const headers = [
  { key: 'token', header: 'Token' },
  { key: 'price', header: 'Price' },
  { key: 'change24h', header: '24h Change' },
  { key: 'volume24h', header: '24h Volume' },
  { key: 'marketCap', header: 'Market Cap' },
  { key: 'supply', header: 'Circulating Supply' },
];

export const TokenPerformanceTable: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Mock data
  const tokens: TokenPerformance[] = [
    { id: '1', token: 'Solana', symbol: 'SOL', price: 189.45, change24h: 2.34, volume24h: 2100000000, marketCap: 89400000000, supply: 472000000 },
    { id: '2', token: 'Jito', symbol: 'JTO', price: 3.21, change24h: -1.23, volume24h: 45000000, marketCap: 450000000, supply: 140000000 },
    { id: '3', token: 'Bonk', symbol: 'BONK', price: 0.000034, change24h: 5.67, volume24h: 89000000, marketCap: 2100000000, supply: 61800000000000 },
    { id: '4', token: 'Jupiter', symbol: 'JUP', price: 0.89, change24h: 1.89, volume24h: 120000000, marketCap: 1200000000, supply: 1350000000 },
    { id: '5', token: 'Dogwifhat', symbol: 'WIF', price: 2.45, change24h: -0.78, volume24h: 67000000, marketCap: 2450000000, supply: 1000000000 },
  ];

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const rows = tokens.map(token => ({
    id: token.id,
    token: (
      <div className={styles.tokenCell}>
        <span className={styles.tokenName}>{token.token}</span>
        <span className={styles.tokenSymbol}>{token.symbol}</span>
      </div>
    ),
    price: `$${token.price < 1 ? token.price.toFixed(6) : token.price.toFixed(2)}`,
    change24h: (
      <span className={token.change24h >= 0 ? styles.positive : styles.negative}>
        {token.change24h >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
        {Math.abs(token.change24h).toFixed(2)}%
      </span>
    ),
    volume24h: formatNumber(token.volume24h),
    marketCap: formatNumber(token.marketCap),
    supply: `${(token.supply / 1e6).toFixed(2)}M ${token.symbol}`,
  }));
  /**
   * Handle export functionality
   */
  const handleExport = async (format: ExportFormat) => {
    if (format === 'csv') {
      // Export as CSV
      const csvHeaders = headers.map(h => h.header).join(',');
      const csvRows = tokens.map(token =>
        [
          token.token,
          token.symbol,
          token.price.toFixed(6),
          token.change24h.toFixed(2),
          token.volume24h.toString(),
          token.marketCap.toString(),
          token.supply.toString(),
        ].join(',')
      );
      const csvContent = [csvHeaders, ...csvRows].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `token-performance-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };
  return (
    <TableWrapper
      title="Token Performance"
      onExport={handleExport}
      isEmpty={tokens.length === 0}
    >
      <div className={styles.tokenPerformanceTable}>
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
      </div>
    </TableWrapper>
  );
};