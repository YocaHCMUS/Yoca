import { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import { X as Close } from "lucide-react";
import { ID_MODAL_ROOT } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import styles from "./WalletLabelModal.module.scss";

// ── Helpers ────────────────────────────────────────────────────────────────

function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface WalletLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (label: string) => void;
  walletAddress: string;
  initialLabel?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function WalletLabelModal({
  isOpen,
  onClose,
  onSave,
  walletAddress,
  initialLabel = "",
}: WalletLabelModalProps) {
  const { tr } = useLocalization();
  const [label, setLabel] = useState(initialLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync label when initialLabel changes (e.g. modal re-opened for different wallet)
  useEffect(() => {
    if (isOpen) {
      setLabel(initialLabel);
    }
  }, [isOpen, initialLabel]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Allow the portal render to complete before focusing
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleSave = () => {
    onSave(label.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSave();
  };

  if (!isOpen) return null;

  const modalRoot = document.getElementById(ID_MODAL_ROOT);
  if (!modalRoot) return null;

  return ReactDOM.createPortal(
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={String(tr("walletPage.ui.assignLabel"))}
    >
      <div
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={styles.header}>
          <span className={styles.title}>{tr("walletPage.ui.assignLabel")}</span>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={String(tr("walletPage.ui.dismiss"))}
          >
            <Close size={20} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>
          {/* Read-only wallet address */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="wlm-address">
              {tr("walletPage.ui.walletAddress")}
            </label>
            <input
              id="wlm-address"
              className={styles.addressInput}
              type="text"
              value={truncateAddress(walletAddress)}
              title={walletAddress}
              readOnly
              aria-readonly="true"
            />
          </div>

          {/* Editable label */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="wlm-label">
              {tr("walletPage.ui.customLabel")}
            </label>
            <input
              id="wlm-label"
              ref={inputRef}
              className={styles.labelInput}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={30}
              placeholder={String(tr("walletPage.ui.labelPlaceholder"))}
              aria-label={String(tr("walletPage.ui.customLabel"))}
            />
            <span className={styles.charCount}>{label.length} / 30</span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            type="button"
          >
            {tr("walletPage.ui.cancel")}
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            type="button"
          >
            {tr("walletPage.ui.save")}
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
}
