import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Close } from "@carbon/react/icons";
import { ID_MODAL_ROOT } from "@/config/constants";
import styles from "./ProfilePasswordModal.module.scss";

interface ProfilePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    hasPassword: boolean;
    initialEmail?: string;
    onSave: (data: {
        email: string;
        currentPassword?: string;
        newPassword: string;
        confirmPassword: string;
    }) => void;
    loading?: boolean;
    error?: string;
    success?: string;
}

export function ProfilePasswordModal({
    isOpen,
    onClose,
    hasPassword,
    initialEmail = "",
    onSave,
    loading,
    error,
    success,
}: ProfilePasswordModalProps) {
    const [email, setEmail] = useState(initialEmail);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const firstInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setEmail(initialEmail);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        }
    }, [isOpen, initialEmail]);

    useEffect(() => {
        if (isOpen) {
            const id = requestAnimationFrame(() => firstInputRef.current?.focus());
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

    const handleSave = useCallback(() => {
        onSave({
            email,
            currentPassword: hasPassword ? currentPassword : undefined,
            newPassword,
            confirmPassword,
        });
    }, [email, currentPassword, hasPassword, newPassword, confirmPassword, onSave]);

    if (!isOpen) return null;

    const modalRoot = document.getElementById(ID_MODAL_ROOT);
    if (!modalRoot) return null;

    return ReactDOM.createPortal(
        <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Change password">
            <div className={styles.card} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <span className={styles.title}>{hasPassword ? "Change Password" : "Add Password"}</span>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        <Close size={20} />
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.field}>
                        <label className={styles.fieldLabel} htmlFor="pps-email">Email</label>
                        <input
                            id="pps-email"
                            ref={firstInputRef}
                            className={styles.textInput}
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.currentTarget.value)}
                            autoComplete="email"
                        />
                    </div>

                    {hasPassword ? (
                        <div className={styles.field}>
                            <label className={styles.fieldLabel} htmlFor="pps-current-password">Current Password</label>
                            <input
                                id="pps-current-password"
                                className={styles.textInput}
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.currentTarget.value)}
                                autoComplete="current-password"
                            />
                        </div>
                    ) : null}

                    <div className={styles.field}>
                        <label className={styles.fieldLabel} htmlFor="pps-new-password">New Password</label>
                        <input
                            id="pps-new-password"
                            className={styles.textInput}
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.currentTarget.value)}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.fieldLabel} htmlFor="pps-confirm-password">Confirm Password</label>
                        <input
                            id="pps-confirm-password"
                            className={styles.textInput}
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                            autoComplete="new-password"
                        />
                    </div>

                    {loading ? (
                        <div className={styles.loadingRow}>
                            <span className={styles.spinner} />
                            <span>Updating password…</span>
                        </div>
                    ) : null}

                    {error ? (
                        <div className={`${styles.notification} ${styles.notificationError}`}>
                            <span className={styles.notificationTitle}>Password update failed</span>
                            <span>{error}</span>
                        </div>
                    ) : null}

                    {success ? (
                        <div className={`${styles.notification} ${styles.notificationSuccess}`}>
                            <span className={styles.notificationTitle}>Success</span>
                            <span>{success}</span>
                        </div>
                    ) : null}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose} type="button" disabled={loading}>
                        Cancel
                    </button>
                    <button className={styles.saveBtn} onClick={handleSave} type="button" disabled={loading}>
                        Save Password
                    </button>
                </div>
            </div>
        </div>,
        modalRoot,
    );
}
