import React from "react";
import { useUserTheme } from "@/contexts/ThemeContext";
import styles from "./TokenInvestors.module.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvestorData {
  name: string;
  type: string;
  image: string;
  country_name: string;
  description: string;
  lead: boolean;
}

interface TokenInvestorsProps {
  symbol: string;
  investors: InvestorData[];
}

// ─── Main Component (display-only, no fetching) ───────────────────────────────

export const TokenInvestors = ({ symbol, investors }: TokenInvestorsProps) => {
  const { theme } = useUserTheme();
  const isDark = theme === "dark";
  const displaySymbol = symbol ? symbol.toUpperCase() : "";

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{displaySymbol} Backers & Investors</h3>
      <p className={styles.description}>
        The venture capital firms, angel investors, and funds that have backed this project.
      </p>
      <div className={styles.grid}>
        {investors.map((inv, idx) => (
          <div key={idx} className={`${styles.card} ${isDark ? styles.darkCard : ""}`}>
            <div className={styles.header}>
              <div className={styles.logoWrapper}>
                {inv.image ? (
                  <img src={inv.image} alt={inv.name} loading="lazy" />
                ) : (
                  <div className={styles.logoPlaceholder}>
                    {inv.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className={styles.info}>
                <div className={styles.name} title={inv.name}>
                  {inv.name}
                </div>
                <div className={styles.meta}>
                  {inv.type && <span className={styles.typeBadge}>{inv.type}</span>}
                  {inv.lead && <span className={styles.leadBadge}>Lead</span>}
                  {inv.country_name && (
                    <span className={styles.country} title={inv.country_name}>
                      📍 {inv.country_name.length > 15 ? inv.country_name.substring(0, 15) + "..." : inv.country_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {inv.description && (
              <div className={styles.desc} title={inv.description}>
                {inv.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
