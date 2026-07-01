import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Toast, type ToastKind } from "./Toast";
import styles from "./toast.module.scss";
import { useUserTheme } from "@/contexts/ThemeContext";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}



interface ToastContainerProps {
  toasts: ToastItem[];
  onClose: (id: number) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  const { themeRef } = useUserTheme();
  return createPortal(
    <div className={styles.container} aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Toast
              kind={t.kind}
              title={t.title}
              subtitle={t.subtitle}
              action={t.action}
              onClose={() => onClose(t.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    themeRef.current!!,
  );
}