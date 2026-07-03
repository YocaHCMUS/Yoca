import { SignInModal } from "@/components/auth/SignInModal";
import { useLocalization } from "@/contexts/LocalizationContext";
import { LockKeyhole } from "lucide-react";
import { useState, useEffect } from "react";

type AuthReminderModalProps = {
  open: boolean;
  onClose: () => void;
};

// TODO: Open sign up/ sign in modal from PageWrapper instead
/**
 * A lightweight modal that intercepts unauthenticated users trying to
 * purchase a plan.  Reuses the project's dark-UI patterns and opens the
 * existing SignInModal on demand.
 */
export function AuthReminderModal({ open, onClose }: AuthReminderModalProps) {
  const { tr } = useLocalization();
  const [activeView, setActiveView] = useState<"reminder" | "signin" | "signup">("reminder");

  // Reset view whenever the modal opens OR closes to prevent stale state flash.
  // Without this, if a user opens SignIn and then closes the modal ("Maybe Later"),
  // the next time the modal opens it briefly flashes the SignIn view before this
  // effect fires and resets it back to "reminder".
  useEffect(() => {
    setActiveView("reminder");
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-[#050509]/75 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Reminder View */}
      {activeView === "reminder" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-reminder-title"
          className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
        >
          <div className="pointer-events-auto w-full max-w-md !rounded-3xl border border-white/10 bg-[#111118]/95 !px-8 !py-10 sm:!px-12 sm:!py-12 text-center shadow-[0_28px_90px_-44px_rgba(124,58,237,0.5)] backdrop-blur-xl">
            {/* Icon */}
            <div className="mb-7 flex justify-center">
              <span className="inline-flex h-14 w-14 items-center justify-center !rounded-3xl border border-[#7C3AED]/25 bg-[#7C3AED]/10 text-[#7C3AED] shadow-[0_0_32px_rgba(124,58,237,0.14)]">
                <LockKeyhole className="h-7 w-7" aria-hidden="true" />
              </span>
            </div>

            {/* Heading */}
            <div className="mb-8 flex flex-col gap-2">
              <p
                className="text-[#a0aec0] font-semibold uppercase tracking-widest"
                style={{ fontSize: "0.75rem" }}
              >
                {tr("payment.authReminder.eyebrow")}
              </p>
              <h2
                id="auth-reminder-title"
                className="text-[#f4f4f4] font-bold tracking-tight leading-tight"
                style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)" }}
              >
                {tr("payment.authReminder.title")}
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                {tr("payment.authReminder.description")}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                id="auth-reminder-signin-btn"
                type="button"
                onClick={() => setActiveView("signin")}
                className="flex-1 !rounded-full bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-4 !py-4 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_28px_-8px_rgba(124,58,237,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:from-[#8B5CF6] hover:to-[#3B82F6] hover:shadow-[0_14px_36px_-8px_rgba(124,58,237,0.85)]"
              >
                {tr("auth.signIn")}
              </button>

              <button
                id="auth-reminder-close-btn"
                type="button"
                onClick={onClose}
                className="flex-1 !rounded-full border border-white/10 px-4 !py-4 text-sm font-medium text-[#94a3b8] transition-all duration-200 hover:bg-white/5 hover:text-white"
              >
                {tr("payment.shared.maybeLater")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal — SignInModal already handles Login ↔ Register toggle internally */}
      <SignInModal
        open={activeView === "signin"}
        onClose={onClose}
        redirectUrl="/pricing"
      />
    </>
  );
}
