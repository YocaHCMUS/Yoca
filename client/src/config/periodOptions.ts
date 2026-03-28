export type PeriodOption = {
    key: '24H' | '7D' | '30D' | '90D' | 'All';
    labelKey: string;
};

export const PERIOD_OPTIONS: PeriodOption[] = [
    { key: '24H', labelKey: 'wallet.filter24h' },
    { key: '7D', labelKey: 'wallet.filter7d' },
    { key: '30D', labelKey: 'wallet.filter30d' },
    { key: '90D', labelKey: 'wallet.filter90d' },
    { key: 'All', labelKey: 'wallet.filterAll' },
];

export default PERIOD_OPTIONS;
