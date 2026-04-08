import { FilterType, SortType, Table } from "@/components/tables/Table";
import type { AlertNotification, AlertRule, ProfileAlertsData } from "@/types/profile";
import {
    Button,
    ComposedModal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    TextArea,
    TextInput,
    Toggle,
} from "@carbon/react";
import { useMemo, useState } from "react";
import { AddLarge } from "@carbon/icons-react";
import styles from "./profile.module.scss";


interface ProfileAlertTabProps {
    data: ProfileAlertsData;
}

export function ProfileAlertTab({ data }: ProfileAlertTabProps) {
    const alertTableData = data.alerts.map((rule) => [
        rule.tokenSymbol,
        rule.alertType,
        rule.conditionText,
        rule.status,
        new Date(rule.updatedAt).toLocaleString(),
        rule.id,
    ]);

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

    const modalTitle = useMemo(() => {
        if (!editingRule) return "Create alert";
        return `Edit ${editingRule.tokenSymbol} alert`;
    }, [editingRule]);

    const openCreateModal = () => {
        setEditingRule(null);
        setIsEditorOpen(true);
    };

    const openEditModal = (rule: AlertRule) => {
        setEditingRule(rule);
        setIsEditorOpen(true);
    };

    const closeEditorModal = () => {
        setIsEditorOpen(false);
        setEditingRule(null);
    };

    return (
        <section className={styles.contentStack}>
            <Table
                title="Alert list"
                headers={[
                    "Token",
                    "Type",
                    "Condition",
                    "Status",
                    "Updated",
                    "Actions",
                ]}
                initialFilters={{}}
                fetcher={Promise.resolve([])}
                filterSchema={{
                    0: { type: FilterType.Select },
                    1: { type: FilterType.Select },
                    3: { type: FilterType.Select },
                }}
                dataEntries={alertTableData}
                cellRenderers={[
                    null,
                    null,
                    null,
                    null,
                    null,
                    (_value, row) => {
                        const rule = data.alerts.find((item) => item.id === row[5]);

                        if (!rule) return null;

                        return (
                            <div className={styles.inlineActions}>
                                <Button
                                    size="sm"
                                    kind="ghost"
                                    onClick={() => openEditModal(rule)}
                                >
                                    Edit
                                </Button>
                                <Button size="sm" kind="ghost">
                                    Pause/Resume
                                </Button>
                                <Button size="sm" kind="ghost">
                                    Delete
                                </Button>
                            </div>
                        );
                    },
                ]}
                isSortable={[true, true, false, true, true, false]}
                sortConfigs={{
                    4: { type: SortType.Date },
                }}
                actions={
                    <button className={styles.triggerButton} onClick={openCreateModal}>
                        <AddLarge size={20} />
                        Add alert
                    </button>
                }
            />

            <ComposedModal open={isEditorOpen} onClose={closeEditorModal}>
                <ModalHeader label="Alerts" title={modalTitle} />
                <ModalBody hasScrollingContent>
                    <form className={styles.contentStack}>
                        <TextInput
                            id="alert-token"
                            labelText="Token"
                            defaultValue={editingRule?.tokenSymbol ?? ""}
                            placeholder="SOL"
                        />
                        <TextInput
                            id="alert-type"
                            labelText="Alert type"
                            defaultValue={editingRule?.alertType ?? "price"}
                            placeholder="price"
                        />
                        <TextInput
                            id="alert-condition"
                            labelText="Condition"
                            defaultValue={editingRule?.conditionText ?? ""}
                            placeholder="Price > 210"
                        />
                        <TextArea id="alert-channels" labelText="Channels" placeholder="Email, Telegram" />
                        <Toggle
                            id="alert-enabled"
                            labelText="Enable alert"
                            labelA="Disabled"
                            labelB="Enabled"
                            defaultToggled={editingRule?.status !== "paused"}
                        />
                    </form>
                </ModalBody>
                <ModalFooter>
                    <Button kind="secondary" onClick={closeEditorModal}>
                        Cancel
                    </Button>
                    <Button onClick={closeEditorModal}>Save alert</Button>
                </ModalFooter>
            </ComposedModal>
        </section>
    );
}

interface ProfileAlertNotificationPanelProps {
    notifications: AlertNotification[];
}

export function ProfileAlertNotificationPanel({
    notifications,
}: ProfileAlertNotificationPanelProps) {
    return (
        <section className={styles.contentStack}>
            <h3>Alert notifications</h3>
            {notifications.map((note) => (
                <article key={note.id} className={styles.notificationItem}>
                    <strong>{note.severity.toUpperCase()}</strong>
                    <p>{note.message}</p>
                    <small>{new Date(note.timestamp).toLocaleString()}</small>
                </article>
            ))}
        </section>
    );
}

export default ProfileAlertTab;
