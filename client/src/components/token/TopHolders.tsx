import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { ChevronDown, ChevronUp, Copy } from "@carbon/icons-react";
import classNames from "classnames";
import { useNavigate } from "react-router";
import type { InferResponseType } from "hono/client";
import { useState } from "react";
import Tble from "../Tble";
import styles from "./TopHolders.module.scss";

type TopHoldersData = InferResponseType<
  (typeof client.api.tokens.holders)[":address"]["$get"],
  200
>;

type TopHolder = TopHoldersData[number];

interface TopHoldersProps {
  holders: TopHoldersData;
}

export const TopHolders = ({ holders }: TopHoldersProps) => {
  const { tr, fmt } = useLocalization();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!holders || holders.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h3>{tr("token.marketStats.top10Holders")}</h3>
        <p>{tr("token.topHolders.noData")}</p>
      </div>
    );
  }
  // Tính tổng phần trăm top 10
  // Dùng trực tiếp dữ liệu top 10 từ mảng holders
  const top10Holders = holders.slice(0, 10);
  const totalPercentage = top10Holders.reduce(
    (acc: number, curr: TopHolder) => acc + curr.percentage,
    0
  );

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
        <h4 className={styles.title}>{tr("token.marketStats.top10Holders")}</h4>
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
            title=""
            headers={[
              { key: "rank", header: "#" },
              { key: "address", header: tr("token.topHolders.address") },
              {
                key: "amount",
                header: "Amount",
                align: "end",
              },
              {
                key: "percentage",
                header: tr("token.topHolders.percent"),
                align: "end",
              },
            ]}
            loading={false}
            height="auto"
            rows={top10Holders.map((holder: TopHolder, index: number) => ({
              id: holder.holderAddress,
              rank: <span className={styles.rank}>{index + 1}</span>,
              address: (
                <div className={styles.addressWrapper}>
                  <div
                    onClick={() => navigate(`/wallets/${holder.holderAddress}`)}
                    className={styles.addressLink}
                    style={{ cursor: "pointer" }}
                  >
                    {fmt.text.address(holder.holderAddress)}
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      copyToClipboard(holder.holderAddress);
                    }}
                    className={styles.copyButton}
                  >
                    <Copy size={16} />
                  </div>
                </div>
              ),
              amount: (
                <div className={styles.amount}>
                  {fmt.num.compact.decimal(holder.balance)}
                </div>
              ),
              percentage: (
                <div className={styles.percentage}>
                  {holder.percentage.toFixed(2)}%
                </div>
              ),
            }))}
          />
        </div>
      )}
    </div>
  );
};


