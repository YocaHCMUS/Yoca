import type { ComponentType } from "react";
import styles from "./ChartControls.module.scss";

interface IconActionButtonProps {
  label: string;
  icon: ComponentType<{ size?: number }>;
  onClick?: () => void;
  href?: string;
  target?: string;
  disabled?: boolean;
  variant?: "default" | "primary";
  className?: string;
}

export function IconActionButton({
  label,
  icon: Icon,
  onClick,
  href,
  target,
  disabled = false,
  variant = "default",
  className = "",
}: IconActionButtonProps) {
  const classNames = `${styles.iconButton} ${variant === "primary" ? styles.iconButtonPrimary : ""} ${className}`;

  if (href) {
    return (
      <a
        className={classNames}
        href={disabled ? undefined : href}
        target={target}
        rel={target === "_blank" ? "noreferrer" : undefined}
        aria-label={label}
        title={label}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
          }
        }}
      >
        <Icon size={15} />
      </a>
    );
  }

  return (
    <button
      type="button"
      className={classNames}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <Icon size={15} />
    </button>
  );
}
