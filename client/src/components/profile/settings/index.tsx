import { useAuth } from "@/contexts/AuthContext";
import {
    createDeleteAccountChallenge,
    deleteAccount,
    getProfileSettingsSnapshot,
    PasswordUpdateError,
    updatePassword,
    updateProfileIdentity,
    type ProfileSettingsSnapshot,
    type PasswordUpdateSuccessState,
} from "@/services/profile/profileApi";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import styles from "./index.module.scss";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Card } from "@/components/common/Card/Card";
import { ProfilePasswordModal } from "./ProfilePasswordModal/ProfilePasswordModal";
import { ProfileDeleteAccountModal } from "./ProfileDeleteAccountModal/ProfileDeleteAccountModal";

type LoginMethodKey = "password" | "google" | "solana";

interface LoginMethodRow {
    key: LoginMethodKey;
    label: string;
    value: string;
    connected: boolean;
}

interface SectionState {
    loading: boolean;
    success?: string;
    error?: string;
}

function getPasswordSuccessMessage(
    state: PasswordUpdateSuccessState,
    tr: ReturnType<typeof useLocalization>["tr"],
): string {
    switch (state) {
        case "PASSWORD_ADDED":
            return tr("profileSettings.passwordAdded");
        case "PASSWORD_CHANGED":
        default:
            return tr("profileSettings.passwordChanged");
    }
}

function getPasswordErrorMessage(
    state: string,
    tr: ReturnType<typeof useLocalization>["tr"],
): string {
    switch (state) {
        case "CURRENT_PASSWORD_INVALID":
            return tr("ERROR.CURRENT_PASSWORD_INVALID") as string;
        case "PASSWORD_AUTH_NOT_FOUND":
            return tr("ERROR.PASSWORD_AUTH_NOT_FOUND") as string;
        case "PASSWORD_ALREADY_SET":
            return tr("ERROR.PASSWORD_ALREADY_SET") as string;
        case "EMAIL_ALREADY_IN_USE":
            return tr("ERROR.EMAIL_ALREADY_IN_USE") as string;
        case "VALIDATION_ERR":
            return tr("ERROR.VALIDATION_ERR") as string;
        case "INTERNAL_SERVER_ERR":
            return tr("ERROR.INTERNAL_SERVER_ERR") as string;
        case "ACCOUNT_DELETE_FORBIDDEN":
            return tr("ERROR.ACCOUNT_DELETE_FORBIDDEN") as string;
        default:
            return tr("ERROR.GENERAL_UNKNOWN_ERR") as string;
    }
}

function toMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return "Operation failed";
}

