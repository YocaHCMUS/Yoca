import { useEffect } from "react";
import ReactDOM from "react-dom";
import { Close } from "@carbon/react/icons";
import { ID_MODAL_ROOT } from "@/config/constants";
import styles from "./SubscriptionCancelModal.module.scss";

interface SubscriptionCancelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isLoading: boolean;
    planTier: string;
    periodEnd: string;
}

export function SubscriptionCancelModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading,
    planTier,
    periodEnd,
}: SubscriptionCancelModalProps) {
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
        <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Cancel subscription">
            <div className={styles.card} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <span className={styles.title}>Cancel Subscription</span>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        <Close size={20} />
                    </button>
                </div>

                <div className={styles.body}>
                    <p className={styles.question}>
                        Are you sure you want to cancel your {planTier} subscription?
                    </p>
                    <p className={styles.note}>
                        You will continue to have access to all {planTier} features until the end of
                        your current billing period on <strong>{periodEnd}</strong>.
                    </p>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose} type="button" disabled={isLoading}>
                        No, keep it
                    </button>
                    <button className={styles.confirmBtn} onClick={onConfirm} type="button" disabled={isLoading}>
                        {isLoading ? "Canceling..." : "Yes, cancel my plan"}
                    </button>
                </div>
            </div>
        </div>,
        modalRoot,
    );
}
