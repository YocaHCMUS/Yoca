import React from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import styles from './FuturesTab.module.scss';

interface FuturesData {
  id: string;
  pair: string;
  openInterest: number;
  volume24h: number;
  fundingRate: number;
  nextFunding: string;
  basis: number;
}

const headers = [
  { key: 'pair', header: 'Pair' },
  { key: 'openInterest', header: 'Open Interest' },
  { key: 'volume24h', header: '24h Volume' },
  { key: 'fundingRate', header: 'Funding Rate' },
  { key: 'nextFunding', header: 'Next Funding' },
  { key: 'basis', header: 'Basis %' },
];

export const FuturesTab: React.FC = () => {
  const futuresData: FuturesData[] = [
    { id: '1', pair: 'SOL-PERP', openInterest: 450000000, volume24h: 1200000000, fundingRate: 0.0125, nextFunding: '2:30:45', basis: 0.23 },
    { id: '2', pair: 'JTO-PERP', openInterest: 12000000, volume24h: 35000000, fundingRate: -0.0089, nextFunding: '2:30:45', basis: -0.15 },
    { id: '3', pair: 'BONK-PERP', openInterest: 89000000, volume24h: 150000000, fundingRate: 0.0234, nextFunding: '2:30:45', basis: 0.45 },
  ];

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toFixed(2)}`;
  };

  const rows = futuresData.map(item => ({
    id: item.id,
    pair: <span className={styles.pairName}>{item.pair}</span>,
    openInterest: formatNumber(item.openInterest),
    volume24h: formatNumber(item.volume24h),
    fundingRate: (
      <span className={item.fundingRate >= 0 ? styles.positive : styles.negative}>
        {(item.fundingRate * 100).toFixed(4)}%
      </span>
    ),
    nextFunding: item.nextFunding,
    basis: (
      <span className={item.basis >= 0 ? styles.positive : styles.negative}>
        {item.basis >= 0 ? '+' : ''}{item.basis.toFixed(2)}%
      </span>
    ),
  }));

  return (
    <div className={styles.futuresTab}>
      <h3 className={styles.title}>Derivatives Market</h3>
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