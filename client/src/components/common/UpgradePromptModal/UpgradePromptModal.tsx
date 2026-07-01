import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "@/components/common/IconButton/IconButton";
import styles from "./UpgradePromptModal.module.scss";

interface UpgradePromptModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

export function UpgradePromptModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  children,
}: UpgradePromptModalProps) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-prompt-title"
      onMouseDown={onClose}
    >
      <div className={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.icon}>AI</div>
          <IconButton icon={X} label={cancelLabel} onClick={onClose} size="sm" />
        </div>
        <h2 id="upgrade-prompt-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.description}>{description}</p>
        {children && <div className={styles.body}>{children}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={styles.primaryButton} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
