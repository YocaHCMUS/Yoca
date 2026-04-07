

export default interface WalletComparisionProp {
    walletAddresses: string[];
    /** When false, charts on this panel do not fetch (inactive tab in comparison view). */
    fetchEnabled?: boolean;
}