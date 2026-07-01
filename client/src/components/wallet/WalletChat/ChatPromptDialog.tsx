import { useState } from "react";
import { useLocalization } from "@/contexts/LocalizationContext";
import styles from "./WalletChat.module.scss";
import type { ChatPromptData, CreatePromptInput, UpdatePromptInput } from "./useChatPrompts";

interface Props {
  mode: "create" | "edit" | "fork" | "view";
  initial?: ChatPromptData | null;
  forkedFrom?: ChatPromptData | null;
  onSubmit?: (input: CreatePromptInput | UpdatePromptInput) => Promise<boolean>;
  onClose: () => void;
}

export function ChatPromptDialog({ mode, initial, forkedFrom, onSubmit, onClose }: Props) {
  const { tr } = useLocalization();
  const [label, setLabel] = useState(initial?.label ?? forkedFrom?.label ?? "");
  const [query, setQuery] = useState(initial?.query ?? forkedFrom?.query ?? "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleKey = mode === "create" ? "chat.prompt.dialogCreateTitle"
    : mode === "fork" ? "chat.prompt.dialogForkTitle"
      : mode === "edit" ? "chat.prompt.dialogEditTitle"
        : "chat.prompt.dialogViewTitle";

  const handleSubmit = async () => {
    if (!label.trim() || !query.trim()) {
      setError(tr("chat.prompt.dialogRequired"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const input: CreatePromptInput = {
      label: label.trim(),
      query: query.trim(),
      isPublic,
      contextTypes: ["wallet"],
      forkedFrom: mode === "fork" ? (forkedFrom?.id ?? null) : undefined,
    };

    const ok = await onSubmit!(input);
    setIsSubmitting(false);

    if (ok) {
      onClose();
    } else {
      setError(tr("chat.prompt.dialogSaveError"));
    }
  };

  const renderViewContent = () => {
    const data = initial;
    if (!data) return null;

    return (
      <>
        <div className={styles.dialogField}>
          <div className={styles.dialogLabel}>{tr("chat.prompt.dialogLabel")}</div>
          <div className={styles.dialogInput}>{data.label}</div>
        </div>

        <div className={styles.dialogField}>
          <div className={styles.dialogLabel}>{tr("chat.prompt.dialogQuery")}</div>
          <div className={styles.dialogTextarea}>{data.query}</div>
        </div>

        <div className={styles.dialogField}>
          <div className={styles.promptItemMeta}>
            <span>{tr("chat.prompt.uses", { count: data.usageCount })}</span>
            {data.isPublic && <span>{tr("chat.prompt.publicBadge")}</span>}
          </div>
        </div>

        <div className={styles.dialogFooter}>
          <button
            className={`${styles.dialogBtn} ${styles.dialogBtnCancel}`}
            onClick={onClose}
          >
            {tr("common.cancel")}
          </button>
        </div>
      </>
    );
  };

  if (mode === "view") {
    return (
      <div className={styles.dialogBackdrop} onClick={onClose}>
        <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
          <div className={styles.dialogTitle}>{tr(titleKey)}</div>
          {renderViewContent()}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dialogBackdrop} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogTitle}>{tr(titleKey)}</div>

        {forkedFrom && (
          <div className={styles.dialogForkedInfo}>
            {tr("chat.prompt.forkedFrom", { label: forkedFrom.label })}
          </div>
        )}

        {error && <div className={styles.dialogError}>{error}</div>}

        <div className={styles.dialogField}>
          <label className={styles.dialogLabel}>{tr("chat.prompt.dialogLabel")}</label>
          <input
            className={styles.dialogInput}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={tr("chat.prompt.dialogLabel")}
            maxLength={255}
          />
        </div>

        <div className={styles.dialogField}>
          <label className={styles.dialogLabel}>{tr("chat.prompt.dialogQuery")}</label>
          <textarea
            className={styles.dialogTextarea}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("chat.prompt.dialogQuery")}
            maxLength={2000}
            rows={4}
          />
        </div>

        <div className={styles.dialogField}>
          <label className={styles.dialogCheckbox}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            {tr("chat.prompt.dialogPublic")}
          </label>
        </div>

        <div className={styles.dialogFooter}>
          <button
            className={`${styles.dialogBtn} ${styles.dialogBtnCancel}`}
            onClick={onClose}
          >
            {tr("common.cancel")}
          </button>
          <button
            className={`${styles.dialogBtn} ${styles.dialogBtnSubmit}`}
            onClick={handleSubmit}
            disabled={isSubmitting || !label.trim() || !query.trim()}
          >
            {isSubmitting ? tr("chat.prompt.dialogSaving")
              : mode === "edit" ? tr("chat.prompt.dialogSave")
                : tr("chat.prompt.dialogCreate")}
          </button>
        </div>
      </div>
    </div>
  );
}
