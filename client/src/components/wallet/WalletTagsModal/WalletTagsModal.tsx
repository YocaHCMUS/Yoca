import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Close } from "@carbon/react/icons";
import { ID_MODAL_ROOT } from "@/config/constants";
import styles from "./WalletTagsModal.module.scss";

function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export interface WalletTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tags: string[]) => void;
  walletAddress: string;
  walletLabel?: string;
  initialTags: string[];
}

export function WalletTagsModal({
  isOpen,
  onClose,
  onSave,
  walletAddress,
  walletLabel,
  initialTags,
}: WalletTagsModalProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTags([...initialTags]);
      setInputValue("");
    }
  }, [isOpen, initialTags]);

  useEffect(() => {
    if (isOpen) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const commitTag = useCallback((raw: string) => {
    const value = raw.trim().replace(/,$/, "").trim();
    if (!value) return;
    setTags((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setInputValue("");
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTag(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.endsWith(",")) {
      commitTag(val);
    } else {
      setInputValue(val);
    }
  };

  const removeTag = (index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const pending = inputValue.trim().replace(/,$/, "").trim();
    const finalTags =
      pending && !tags.includes(pending) ? [...tags, pending] : tags;
    onSave(finalTags);
    onClose();
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
      aria-label="Manage wallet tags"
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Manage Wallet Tags</span>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <Close size={20} />
          </button>
        </div>

        <div className={styles.context}>
          {walletLabel && (
            <span className={styles.walletLabel}>{walletLabel}</span>
          )}
          <span className={styles.walletAddress} title={walletAddress}>
            {truncateAddress(walletAddress)}
          </span>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="wtm-tag-input">
              Tags
            </label>

            <div
              className={styles.tagInputContainer}
              onClick={() => inputRef.current?.focus()}
            >
              {tags.map((tag, i) => (
                <span key={tag} className={styles.tagChip}>
                  {tag}
                  <button
                    className={styles.tagChipRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTag(i);
                    }}
                    aria-label={`Remove tag ${tag}`}
                    type="button"
                  >
                    <Close size={12} />
                  </button>
                </span>
              ))}

              <input
                id="wtm-tag-input"
                ref={inputRef}
                className={styles.tagInput}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                placeholder={tags.length === 0 ? "e.g. Whale, Smart Money" : ""}
                maxLength={30}
                aria-label="New tag"
              />
            </div>

            <span className={styles.hint}>
              Press <kbd className={styles.kbd}>Enter</kbd> or type a{" "}
              <kbd className={styles.kbd}>,</kbd> to add a tag.
            </span>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={styles.saveBtn} onClick={handleSave} type="button">
            Save
          </button>
        </div>
      </div>
    </div>,
    modalRoot,
  );
}
