// client/src/components/token/TopHolders.tsx

import { useState } from "react";
import { Copy, ChevronUp, ChevronDown } from "@carbon/icons-react";
import Tble from "../Tble";
import styles from "./TopHolders.module.scss";
import classNames from "classnames";
import { type HoldersInfo } from "../../hooks/useTokenPageData";

interface TopHolder {
    ownerAddress: string;
    balance: string;
    balanceFormatted: string;
    percentageOfSupply: number;
    usdValue: number;
}

interface TopHoldersProps {
    holders: TopHolder[];
    holdersInfo?: HoldersInfo | null;
}

// Rút gọn địa chỉ ví
const shortenAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return address.slice(0, 10);
};

export const TopHolders = ({ holders, holdersInfo }: TopHoldersProps) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!holders || holders.length === 0) {
        return (
            <div className={styles.emptyState}>
                <h3>TOP 10 HOLDERS</h3>
                <p>No holders data found for this token.</p>
            </div>
        );
    }

    // Tính tổng phần trăm top 10
    // Ưu tiên lấy từ API (holdersInfo), nếu không có thì tính tổng từ danh sách holders
    const totalPercentage = holdersInfo?.top_10_percent
        ? holdersInfo.top_10_percent
        : holders.reduce((acc, curr) => acc + curr.percentageOfSupply, 0);

    const toggleExpand = () => setIsExpanded(!isExpanded);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Có thể thêm toast notification nếu cần
    };

    return (
        <div className={styles.container}>
            {/* Header Section */}
            <div
                onClick={toggleExpand}
                className={classNames(styles.header, { [styles.expanded]: isExpanded })}
            >
                <h4 className={styles.title}>
                    TOP 10 HOLDERS
                </h4>
                <div className={styles.stats}>
                    <span className={styles.totalPercentage}>
                        {totalPercentage.toFixed(2)}%
                    </span>
                    <button className={styles.accordionButton}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>
            </div>

            {/* Table Section */}
            {isExpanded && (
                <div className={styles.tableWrapper}>
                    <Tble
                        headers={[
                            { key: "rank", header: "#" },
                            { key: "address", header: "ADDRESS" },
                            { key: "percentage", header: "%", style: { textAlign: "right" } },
                        ]}
                        loading={false}
                        rows={holders.map((holder, index) => ({
                            id: holder.ownerAddress,
                            rank: <span className={styles.rank}>{index + 1}</span>,
                            address: (
                                <div className={styles.addressWrapper}>
                                    <a
                                        href={`https://solscan.io/account/${holder.ownerAddress}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.addressLink}
                                    >
                                        {shortenAddress(holder.ownerAddress)}
                                    </a>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e: React.MouseEvent) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            copyToClipboard(holder.ownerAddress);
                                        }}
                                        className={styles.copyButton}
                                    >
                                        <Copy size={16} />
                                    </div>
                                </div>
                            ),
                            percentage: <div className={styles.percentage}>{holder.percentageOfSupply.toFixed(2)}%</div>,
                        }))}
                    />
                </div>
            )}
        </div>
    );
};
