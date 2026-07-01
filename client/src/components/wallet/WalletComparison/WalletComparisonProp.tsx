export default interface WalletComparisonProp {
    walletAddresses: string[];
    /** When false, charts on this panel do not fetch (inactive tab in comparison view). */
    fetchEnabled?: boolean;
    onDayClick?: (walletAddress: string, timestamp: number) => void;
    /** Called when an AI button is clicked on a chart component */
    onAiAction?: (e: React.MouseEvent<HTMLElement>, label: string, questionIds?: string[]) => void;
}