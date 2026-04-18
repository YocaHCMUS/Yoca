import { ChevronDown } from "@carbon/icons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import styles from "./DropdownPanelField.module.scss";

interface DropdownPanelFieldRenderParams {
  closePanel: () => void;
  setValue: (value: string | null) => void;
  value: string | null;
  isOpen: boolean;
}

interface DropdownPanelFieldProps {
  id: string;
  titleText: string;
  placeholder: string;
  helperText?: string;
  initialValue?: string;
  onValueChange?: (value: string | null) => void;
  renderPanel: (params: DropdownPanelFieldRenderParams) => ReactNode;
}

export default function DropdownPanelField({
  id,
  titleText,
  placeholder,
  helperText,
  initialValue,
  onValueChange,
  renderPanel,
}: DropdownPanelFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [value, setValueState] = useState<string | null>(initialValue || null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInTrigger = !!triggerRef.current?.contains(target);
      const isInPanel = !!panelRef.current?.contains(target);
      const isInRoot = !!rootRef.current?.contains(target);

      if (!isInTrigger && !isInPanel && !isInRoot) {
        setIsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key == "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const setValue = (nextValue: string | null) => {
    setValueState(nextValue);
    onValueChange?.(nextValue);
  };

  return (
    <div className="cds--form-item" ref={rootRef}>
      <div className={`cds--select ${styles.container}`}>
        <label htmlFor={id} className="cds--label">
          {titleText}
        </label>

        <div className="cds--select-input__wrapper" ref={triggerRef}>
          <button
            id={id}
            type="button"
            className={`cds--select-input cds--select-input--md ${styles.trigger}`}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((current) => !current)}
          >
            <span className={styles.valueText}>{value || placeholder}</span>
          </button>

          <ChevronDown
            className={`cds--select__arrow ${isOpen ? styles.openArrow : ""}`}
            size={16}
          />
        </div>

        {helperText && (
          <div className="cds--form__helper-text">{helperText}</div>
        )}

        <div
          ref={panelRef}
          className={`${styles.panel} ${isOpen ? styles.panelOpen : styles.panelClosed}`}
          role="dialog"
          aria-label={titleText}
          aria-hidden={!isOpen}
        >
          {renderPanel({
            closePanel: () => setIsOpen(false),
            setValue,
            value,
            isOpen,
          })}
        </div>
      </div>
    </div>
  );
}
