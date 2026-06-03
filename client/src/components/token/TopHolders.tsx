import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { ChevronDown, ChevronUp } from "@carbon/icons-react";
import classNames from "classnames";
import { useNavigate } from "react-router";
import type { InferResponseType } from "hono/client";
import { useState } from "react";
import Tble from "../Tble";
import styles from "./TopHolders.module.scss";
import { WalletLabel } from "./WalletLabel";

type TopHoldersData = InferResponseType<
  (typeof client.api.tokens.holders)[":address"]["$get"],
  200
>;

type TopHolder = TopHoldersData[number] & {
  amount?: number | string | null;
  balance?: number | string | null;
  tokenAmount?: number | string | null;
};

type HoldersInfo =
  | InferResponseType<
      (typeof client.api.tokens.holders.stats)[":addresses"]["$get"],
      200
    >[number]
  | null;

interface TopHoldersProps {
  holders: TopHoldersData;
  holdersInfo?: HoldersInfo | null;
  currentTokenPriceUsd?: number;
  tokenSymbol?: string;
  holderAmounts?: Record<string, number>;
  totalSupply?: number | null;
}

export const TopHolders = ({
  holders,
  holdersInfo,
  currentTokenPriceUsd = 0,
  tokenSymbol = "",
  holderAmounts,
  totalSupply,
}: TopHoldersProps) => {
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
  console.log("Holders: ");
  console.log(holdersInfo);

  // Tính tổng phần trăm top 10
  // Ưu tiên lấy từ API (holdersInfo), nếu không có thì tính tổng từ danh sách holders
  const totalPercentage = holdersInfo?.top10Percent
    ? Number(holdersInfo.top10Percent)
    : holders.reduce(
        (acc: number, curr: TopHolder) => acc + Number(curr.percentage),
        0,
      );

  const toggleExpand = () => setIsExpanded(!isExpanded);

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
              { key: "amount", header: tr("token.topHolders.amount") },
              { key: "address", header: tr("token.topHolders.address") },
              {
                key: "percentage",
                header: tr("token.topHolders.percent"),
                align: "end",
              },
            ]}
            loading={false}
            height="auto"
            rows={holders.map((holder: TopHolder, index: number) => {
              const percentage = Number(holder.percentage);
              const rawApiAmount =
                holder.amount ?? holder.balance ?? holder.tokenAmount;
              const apiAmount =
                rawApiAmount == null ? null : Number(rawApiAmount);
              const mappedAmount = holderAmounts?.[holder.holderAddress];
              const derivedAmount =
                totalSupply != null && Number.isFinite(percentage)
                  ? (Number(totalSupply) * percentage) / 100
                  : 0;
              const amount = apiAmount != null && Number.isFinite(apiAmount)
                ? apiAmount
                : mappedAmount != null
                  ? mappedAmount
                  : derivedAmount;

              return {
                id: holder.holderAddress,
                rank: <span className={styles.rank}>{index + 1}</span>,
                amount: (
                  <div>
                    <span className={styles.amountPrimary}>
                      {fmt.num.compact.decimal(amount)} {tokenSymbol}
                    </span>
                    <span className={styles.amountUsd}>
                      ~{" "}
                      {fmt.num.compact.currency(
                        amount * currentTokenPriceUsd,
                      )}
                    </span>
                  </div>
                ),
                address: (
                  <div
                    onClick={() => navigate(`/wallets/${holder.holderAddress}`)}
                    className={styles.addressLink}
                    style={{ cursor: "pointer" }}
                  >
                    <WalletLabel address={holder.holderAddress} />
                  </div>
                ),
                percentage: (
                  <div className={styles.percentage}>
                    {percentage.toFixed(2)}%
                  </div>
                ),
              };
            })}
          />
        </div>
      )}
    </div>
  );
};
