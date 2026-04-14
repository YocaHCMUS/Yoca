import { FilterType, SortType, Table } from "@/components/tables/Table";
import type { ProfileDashboardData } from "@/types/profile";
import styles from "./profile.module.scss";
import ProfileUnavailableState from "@/components/profile/ProfileUnavailableState";
import { useLocalization } from "@/contexts/LocalizationContext";

interface ProfileDashboardTabProps {
    data: ProfileDashboardData;
}

function getToneClass(tone?: "positive" | "negative" | "neutral"): string {
    if (tone === "positive") return styles.positive;
    if (tone === "negative") return styles.negative;
    return "";
}

export function ProfileDashboardTab({ data }: ProfileDashboardTabProps) {
    const { tr } = useLocalization();


    if (
        data.kpis.length === 0
        && data.concentration.length === 0
        && data.risk.length === 0
        && data.anomalies.length === 0
    ) {
        return (
            <ProfileUnavailableState
                title={tr("profileTabs.dashboard.unavailableTitle")}
                description={tr("profileTabs.dashboard.unavailableDescription")}
            />
        );
    }

    const concentrationData = data.concentration.map((item) => [
        item.label,
        item.valueUsd,
        item.pct,
    ]);

    const conentrationHeaders = [
        tr("profileTabs.dashboard.concentrationHeaders.0"),
        tr("profileTabs.dashboard.concentrationHeaders.1"),
        tr("profileTabs.dashboard.concentrationHeaders.2"),
    ];

    return (
        <section className={styles.contentStack}>
            <div className={styles.sectionCard}>
                <h3>{tr("profileTabs.dashboard.kpiStripTitle")}</h3>
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

            <Table
                title={tr("profileTabs.dashboard.concentrationTableTitle") as string}
                headers={conentrationHeaders}
                initialFilters={{}}
                fetcher={Promise.resolve([])}
                filterSchema={{
                    1: { type: FilterType.Range, min: 0, max: 1000000, step: 1000 },
                    2: { type: FilterType.Range, min: 0, max: 100, step: 0.1 },
                }}
                dataEntries={concentrationData}
                cellRenderers={[
                    null,
                    (value) => `$${Number(value).toLocaleString()}`,
                    (value) => `${Number(value).toFixed(1)}%`,
                ]}
                isSortable={[true, true, true]}
                sortConfigs={{
                    1: { type: SortType.Number },
                    2: { type: SortType.Number },
                }}
            />

            <div className={styles.sectionCard}>
                <h3>{tr("profileTabs.dashboard.riskPanelTitle")}</h3>
                <div className={styles.contentStack}>
                    {data.risk.map((risk) => (
                        <div key={risk.id}>
                            <strong>{risk.label}:</strong> {risk.value}
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.sectionCard}>
                <h3>{tr("profileTabs.dashboard.anomaliesTitle")}</h3>
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
