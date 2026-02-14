export interface ChartProps {
  title?: string;  
  minHeight?: number;
  initialFilters?: Partial<any>;
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
}


// export interaface ChartFilterProps {
//   wallets: string[],

// }