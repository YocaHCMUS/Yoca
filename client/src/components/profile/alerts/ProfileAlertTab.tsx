import ProfileUnavailableState from "@/components/profile/shared/ProfileUnavailableState";
import { FilterType, SortType, Table } from "@/components/tables/Table";
import { useLocalization } from "@/contexts/LocalizationContext";
import type {
  AlertNotification,
  AlertRule,
  ProfileAlertsData,
} from "@/types/profile";
import {
  getAlertHistory,
  markAllAlertHistoryRead,
  setAlertHistoryRead,
} from "@/services/notifications/alertHistoryApi";
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
import { useEffect, useMemo, useState } from "react";
import styles from "@/components/profile/shared/profile.module.scss";

interface ProfileAlertTabProps {
  data: ProfileAlertsData;
}

export function ProfileAlertTab({ data }: ProfileAlertTabProps) {
  const { tr } = useLocalization();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [notifications, setNotifications] = useState(data.notifications);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAlertHistory()
      .then((result) => {
        if (!active) return;
        setNotifications(result.notifications);
        setHistoryError(null);
      })
      .catch((error) => {
        if (!active) return;
        setHistoryError(
          error instanceof Error ? error.message : "Failed to load alert history",
        );
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const modalTitle = useMemo(() => {
    if (!editingRule) return tr("profileTabs.alerts.createAlertTitle");
    return tr("profileTabs.alerts.editAlertTitle", {
      token: editingRule.tokenSymbol,
    });
  }, [editingRule, tr]);

  if (
    data.alerts.length === 0 &&
    notifications.length === 0 &&
    !historyLoading &&
    !historyError
  ) {
    return (
      <ProfileUnavailableState
        title={tr("profileTabs.alerts.unavailableTitle")}
        description={tr("profileTabs.alerts.unavailableDescription")}
      />
    );
  }

  const alertTableData = data.alerts.map((rule) => [
    rule.tokenSymbol,
    rule.alertType,
    rule.conditionText,
    rule.status,
    new Date(rule.updatedAt).toLocaleString(),
    rule.id,
  ]);
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

  const tableHeaders = [
    tr("profileTabs.alerts.tableHeaders.token"),
    tr("profileTabs.alerts.tableHeaders.type"),
    tr("profileTabs.alerts.tableHeaders.condition"),
    tr("profileTabs.alerts.tableHeaders.status"),
    tr("profileTabs.alerts.tableHeaders.updated"),
    tr("profileTabs.alerts.tableHeaders.actions"),
  ];

  return (
    <section className={styles.contentStack}>
      <Table
        title={tr("profileTabs.alerts.tableTitle") as string}
        headers={tableHeaders}
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

      <ProfileAlertNotificationPanel
        notifications={notifications}
        loading={historyLoading}
        error={historyError}
        onToggleRead={async (notification) => {
          const nextRead = notification.readAt == null;
          await setAlertHistoryRead(notification.id, nextRead);
          setNotifications((current) =>
            current.map((item) =>
              item.id == notification.id
                ? {
                    ...item,
                    readAt: nextRead ? new Date().toISOString() : null,
                  }
                : item,
            ),
          );
        }}
        onMarkAllRead={async () => {
          await markAllAlertHistoryRead();
          const readAt = new Date().toISOString();
          setNotifications((current) =>
            current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
          );
        }}
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
  loading: boolean;
  error: string | null;
  onToggleRead: (notification: AlertNotification) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}

export function ProfileAlertNotificationPanel({
  notifications,
  loading,
  error,
  onToggleRead,
  onMarkAllRead,
}: ProfileAlertNotificationPanelProps) {
  if (loading) {
    return <section className={styles.contentStack}>Loading alert history...</section>;
  }

  return (
    <section className={styles.contentStack}>
      <div className={styles.inlineActions}>
        <h3>Alert notifications</h3>
        {notifications.some((note) => note.readAt == null) ? (
          <Button size="sm" kind="ghost" onClick={() => void onMarkAllRead()}>
            Mark all as read
          </Button>
        ) : null}
      </div>
      {error ? <p>{error}</p> : null}
      {!error && notifications.length == 0 ? <p>No alert history yet.</p> : null}
      {notifications.map((note) => (
        <article key={note.id} className={styles.notificationItem}>
          <strong>{note.severity.toUpperCase()}</strong>
          {note.title ? <h4>{note.title}</h4> : null}
          <p>{note.message}</p>
          <small>{new Date(note.timestamp).toLocaleString()}</small>
          <Button size="sm" kind="ghost" onClick={() => void onToggleRead(note)}>
            {note.readAt == null ? "Mark as read" : "Mark as unread"}
          </Button>
        </article>
      ))}
    </section>
  );
}

export default ProfileAlertTab;
