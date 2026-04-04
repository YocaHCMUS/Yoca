import { type ReactNode, useMemo } from "react";
import styles from "./WalletReportTemplate.module.scss";

export type WalletReportSection = "overview" | "holdings" | "activity_risk";

interface WalletReportTemplateProps {
    walletAddress: string;
    tags: string[];
    activeSection: WalletReportSection;
    overviewContent: ReactNode;
    holdingsContent: ReactNode;
    activityRiskContent: ReactNode;
}

function getSectionLabel(section: WalletReportSection): string {
    switch (section) {
        case "holdings":
            return "Holdings";
        case "activity_risk":
            return "Activity / Risk";
        case "overview":
        default:
            return "Overview";
    }
}

function getSectionTitle(section: WalletReportSection): string {
    switch (section) {
        case "holdings":
            return "Holdings";
        case "activity_risk":
            return "Activity / Risk";
        case "overview":
        default:
            return "Overview";
    }
}

export default function WalletReportTemplate({
    walletAddress,
    tags,
    activeSection,
    overviewContent,
    holdingsContent,
    activityRiskContent,
}: WalletReportTemplateProps) {
    const generatedAt = useMemo(() => new Date(), []);
    const sectionLabel = useMemo(() => getSectionLabel(activeSection), [activeSection]);
    const sectionTitle = useMemo(() => getSectionTitle(activeSection), [activeSection]);

    const sectionContent = useMemo(() => {
        switch (activeSection) {
            case "holdings":
                return holdingsContent;
            case "activity_risk":
                return activityRiskContent;
            case "overview":
            default:
                return overviewContent;
        }
    }, [activeSection, activityRiskContent, holdingsContent, overviewContent]);

    return (
        <div className={styles.reportRoot}>
            <header className={styles.reportHeader}>
                <div className={styles.headerTopRow}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.title}>Wallet Audit Report</h1>
                        <p className={styles.subTitle}>Export Date: {generatedAt.toLocaleDateString("en-GB")}</p>
                    </div>
                    <div className={styles.walletCard}>
                        <span className={styles.walletCardLabel}>Wallet Address</span>
                        <p className={styles.walletAddress}>{walletAddress}</p>
                    </div>
                </div>
                <div className={styles.tagsRow}>
                    {tags.length > 0 ? (
                        tags.map((tag) => (
                            <span key={tag} className={styles.tagPill}>
                                {tag}
                            </span>
                        ))
                    ) : (
                        <span className={styles.emptyTag}>No Tags</span>
                    )}
                </div>
            </header>

            <section className={styles.content}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>{sectionTitle}</h2>
                    <span className={styles.sectionBadge}>{sectionLabel}</span>
                </div>
                <div className={styles.sectionBody}>{sectionContent}</div>
            </section>
        </div>
    );
}
