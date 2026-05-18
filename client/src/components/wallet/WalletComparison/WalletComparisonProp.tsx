export default interface WalletComparisonProp {
    walletAddresses: string[];
    /** When false, charts on this panel do not fetch (inactive tab in comparison view). */
    fetchEnabled?: boolean;
    onDayClick?: (walletAddress: string, timestamp: number) => void;
}