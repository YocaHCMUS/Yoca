import type { ProfileDashboardData } from "@/types/profile";
import styles from "./profile.module.scss";

interface ProfileDashboardTabProps {
    data: ProfileDashboardData;
}

function getToneClass(tone?: "positive" | "negative" | "neutral"): string {
    if (tone === "positive") return styles.positive;
    if (tone === "negative") return styles.negative;
    return "";
}

export function ProfileDashboardTab({ data }: ProfileDashboardTabProps) {
    return (
        <section className={styles.contentStack}>
            <div className={styles.sectionCard}>
                <h3>KPI strip</h3>
                <div className={styles.metricGrid}>
                    {data.kpis.map((kpi) => (
                        <article key={kpi.id} className={styles.metricCard}>
                            <p className={styles.metricLabel}>{kpi.label}</p>
                            <p className={`${styles.metricValue} ${getToneClass(kpi.tone)}`}>
                                {kpi.value}
                            </p>
                        </article>
                    ))}
                </div>
            </div>

            <div className={styles.sectionCard}>
                <h3>Wallet concentration</h3>
                <table className={styles.simpleTable}>
                    <thead>
                        <tr>
                            <th>Wallet</th>
                            <th>Value</th>
                            <th>Share</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.concentration.map((item) => (
                            <tr key={item.label}>
                                <td>{item.label}</td>
                                <td>${item.valueUsd.toLocaleString()}</td>
                                <td>{item.pct.toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={styles.sectionCard}>
                <h3>Risk panel</h3>
                <div className={styles.contentStack}>
                    {data.risk.map((risk) => (
                        <div key={risk.id}>
                            <strong>{risk.label}:</strong> {risk.value}
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.sectionCard}>
                <h3>Recent anomalies</h3>
                <div className={styles.contentStack}>
                    {data.anomalies.map((anomaly) => (
                        <article key={anomaly.id} className={styles.notificationItem}>
                            <strong>{anomaly.title}</strong>
                            <p>{anomaly.description}</p>
                            <small>{new Date(anomaly.timestamp).toLocaleString()}</small>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default ProfileDashboardTab;
