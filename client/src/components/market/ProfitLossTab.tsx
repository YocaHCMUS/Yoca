import React, { useState } from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import styles from './ProfitLossTab.module.scss';

interface PnLData {
  id: string;
  token: string;
  realisedProfit: number;
  unrealisedProfit: number;
  sopr: number;
  roi: number;
  holdingPeriod: number;
}

const headers = [
  { key: 'token', header: 'Token' },
  { key: 'realisedProfit', header: 'Realised Profit' },
  { key: 'unrealisedProfit', header: 'Unrealised Profit' },
  { key: 'sopr', header: 'SOPR' },
  { key: 'roi', header: 'ROI %' },
  { key: 'holdingPeriod', header: 'Holding Period (days)' },
];

export const ProfitLossTab: React.FC = () => {
  const pnlData: PnLData[] = [
    { id: '1', token: 'SOL', realisedProfit: 12450, unrealisedProfit: 3200, sopr: 1.23, roi: 34.5, holdingPeriod: 45 },
    { id: '2', token: 'JTO', realisedProfit: -230, unrealisedProfit: 150, sopr: 0.95, roi: -5.2, holdingPeriod: 12 },
    { id: '3', token: 'BONK', realisedProfit: 8900, unrealisedProfit: -1200, sopr: 1.89, roi: 67.8, holdingPeriod: 120 },
    { id: '4', token: 'JUP', realisedProfit: 450, unrealisedProfit: 890, sopr: 1.05, roi: 12.3, holdingPeriod: 30 },
  ];

  const formatValue = (value: number, isProfit: boolean = false) => {
    const formatted = Math.abs(value).toFixed(2);
    if (!isProfit) return formatted;
    return value >= 0 ? `+$${formatted}` : `-$${formatted}`;
  };

  const rows = pnlData.map(item => ({
    id: item.id,
    token: <span className={styles.tokenName}>{item.token}</span>,
    realisedProfit: (
      <span className={item.realisedProfit >= 0 ? styles.positive : styles.negative}>
        {formatValue(item.realisedProfit, true)}
      </span>
    ),
    unrealisedProfit: (
      <span className={item.unrealisedProfit >= 0 ? styles.positive : styles.negative}>
        {formatValue(item.unrealisedProfit, true)}
      </span>
    ),
    sopr: (
      <span className={item.sopr >= 1 ? styles.positive : styles.negative}>
        {item.sopr.toFixed(2)}
      </span>
    ),
    roi: (
      <span className={item.roi >= 0 ? styles.positive : styles.negative}>
        {item.roi >= 0 ? '+' : ''}{item.roi.toFixed(1)}%
      </span>
    ),
    holdingPeriod: `${item.holdingPeriod} days`,
  }));

  return (
    <div className={styles.profitLossTab}>
      <h3 className={styles.title}>Valuation Analysis</h3>
      <DataTable rows={rows} headers={headers}>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <Table {...getTableProps()}>
            <TableHead>
              <TableRow>
                {headers.map(header => (
                  <TableHeader {...getHeaderProps({ header })}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(row => (
                <TableRow {...getRowProps({ row })}>
                  {row.cells.map(cell => (
                    <TableCell key={cell.id}>{cell.value}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </div>
  );
};