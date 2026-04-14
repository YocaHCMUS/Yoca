import { useAuth } from "@/contexts/AuthContext";
import {
    createDeleteAccountChallenge,
    deleteAccount,
    getProfileSettingsSnapshot,
    updatePassword,
    updateProfileIdentity,
    type ProfileSettingsSnapshot,
} from "@/services/profile/profileApi";
import {
    Button,
    ComposedModal,
    InlineLoading,
    InlineNotification,
    ModalBody,
    ModalFooter,
    ModalHeader,
    PasswordInput,
    TextInput,
} from "@carbon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import styles from "./index.module.scss";
import { useLocalization } from "@/contexts/LocalizationContext";

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
    const [email, setEmail] = useState("");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [identityState, setIdentityState] = useState<SectionState>({ loading: false });
    const [passwordState, setPasswordState] = useState<SectionState>({ loading: false });
    const [accountState, setAccountState] = useState<SectionState>({ loading: false });
    const [passwordEditorOpen, setPasswordEditorOpen] = useState(false);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");

    const { tr } = useLocalization();

    const hydrateFromSnapshot = useCallback((nextSnapshot: ProfileSettingsSnapshot) => {
        setSnapshot(nextSnapshot);
        setDisplayName(nextSnapshot.displayName ?? "");
        setEmail(nextSnapshot.email ?? "");
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

    const handleUpdatePassword = async () => {
        if (newPassword !== confirmPassword) {
            setPasswordState({ loading: false, error: tr("profileSettings.passwordMatchError") as string });
            return;
        }

        setPasswordState({ loading: true });
        try {
            await updatePassword({
                currentPassword: hasPassword ? currentPassword : undefined,
                newPassword,
                email: email.trim().toLowerCase() || null,
            });

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordEditorOpen(false);
            const successMsg = hasPassword ? tr("profileSettings.passwordChanged") : tr("profileSettings.passwordAdded");
            setPasswordState({ loading: false, success: successMsg as string });
            await loadSnapshot();
        } catch (error) {
            setPasswordState({ loading: false, error: toMessage(error) });
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText.trim() !== "DELETE MY ACCOUNT") {
            setAccountState({ loading: false, error: tr("profileSettings.accountDeleteConfirmError") as string });
            return;
        }

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
    };

    if (initialLoading) {
        return <InlineLoading description={tr("common.loading") as string} status="active" />;
    }

    return (
        <section className={styles.container}>
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{tr("profileSettings.identity")}</h3>
                <div className={styles.row}>
                    <TextInput
                        id="profile-settings-display-name"
                        labelText={tr("profileSettings.displayName") as string}
                        value={displayName}
                        onChange={(event) => setDisplayName(event.currentTarget.value)}
                        className={styles.input}
                    />
                </div>
                <div className={styles.actionRow}>
                    <Button kind="primary" onClick={handleSaveIdentity} disabled={identityState.loading}>
                        {tr("profileSettings.saveIdentity")}
                    </Button>
                    {identityState.loading ? <InlineLoading description={tr("profileSettings.savingIdentity") as string} status="active" /> : null}
                </div>
                {identityState.error ? (
                    <InlineNotification
                        className={styles.statusMessage}
                        kind="error"
                        title={tr("profileSettings.identityUpdateFailed") as string}
                        subtitle={identityState.error}
                        hideCloseButton
                    />
                ) : null}
                {identityState.success ? (
                    <InlineNotification
                        className={styles.statusMessage}
                        kind="success"
                        title={tr("common.success") as string}
                        subtitle={identityState.success}
                        hideCloseButton
                    />
                ) : null}
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{tr("profileSettings.loginMethods")}</h3>
                <div className={styles.methodList}>
                    {loginMethods.map((method) => (
                        <div key={method.key} className={styles.methodRow}>
                            <p className={styles.methodLabel}>
                                {method.label}
                            </p>
                            {/* <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "1rem", justifyContent: "center" }}> */}
                            {/* {method.value && (
                                    <p className={styles.methodValue}>{method.value}</p>
                                )} */}
                            {/* </div> */}
                            <div className={styles.methodActions}>

                                {method.key === "password" ? (
                                    <Button
                                        kind="tertiary"
                                        size="sm"
                                        onClick={() => setPasswordEditorOpen((prev) => !prev)}
                                    >
                                        {hasPassword ? tr("profileSettings.changePassword") : tr("profileSettings.addPassword")}
                                    </Button>
                                ) :
                                    <span className={method.connected ? styles.statusConnected : styles.statusMuted}>
                                        {method.connected ? tr("profileSettings.statusConnected") : tr("profileSettings.statusNotConnected")}
                                    </span>
                                }
                            </div>
                        </div>
                    ))}
                </div>
                <ComposedModal
                    open={passwordEditorOpen}
                    onClose={() => setPasswordEditorOpen(false)}
                >
                    <ModalHeader
                        title={hasPassword ? tr("profileSettings.changePassword") : tr("profileSettings.addPassword")}
                        label={tr("profileSettings.loginMethods") as string}
                    />
                    <ModalBody>
                        <div>
                            <TextInput
                                id="profile-settings-email"
                                labelText={tr("profileSettings.email") as string}
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.currentTarget.value)}
                                className={styles.input}
                            />
                            {hasPassword ? (
                                <PasswordInput
                                    id="profile-settings-current-password"
                                    labelText={tr("profileSettings.currentPassword") as string}
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                                    className={styles.input}
                                />
                            ) : null}
                            <PasswordInput
                                id="profile-settings-new-password"
                                labelText={tr("profileSettings.newPassword") as string}
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.currentTarget.value)}
                                className={styles.input}
                            />
                            <PasswordInput
                                id="profile-settings-confirm-password"
                                labelText={tr("profileSettings.confirmPassword") as string}
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                                className={styles.input}
                            />
                        </div>
                        {passwordState.loading ? <InlineLoading description={tr("profileSettings.updatingPassword") as string} status="active" /> : null}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            kind="secondary"
                            onClick={() => setPasswordEditorOpen(false)}
                            disabled={passwordState.loading}
                        >
                            {tr("common.cancel")}
                        </Button>
                        <Button kind="primary" onClick={handleUpdatePassword} disabled={passwordState.loading}>
                            {tr("profileSettings.savePassword")}
                        </Button>
                    </ModalFooter>
                </ComposedModal>
                {passwordState.error ? (
                    <InlineNotification
                        className={styles.statusMessage}
                        kind="error"
                        title={tr("profileSettings.passwordUpdateFailed") as string}
                        subtitle={passwordState.error}
                        hideCloseButton
                    />
                ) : null}
                {passwordState.success ? (
                    <InlineNotification
                        className={styles.statusMessage}
                        kind="success"
                        title={tr("common.success") as string}
                        subtitle={passwordState.success}
                        hideCloseButton
                    />
                ) : null}
            </div>

            <div className={`${styles.section} ${styles.dangerSection}`}>
                <h3 className={styles.sectionTitle}>{tr("profileSettings.dangerZone")}</h3>
                <p className={styles.dangerHint}>
                    {tr("profileSettings.dangerZoneDescription")}
                </p>
                <Button kind="danger" onClick={() => setDeleteModalOpen(true)}>
                    {tr("profileSettings.deleteAccount")}
                </Button>
                {accountState.error ? (
                    <InlineNotification
                        className={styles.statusMessage}
                        kind="error"
                        title={tr("profileSettings.accountDeleteFailed") as string}
                        subtitle={accountState.error}
                        hideCloseButton
                    />
                ) : null}
            </div>

            <ComposedModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
                <ModalHeader title={tr("profileSettings.deleteAccount") as string} label={tr("profileSettings.dangerZone") as string} />
                <ModalBody>
                    <p className={styles.warningText}>
                        {tr("profileSettings.deleteAccountWarning")}
                    </p>
                    <TextInput
                        id="delete-account-confirm"
                        labelText={tr("profileSettings.deleteAccountConfirmationText") as string}
                        value={deleteConfirmText}
                        onChange={(event) => setDeleteConfirmText(event.currentTarget.value)}
                    />
                </ModalBody>
                <ModalFooter>
                    <Button kind="secondary" onClick={() => setDeleteModalOpen(false)}>
                        {tr("common.cancel")}
                    </Button>
                    <Button kind="danger" onClick={handleDeleteAccount} disabled={accountState.loading}>
                        {tr("profileSettings.deleteAccountConfirmButton")}
                    </Button>
                </ModalFooter>
            </ComposedModal>
        </section>
    );
}
