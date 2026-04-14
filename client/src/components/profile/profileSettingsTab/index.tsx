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
                label: "Password / Email",
                value: snapshot.email?.trim() || "Not set",
                connected: snapshot.hasPassword,
            },
            {
                key: "google",
                label: "Google Mail OAuth",
                value: hasGoogle ? "Connected" : "Not connected",
                connected: hasGoogle,
            },
            {
                key: "solana",
                label: "Solana Wallet",
                value: authWallet?.walletAddress || "Not connected",
                connected: hasSolana,
            },
        ];
    }, [snapshot]);

    const handleSaveIdentity = async () => {
        if (!snapshot) {
            return;
        }

        setIdentityState({ loading: true });
        try {
            const nextSnapshot = await updateProfileIdentity({
                displayName: displayName.trim() || null,
                email: email.trim().toLowerCase() || null,
            });
            hydrateFromSnapshot(nextSnapshot);
            await refreshUser();
            setIdentityState({ loading: false, success: "Identity updated" });
        } catch (error) {
            setIdentityState({ loading: false, error: toMessage(error) });
        }
    };

    const handleUpdatePassword = async () => {
        if (newPassword !== confirmPassword) {
            setPasswordState({ loading: false, error: "New password and confirmation do not match" });
            return;
        }

        setPasswordState({ loading: true });
        try {
            await updatePassword({
                currentPassword: hasPassword ? currentPassword : undefined,
                newPassword,
            });

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordEditorOpen(false);
            setPasswordState({ loading: false, success: hasPassword ? "Password changed" : "Password added" });
            await loadSnapshot();
        } catch (error) {
            setPasswordState({ loading: false, error: toMessage(error) });
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText.trim() !== "DELETE MY ACCOUNT") {
            setAccountState({ loading: false, error: "Confirmation text mismatch" });
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
        return <InlineLoading description="Loading settings" status="active" />;
    }

    return (
        <section className={styles.container}>
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Identity</h3>
                <div className={styles.row}>
                    <TextInput
                        id="profile-settings-display-name"
                        labelText="Display name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.currentTarget.value)}
                        className={styles.input}
                    />
                    <TextInput
                        id="profile-settings-email"
                        labelText="Email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.currentTarget.value)}
                        className={styles.input}
                    />
                </div>
                <div className={styles.actionRow}>
                    <Button kind="primary" onClick={handleSaveIdentity} disabled={identityState.loading}>
                        Save identity
                    </Button>
                    {identityState.loading ? <InlineLoading description="Saving identity" status="active" /> : null}
                </div>
                {identityState.error ? (
                    <InlineNotification
                        className={styles.statusMessage}
                        kind="error"
                        title="Identity update failed"
                        subtitle={identityState.error}
                        hideCloseButton
                    />
                ) : null}
                {identityState.success ? (
                    <InlineNotification
                        className={styles.statusMessage}
                        kind="success"
                        title="Success"
                        subtitle={identityState.success}
                        hideCloseButton
                    />
                ) : null}
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Login methods</h3>
                <div className={styles.methodList}>
                    {loginMethods.map((method) => (
                        <div key={method.key} className={styles.methodRow}>
                            <div>
                                <p className={styles.methodLabel}>{method.label}</p>
                                <p className={styles.methodValue}>{method.value}</p>
                            </div>
                            <div className={styles.methodActions}>
                                <span className={method.connected ? styles.statusConnected : styles.statusMuted}>
                                    {method.connected ? "Connected" : "Not connected"}
                                </span>
                                {method.key === "password" ? (
                                    <Button
                                        kind="tertiary"
                                        size="sm"
                                        onClick={() => setPasswordEditorOpen((prev) => !prev)}
                                    >
                                        {hasPassword ? "Change password" : "Add password"}
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
                <ComposedModal
                    open={passwordEditorOpen}
                    onClose={() => setPasswordEditorOpen(false)}
                >
                    <ModalHeader
                        title={hasPassword ? "Change password" : "Add password"}
                        label="Login methods"
                    />
                    <ModalBody>
                        <div>
                            {hasPassword ? (
                                <PasswordInput
                                    id="profile-settings-current-password"
                                    labelText="Current password"
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                                    className={styles.input}
                                />
                            ) : null}
                            <PasswordInput
                                id="profile-settings-new-password"
                                labelText="New password"
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.currentTarget.value)}
                                className={styles.input}
                            />
                            <PasswordInput
                                id="profile-settings-confirm-password"
                                labelText="Confirm password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                                className={styles.input}
                            />
                        </div>
                        {passwordState.loading ? <InlineLoading description="Updating password" status="active" /> : null}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            kind="secondary"
                            onClick={() => setPasswordEditorOpen(false)}
                            disabled={passwordState.loading}
                        >
                            Cancel
                        </Button>
                        <Button kind="primary" onClick={handleUpdatePassword} disabled={passwordState.loading}>
                            Save password
                        </Button>
                    </ModalFooter>
                </ComposedModal>
                {passwordState.error ? (
                    <InlineNotification
                        className={styles.statusMessage}
                        kind="error"
                        title="Password update failed"
                        subtitle={passwordState.error}
                        hideCloseButton
                    />
                ) : null}
                {passwordState.success ? (
                    <InlineNotification
                        className={styles.statusMessage}
                        kind="success"
                        title="Success"
                        subtitle={passwordState.success}
                        hideCloseButton
                    />
                ) : null}
            </div>

            <div className={`${styles.section} ${styles.dangerSection}`}>
                <h3 className={styles.sectionTitle}>Danger zone</h3>
                <p className={styles.dangerHint}>
                    Delete account removes profile and all linked auth/wallet data.
                </p>
                <Button kind="danger" onClick={() => setDeleteModalOpen(true)}>
                    Delete account
                </Button>
                {accountState.error ? (
                    <InlineNotification
                        className={styles.statusMessage}
                        kind="error"
                        title="Account deletion failed"
                        subtitle={accountState.error}
                        hideCloseButton
                    />
                ) : null}
            </div>

            <ComposedModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
                <ModalHeader title="Delete account" label="Danger zone" />
                <ModalBody>
                    <p className={styles.warningText}>
                        This action is permanent. Type DELETE MY ACCOUNT to confirm.
                    </p>
                    <TextInput
                        id="delete-account-confirm"
                        labelText="Confirmation text"
                        value={deleteConfirmText}
                        onChange={(event) => setDeleteConfirmText(event.currentTarget.value)}
                    />
                </ModalBody>
                <ModalFooter>
                    <Button kind="secondary" onClick={() => setDeleteModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button kind="danger" onClick={handleDeleteAccount} disabled={accountState.loading}>
                        Confirm delete
                    </Button>
                </ModalFooter>
            </ComposedModal>
        </section>
    );
}