export default function ProfileSettingsTab() {
    const { signOut, refreshUser } = useAuth();
    const navigate = useNavigate();

    const [snapshot, setSnapshot] = useState<ProfileSettingsSnapshot | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);

    const [displayName, setDisplayName] = useState("");

    const [identityState, setIdentityState] = useState<SectionState>({ loading: false });
    const [passwordState, setPasswordState] = useState<SectionState>({ loading: false });
    const [accountState, setAccountState] = useState<SectionState>({ loading: false });

    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    const { tr } = useLocalization();

    const hydrateFromSnapshot = useCallback((nextSnapshot: ProfileSettingsSnapshot) => {
        setSnapshot(nextSnapshot);
        setDisplayName(nextSnapshot.displayName ?? "");
    }, []);

    const loadSnapshot = useCallback(async () => {
        setInitialLoading(true);
        try {
            const nextSnapshot = await getProfileSettingsSnapshot();
            hydrateFromSnapshot(nextSnapshot);
        } catch (error) {
            setAccountState({ loading: false, error: toMessage(error) });
        } finally {
            setInitialLoading(false);
        }
    }, [hydrateFromSnapshot]);

    useEffect(() => {
        void loadSnapshot();
    }, [loadSnapshot]);

    const hasPassword = snapshot?.hasPassword ?? false;

    const loginMethods = useMemo<LoginMethodRow[]>(() => {
        if (!snapshot) {
            return [];
        }

        const hasGoogle = snapshot.authMethods.includes("google");
        const hasSolana = snapshot.authMethods.includes("solana");
        const authWallet = snapshot.linkedWallets.find((wallet) => wallet.isAuthWallet);

        return [
            {
                key: "password",
                label: tr("profileSettings.loginMethodPasswordEmail") as string,
                value: snapshot.email?.trim() || tr("profileSettings.loginMethodPasswordNotSet") as string,
                connected: snapshot.hasPassword,
            },
            {
                key: "google",
                label: tr("profileSettings.loginMethodGoogleOAuth") as string,
                value: " ",
                connected: hasGoogle,
            },
            {
                key: "solana",
                label: tr("profileSettings.loginMethodSolanaWallet") as string,
                value: authWallet?.walletAddress || " ",
                connected: hasSolana,
            },
        ];
    }, [snapshot, tr]);

    const handleSaveIdentity = async () => {
        if (!snapshot) {
            return;
        }

        setIdentityState({ loading: true });
        try {
            const nextSnapshot = await updateProfileIdentity({
                displayName: displayName.trim() || null,
            });
            hydrateFromSnapshot(nextSnapshot);
            await refreshUser();
            setIdentityState({ loading: false, success: tr("profileSettings.identityUpdated") as string });
        } catch (error) {
            setIdentityState({ loading: false, error: toMessage(error) });
        }
    };

    const handlePasswordModalSave = useCallback(async (data: {
        email: string;
        currentPassword?: string;
        newPassword: string;
        confirmPassword: string;
    }) => {
        const normalizedEmail = data.email.trim().toLowerCase();

        if (!normalizedEmail) {
            setPasswordState({
                loading: false,
                error: tr("profileSettings.passwordValidationEmailRequired") as string,
            });
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setPasswordState({
                loading: false,
                error: tr("profileSettings.passwordValidationEmailInvalid") as string,
            });
            return;
        }

        if (hasPassword && data.currentPassword && data.currentPassword.trim().length <= 0) {
            setPasswordState({
                loading: false,
                error: tr("profileSettings.passwordValidationCurrentPasswordRequired") as string,
            });
            return;
        }

        if (data.newPassword.length <= 0) {
            setPasswordState({
                loading: false,
                error: tr("profileSettings.passwordValidationNewPasswordRequired") as string,
            });
            return;
        }

        if (data.newPassword.length < 8) {
            setPasswordState({
                loading: false,
                error: tr("profileSettings.passwordValidationMinLength") as string,
            });
            return;
        }

        if (!/[A-Z]/.test(data.newPassword)) {
            setPasswordState({
                loading: false,
                error: tr("profileSettings.passwordValidationUppercase") as string,
            });
            return;
        }

        if (!/[a-z]/.test(data.newPassword)) {
            setPasswordState({
                loading: false,
                error: tr("profileSettings.passwordValidationLowercase") as string,
            });
            return;
        }

        if (!/[0-9]/.test(data.newPassword)) {
            setPasswordState({
                loading: false,
                error: tr("profileSettings.passwordValidationNumber") as string,
            });
            return;
        }

        if (data.newPassword !== data.confirmPassword) {
            setPasswordState({ loading: false, error: tr("profileSettings.passwordMatchError") as string });
            return;
        }

        setPasswordState({ loading: true });
        try {
            const result = await updatePassword({
                currentPassword: hasPassword ? data.currentPassword : undefined,
                newPassword: data.newPassword,
                email: normalizedEmail,
            });

            setPasswordState({ loading: false, success: getPasswordSuccessMessage(result.state, tr) });
            setPasswordModalOpen(false);
            await loadSnapshot();
        } catch (error) {
            if (error instanceof PasswordUpdateError) {
                setPasswordState({ loading: false, error: getPasswordErrorMessage(error.state, tr) });
                return;
            }

            setPasswordState({ loading: false, error: tr("ERROR.GENERAL_UNKNOWN_ERR") as string });
        }
    }, [hasPassword, tr, loadSnapshot]);

    const handleDeleteAccount = useCallback(async () => {
        setAccountState({ loading: true });
        try {
            const challenge = await createDeleteAccountChallenge();
            await deleteAccount({
                challengeToken: challenge.challengeToken,
                confirmText: "DELETE MY ACCOUNT",
            });

            await signOut();
            setDeleteModalOpen(false);
            navigate("/");
        } catch (error) {
            setAccountState({ loading: false, error: toMessage(error) });
        }
    }, [signOut, navigate]);

    if (initialLoading) {
        return (
            <div className={styles.loadingRow}>
                <span className={styles.spinner} />
                <span>{tr("common.loading")}</span>
            </div>
        );
    }

    return (
        <section className={styles.container}>
            <Card title={tr("profileSettings.identity")}>
                <div className={styles.row}>
                    <input
                        id="profile-settings-display-name"
                        className={styles.textInput}
                        type="text"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.currentTarget.value)}
                    />
                </div>
                <div className={styles.actionRow}>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={handleSaveIdentity}
                        disabled={identityState.loading}
                    >
                        {tr("profileSettings.saveIdentity")}
                    </button>
                    {identityState.loading ? (
                        <div className={styles.loadingRow}>
                            <span className={styles.spinner} />
                            <span>{tr("profileSettings.savingIdentity")}</span>
                        </div>
                    ) : null}
                </div>
                {identityState.error ? (
                    <div className={`${styles.notification} ${styles.notificationError}`}>
                        <span className={styles.notificationTitle}>{tr("profileSettings.identityUpdateFailed")}</span>
                        <span>{identityState.error}</span>
                    </div>
                ) : null}
                {identityState.success ? (
                    <div className={`${styles.notification} ${styles.notificationSuccess}`}>
                        <span className={styles.notificationTitle}>{tr("common.success")}</span>
                        <span>{identityState.success}</span>
                    </div>
                ) : null}
            </Card>

            <Card title={tr("profileSettings.loginMethods")}>
                <div className={styles.methodList}>
                    {loginMethods.map((method) => (
                        <div key={method.key} className={styles.methodRow}>
                            <p className={styles.methodLabel}>
                                {method.label}
                            </p>
                            <div className={styles.methodActions}>

                                {method.key === "password" ? (
                                    <>
                                        <button
                                            type="button"
                                            className={styles.tertiaryBtn}
                                            onClick={() => setPasswordModalOpen(true)}
                                        >
                                            {tr("profileSettings.changePassword")}
                                        </button>
                                        <ProfilePasswordModal
                                            isOpen={passwordModalOpen}
                                            onClose={() => {
                                                setPasswordModalOpen(false);
                                                setPasswordState({ loading: false });
                                            }}
                                            hasPassword={hasPassword}
                                            initialEmail={snapshot?.email ?? ""}
                                            onSave={handlePasswordModalSave}
                                            loading={passwordState.loading}
                                            error={passwordState.error}
                                            success={passwordState.success}
                                        />
                                    </>
                                ) :
                                    <span className={method.connected ? styles.statusConnected : styles.statusMuted}>
                                        {method.connected ? tr("profileSettings.statusConnected") : tr("profileSettings.statusNotConnected")}
                                    </span>
                                }
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Card title={tr("profileSettings.dangerZone")} style={{ borderColor: "var(--yoca-danger)" }}>
                <p className={styles.dangerHint}>
                    {tr("profileSettings.dangerZoneDescription")}
                </p>
                <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={() => setDeleteModalOpen(true)}
                >
                    {tr("profileSettings.deleteAccount")}
                </button>
                {accountState.error ? (
                    <div className={`${styles.notification} ${styles.notificationError} ${styles.statusMessage}`}>
                        <span className={styles.notificationTitle}>{tr("profileSettings.accountDeleteFailed")}</span>
                        <span>{accountState.error}</span>
                    </div>
                ) : null}
            </Card>

            <ProfileDeleteAccountModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setAccountState({ loading: false });
                }}
                onDelete={handleDeleteAccount}
                loading={accountState.loading}
                error={accountState.error}
            />
        </section>
    );
}
