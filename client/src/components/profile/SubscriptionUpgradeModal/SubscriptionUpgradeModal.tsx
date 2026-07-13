import { useEffect } from "react";
import ReactDOM from "react-dom";
import { Close } from "@carbon/react/icons";
import { ID_MODAL_ROOT } from "@/config/constants";
import styles from "./SubscriptionUpgradeModal.module.scss";

interface UpgradePreview {
    amountDue: number;
    creditAmount: number;
    chargeAmount: number;
    currency: string;
    prorationDate: number;
}

function formatMoney(cents: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
    }).format(cents / 100);
}

interface SubscriptionUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isLoading: boolean;
    currentTier: string;
    upgradeTier: string;
    upgradePreview: UpgradePreview | null;
    periodEnd: string;
}

export function SubscriptionUpgradeModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading,
    currentTier,
    upgradeTier,
    upgradePreview,
    periodEnd,
}: SubscriptionUpgradeModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const modalRoot = document.getElementById(ID_MODAL_ROOT);
    if (!modalRoot) return null;

    return ReactDOM.createPortal(
        <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Upgrade subscription">
            <div className={styles.card} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <span className={styles.title}>Upgrade to {upgradeTier}</span>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        <Close size={20} />
                    </button>
                </div>

                <div className={styles.body}>
                    {upgradePreview ? (
                        <>
                            <p className={styles.description}>
                                Stripe applies the unused value of your {currentTier} plan
                                toward the {upgradeTier} plan. You are not buying a full new plan.
                            </p>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryRow}>
                                    <span>Unused {currentTier} credit</span>
                                    <span>-{formatMoney(upgradePreview.creditAmount, upgradePreview.currency)}</span>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span>{upgradeTier} for the remaining period</span>
                                    <span>{formatMoney(upgradePreview.chargeAmount, upgradePreview.currency)}</span>
                                </div>
                                <div className={styles.summaryTotal}>
                                    <span>Amount due now</span>
                                    <span className={styles.totalAmount}>
                                        {formatMoney(upgradePreview.amountDue, upgradePreview.currency)}
                                    </span>
                                </div>
                            </div>
                            <p className={styles.hint}>
                                Your billing date remains {periodEnd}.
                            </p>
                        </>
                    ) : isLoading ? (
                        <div className={styles.loadingRow}>
                            <span className={styles.spinner} />
                            <span>Calculating upgrade…</span>
                        </div>
                    ) : null}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose} type="button" disabled={isLoading}>
                        Not now
                    </button>
                    <button className={styles.confirmBtn} onClick={onConfirm} type="button" disabled={isLoading}>
                        {isLoading ? "Upgrading..." : "Confirm upgrade"}
                    </button>
                </div>
            </div>
        </div>,
        modalRoot,
    );
}
