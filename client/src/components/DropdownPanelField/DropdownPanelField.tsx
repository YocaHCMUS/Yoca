import { ChevronDown, WarningFilled } from "@carbon/icons-react";
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

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
  // Uncontrolled: initial value
  initialValue?: TValue | null;
  // Controlled: current value
  value?: TValue | null;
  // Callback when value changes (works for both modes)
  onValueChange?: (value: TValue | null) => void;
  renderValue?: (value: TValue) => ReactNode;
  renderPanel: (params: DropdownPanelFieldRenderParams<TValue>) => ReactNode;
  style?: CSSProperties
}

export default function DropdownPanelField<TValue = string>({
  id,
  titleText,
  placeholder,
  helperText,
  invalid = false,
  invalidText,
  initialValue,
  value: controlledValue,
  onValueChange,
  renderValue,
  renderPanel,
  style,
}: DropdownPanelFieldProps<TValue>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState<TValue | null>(
    initialValue ?? null
  );

  // Determine if component is controlled
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  // Sync internal state when controlled value changes (optional, for convenience)
  useEffect(() => {
    if (isControlled) {
      setInternalValue(controlledValue);
    }
  }, [isControlled, controlledValue]);

  // Close panel on outside click / escape (unchanged)
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
      if (event.key === "Escape") {
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

  // Function to update value (works for both controlled/uncontrolled)
  const setValue = (nextValue: TValue | null) => {
    if (isControlled) {
      // Controlled mode: just notify parent, no internal state change
      onValueChange?.(nextValue);
    } else {
      // Uncontrolled mode: update internal state and notify
      setInternalValue(nextValue);
      onValueChange?.(nextValue);
    }
  };

  const selectedValueNode =
    currentValue == null
      ? placeholder
      : renderValue
        ? renderValue(currentValue)
        : String(currentValue);

  const resolvedInvalidText = invalidText ?? "A valid value is required";
  const helperTextId = `${id}-helper`;
  const invalidTextId = `${id}-error-msg`;
  const describedBy = invalid
    ? invalidTextId
    : helperText
      ? helperTextId
      : undefined;

  return (
    <div className="cds--form-item" ref={rootRef} style={style}>
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
            value: currentValue,
            isOpen,
          })}
        </div>
      </div>
    </div>
  );
}