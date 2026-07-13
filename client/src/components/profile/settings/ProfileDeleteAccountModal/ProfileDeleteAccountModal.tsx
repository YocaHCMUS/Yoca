import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Close } from "@carbon/react/icons";
import { ID_MODAL_ROOT } from "@/config/constants";
import styles from "./ProfileDeleteAccountModal.module.scss";

interface ProfileDeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDelete: (confirmText: string) => void;
    loading?: boolean;
    error?: string;
}

export function ProfileDeleteAccountModal({
    isOpen,
    onClose,
    onDelete,
    loading,
    error,
}: ProfileDeleteAccountModalProps) {
    const [confirmText, setConfirmText] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setConfirmText("");
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            const id = requestAnimationFrame(() => inputRef.current?.focus());
            return () => cancelAnimationFrame(id);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isOpen, onClose]);

    const handleDelete = useCallback(() => {
        if (confirmText.trim() !== "DELETE MY ACCOUNT") return;
        onDelete(confirmText);
    }, [confirmText, onDelete]);

    const isValid = confirmText.trim() === "DELETE MY ACCOUNT";

    if (!isOpen) return null;

    const modalRoot = document.getElementById(ID_MODAL_ROOT);
    if (!modalRoot) return null;

    return ReactDOM.createPortal(
        <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Delete account">
            <div className={styles.card} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <span className={styles.title}>Delete Account</span>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        <Close size={20} />
                    </button>
                </div>

                <div className={styles.body}>
                    <p className={styles.warningText}>
                        This action is permanent and cannot be undone. All your data will be lost.
                    </p>

                    <div className={styles.field}>
                        <label className={styles.fieldLabel} htmlFor="pda-confirm">
                            Type <strong>DELETE MY ACCOUNT</strong> to confirm
                        </label>
                        <input
                            id="pda-confirm"
                            ref={inputRef}
                            className={styles.textInput}
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.currentTarget.value)}
                            autoComplete="off"
                        />
                    </div>

                    {error ? (
                        <div className={`${styles.notification} ${styles.notificationError}`}>
                            <span className={styles.notificationTitle}>Account deletion failed</span>
                            <span>{error}</span>
                        </div>
                    ) : null}

                    {loading ? (
                        <div className={styles.loadingRow}>
                            <span className={styles.spinner} />
                            <span>Deleting account…</span>
                        </div>
                    ) : null}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose} type="button" disabled={loading}>
                        Cancel
                    </button>
                    <button
                        className={styles.deleteBtn}
                        onClick={handleDelete}
                        type="button"
                        disabled={!isValid || loading}
                    >
                        {loading ? "Deleting..." : "Delete my account"}
                    </button>
                </div>
            </div>
        </div>,
        modalRoot,
    );
}
