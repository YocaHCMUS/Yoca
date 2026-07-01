import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Tooltip.module.scss";

type TooltipAlign = "bottom-left" | "bottom" | "top" | "left" | "right";

interface TooltipProps {
  label: string;
  children: ReactNode;
  align?: TooltipAlign;
  className?: string;
}

const ALIGN_GAP = 6;

function computePosition(
  rect: DOMRect,
  align: TooltipAlign,
): { top: number; left: number } {
  switch (align) {
    case "bottom-left":
      return { top: rect.bottom + ALIGN_GAP, left: rect.left };
    case "bottom":
      return {
        top: rect.bottom + ALIGN_GAP,
        left: rect.left + rect.width / 2,
      };
    case "top":
      return {
        top: rect.top - ALIGN_GAP,
        left: rect.left + rect.width / 2,
      };
    case "left":
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - ALIGN_GAP,
      };
    case "right":
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + ALIGN_GAP,
      };
  }
}

export function Tooltip({
  label,
  children,
  align = "bottom",
  className,
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition(computePosition(rect, align));
  }, [align]);

  const hide = useCallback(() => {
    setPosition(null);
  }, []);

  return (
    <>
      <span
        ref={triggerRef}
        className={className}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {position &&
        createPortal(
          <span
            className={`${styles.tooltip} ${styles[`align_${align}`]}`}
            style={{ top: position.top, left: position.left }}
            role="tooltip"
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
