import ProfileUnavailableState from "@/components/profile/shared/ProfileUnavailableState";
import Tble, { TbleFilterType, TbleSortType, type TblRw } from "@/components/Tble";
import { useLocalization } from "@/contexts/LocalizationContext";
import type {
  AlertNotification,
  AlertRule,
  ProfileAlertsData,
} from "@/types/profile";
import { AddLarge } from "@carbon/icons-react";
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
import styles from "@/components/profile/shared/profile.module.scss";

interface ProfileAlertTabProps {
  data: ProfileAlertsData;
}

export function ProfileAlertTab({ data }: ProfileAlertTabProps) {
  const { tr } = useLocalization();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const modalTitle = useMemo(() => {
    if (!editingRule) return tr("profileTabs.alerts.createAlertTitle");
    return tr("profileTabs.alerts.editAlertTitle", {
      token: editingRule.tokenSymbol,
    });
  }, [editingRule, tr]);

  const alertTableRows = useMemo(() =>
    data.alerts.map((rule) => ({
      id: String(rule.id),
      token: rule.tokenSymbol,
      type: rule.alertType,
      condition: rule.conditionText,
      status: rule.status,
      updated: new Date(rule.updatedAt).toLocaleString(),
      rule,
    } as TblRw)),
  [data.alerts]);

  if (data.alerts.length === 0 && data.notifications.length === 0) {
    return (
      <ProfileUnavailableState
        title={tr("profileTabs.alerts.unavailableTitle")}
        description={tr("profileTabs.alerts.unavailableDescription")}
      />
    );
  }

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
      <Tble
        title={tr("profileTabs.alerts.tableTitle") as string}
        headers={[
          { key: "token", header: tr("profileTabs.alerts.tableHeaders.token") },
          { key: "type", header: tr("profileTabs.alerts.tableHeaders.type") },
          { key: "condition", header: tr("profileTabs.alerts.tableHeaders.condition") },
          { key: "status", header: tr("profileTabs.alerts.tableHeaders.status") },
          { key: "updated", header: tr("profileTabs.alerts.tableHeaders.updated") },
          { key: "actions", header: tr("profileTabs.alerts.tableHeaders.actions") },
        ]}
        rows={alertTableRows}
        cellRenderers={{
          actions: (_value: unknown, row: TblRw) => {
            const rule = row.rule as AlertRule | undefined;
            if (!rule) return null;

            return (
              <div className={styles.inlineActions}>
                <Button size="sm" kind="ghost" onClick={() => openEditModal(rule)}>
                  Edit
                </Button>
                <Button size="sm" kind="ghost">Pause/Resume</Button>
                <Button size="sm" kind="ghost">Delete</Button>
              </div>
            );
          },
        }}
        filterSchema={{
          token: { type: TbleFilterType.Select },
          type: { type: TbleFilterType.Select },
          status: { type: TbleFilterType.Select },
        }}
        sortConfigs={{
          updated: { type: TbleSortType.Number },
        }}
        toolBar={
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
            <TextArea
              id="alert-channels"
              labelText="Channels"
              placeholder="Email, Telegram"
            />
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
