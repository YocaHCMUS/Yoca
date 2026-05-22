import { SignInModal } from "@/components/auth/SignInModal";
import { SignUpModal } from "@/components/auth/SignUpModal";
import { useState, useEffect } from "react";

type AuthReminderModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * A lightweight modal that intercepts unauthenticated users trying to
 * purchase a plan.  Reuses the project's dark-UI patterns and opens the
 * existing SignInModal on demand.
 */
export function AuthReminderModal({ open, onClose }: AuthReminderModalProps) {
  const [activeView, setActiveView] = useState<"reminder" | "signin" | "signup">("reminder");

  // Reset view when modal opens
  useEffect(() => {
    if (open) setActiveView("reminder");
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
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
          <div className="pointer-events-auto w-full max-w-md bg-[#111118] border border-white/5 shadow-2xl rounded-none !px-10 !py-12 sm:!px-16 sm:!py-14 flex flex-col gap-8 text-center">
            {/* Icon */}
            <div className="flex justify-center">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#14F195]/10 border border-[#14F195]/20">
                <svg
                  className="w-7 h-7 text-[#14F195]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </span>
            </div>

            {/* Heading */}
            <div className="flex flex-col gap-2">
              <p
                className="text-[#a0aec0] font-semibold uppercase tracking-widest"
                style={{ fontSize: "0.75rem" }}
              >
                Authentication Required
              </p>
              <h2
                id="auth-reminder-title"
                className="text-[#f4f4f4] font-bold tracking-tight leading-tight"
                style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)" }}
              >
                Sign in to Continue
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                You need to be signed in before purchasing a plan. Create a free account
                or log in to get started.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                id="auth-reminder-signin-btn"
                type="button"
                onClick={() => setActiveView("signin")}
                className="flex-1 bg-[#14F195] hover:bg-[#0fd484] text-[#0a0a0f] font-bold px-4 !py-4 rounded-full transition-all duration-200 text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(20,241,149,0.3)]"
              >
                Sign In
              </button>

              <button
                id="auth-reminder-close-btn"
                type="button"
                onClick={onClose}
                className="flex-1 text-[#78a9ff] hover:text-[#a6c8ff] hover:bg-white/5 px-4 !py-4 font-medium text-sm rounded-full border border-white/10 transition-all duration-200"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modals */}
      <SignInModal
        open={activeView === "signin"}
        onClose={() => {
          onClose();
        }}
        onToggleSignUp={() => setActiveView("signup")}
        redirectUrl="/pricing"
      />

      <SignUpModal
        open={activeView === "signup"}
        onClose={() => {
          onClose();
        }}
      />
    </>
  );
}
