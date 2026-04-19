import { ChevronDown, WarningFilled } from "@carbon/icons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import styles from "./DropdownPanelField.module.scss";

interface DropdownPanelFieldRenderParams<TValue> {
  closePanel: () => void;
  setValue: (value: TValue | null) => void;
  value: TValue | null;
  isOpen: boolean;
}

interface DropdownPanelFieldProps<TValue> {
  id: string;
  titleText: string;
  placeholder: ReactNode;
  helperText?: string;
  invalid?: boolean;
  invalidText?: ReactNode;
  initialValue?: TValue | null;
  onValueChange?: (value: TValue | null) => void;
  renderValue?: (value: TValue) => ReactNode;
  renderPanel: (params: DropdownPanelFieldRenderParams<TValue>) => ReactNode;
}

export default function DropdownPanelField<TValue = string>({
  id,
  titleText,
  placeholder,
  helperText,
  invalid = false,
  invalidText,
  initialValue,
  onValueChange,
  renderValue,
  renderPanel,
}: DropdownPanelFieldProps<TValue>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [value, setValueState] = useState<TValue | null>(initialValue ?? null);

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

  const setValue = (nextValue: TValue | null) => {
    setValueState(nextValue);
    onValueChange?.(nextValue);
  };

  const selectedValueNode =
    value == null
      ? placeholder
      : renderValue
        ? renderValue(value)
        : String(value);

  const resolvedInvalidText = invalidText ?? "A valid value is required";
  const helperTextId = `${id}-helper`;
  const invalidTextId = `${id}-error-msg`;
  const describedBy = invalid
    ? invalidTextId
    : helperText
      ? helperTextId
      : undefined;

  return (
    <div className="cds--form-item" ref={rootRef}>
      <div
        className={`cds--select ${invalid ? "cds--select--invalid" : ""} ${styles.container}`}
      >
        <label htmlFor={id} className="cds--label">
          {titleText}
        </label>

        <div
          className="cds--select-input__wrapper"
          data-invalid={invalid || null}
          ref={triggerRef}
        >
          <button
            id={id}
            type="button"
            className={`cds--select-input cds--select-input--md ${styles.trigger} ${invalid ? styles.invalidTrigger : ""}`}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onClick={() => setIsOpen((current) => !current)}
          >
            <div>{selectedValueNode}</div>
          </button>

          {invalid && (
            <WarningFilled className="cds--select__invalid-icon" size={16} />
          )}

          <ChevronDown
            className={`cds--select__arrow ${isOpen ? styles.openArrow : ""}`}
            size={16}
          />
        </div>

        {invalid ? (
          <div id={invalidTextId} className="cds--form-requirement">
            {resolvedInvalidText}
          </div>
        ) : (
          helperText && (
            <div id={helperTextId} className="cds--form__helper-text">
              {helperText}
            </div>
          )
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
