import { forwardRef, type ComponentType } from "react";
import styles from "./IconButton.module.scss";

interface IconButtonProps {
  icon: ComponentType<{ size?: number }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon: Icon,
      label,
      onClick,
      disabled = false,
      active = false,
      size = "md",
      className = "",
    },
    ref,
  ) => (
    <button
      ref={ref}
      type="button"
      className={`${styles.button} ${size === "sm" ? styles.sm : ""} ${active ? styles.active : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
    >
      <Icon size={size === "sm" ? 14 : 16} />
    </button>
  ),
);

IconButton.displayName = "IconButton";
