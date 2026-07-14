import { EmptyState } from "@/components/common/EmptyState/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge/StatusBadge";
import Tble, { TbleFilterType, TbleSortType, type TblRw } from "@/components/Tble";
import { useLocalization } from "@/contexts/LocalizationContext";
import type {
  AlertNotification,
  AlertRule,
  ProfileAlertsData,
} from "@/types/profile";
import { Pencil, PlayCircle, Plus, PauseCircle, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import localStyles from "./ProfileAlertTab.module.scss";
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
      <EmptyState
        title={tr("profileTabs.alerts.unavailableTitle")}
        message={tr("profileTabs.alerts.unavailableDescription")}
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
          status: (value: unknown) => {
            const s = String(value ?? "");
            if (s === "active") return <StatusBadge label="Active" variant="success" size="sm" />;
            if (s === "paused") return <StatusBadge label="Paused" variant="warning" size="sm" />;
            return <StatusBadge label={s} variant="neutral" size="sm" />;
          },
          actions: (_value: unknown, row: TblRw) => {
            const rule = row.rule as AlertRule | undefined;
            if (!rule) return null;

            return (
              <div className={localStyles.inlineActions}>
                <button type="button" className={localStyles.btnGhost} onClick={() => openEditModal(rule)} title="Edit">
                  <Pencil size={14} />
                </button>
                <button type="button" className={localStyles.btnGhost} title="Pause/Resume">
                  {rule.status === "paused" ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                </button>
                <button type="button" className={localStyles.btnDangerGhost} title="Delete">
                  <Trash2 size={14} />
                </button>
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
            <Plus size={20} />
            Add alert
          </button>
        }
      />

      {isEditorOpen && (
        <div className={localStyles.modalOverlay} onClick={closeEditorModal}>
          <div className={localStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={localStyles.modalHeader}>
              <div>
                <span className={localStyles.modalEyebrow}>Alerts</span>
                <h2 className={localStyles.modalTitle}>{modalTitle}</h2>
              </div>
              <button type="button" className={localStyles.modalClose} onClick={closeEditorModal}>
                <X size={18} />
              </button>
            </div>

            <div className={localStyles.modalBody}>
              <div className={localStyles.formGroup}>
                <label className={localStyles.fieldLabel} htmlFor="alert-token">Token</label>
                <input
                  id="alert-token"
                  className={localStyles.fieldInput}
                  defaultValue={editingRule?.tokenSymbol ?? ""}
                  placeholder="SOL"
                />
              </div>
              <div className={localStyles.formGroup}>
                <label className={localStyles.fieldLabel} htmlFor="alert-type">Alert type</label>
                <select
                  id="alert-type"
                  className={localStyles.fieldSelect}
                  defaultValue={editingRule?.alertType ?? "price"}
                >
                  <option value="price">Price</option>
                  <option value="volume">Volume</option>
                  <option value="trend">Trend</option>
                </select>
              </div>
              <div className={localStyles.formGroup}>
                <label className={localStyles.fieldLabel} htmlFor="alert-condition">Condition</label>
                <input
                  id="alert-condition"
                  className={localStyles.fieldInput}
                  defaultValue={editingRule?.conditionText ?? ""}
                  placeholder="Price > 210"
                />
              </div>
              <div className={localStyles.formGroup}>
                <label className={localStyles.fieldLabel} htmlFor="alert-channels">Channels</label>
                <textarea
                  id="alert-channels"
                  className={localStyles.fieldTextarea}
                  placeholder="Email, Telegram"
                />
              </div>
              <div className={localStyles.formGroup}>
                <label className={localStyles.toggleRow}>
                  <span className={localStyles.fieldLabel}>Enable alert</span>
                  <label className={localStyles.toggleSwitch}>
                    <input type="checkbox" defaultChecked={editingRule?.status !== "paused"} />
                    <span className={localStyles.toggleSlider} />
                  </label>
                </label>
              </div>
            </div>

            <div className={localStyles.modalFooter}>
              <button type="button" className={localStyles.btnSecondary} onClick={closeEditorModal}>
                Cancel
              </button>
              <button type="button" className={localStyles.btnPrimary} onClick={closeEditorModal}>
                Save alert
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface ProfileAlertNotificationPanelProps {
  notifications: AlertNotification[];
}

export function ProfileAlertNotificationPanel({
  notifications,
}: ProfileAlertNotificationPanelProps) {
  if (notifications.length === 0) {
    return (
      <EmptyState
        title="No notifications"
        message="You have no alert notifications yet."
        compact
      />
    );
  }

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
