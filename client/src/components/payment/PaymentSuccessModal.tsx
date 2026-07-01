import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

type PaymentSuccessModalProps = {
  open: boolean;
  tierName: string;
  onClose: () => void;
};

export function PaymentSuccessModal({ open, tierName, onClose }: PaymentSuccessModalProps) {
  const { tr } = useLocalization();
  const [mounted, setMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => setShowContent(true), 50);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = "unset";
      setShowContent(false);
    }
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-[#050509]/85 backdrop-blur-md transition-opacity duration-700 ${
          showContent ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Modal Card */}
      <div 
        className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f17]/95 shadow-[0_30px_100px_-42px_rgba(20,241,149,0.55)] backdrop-blur-xl transition-all duration-500 ease-out transform ${
          showContent ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-8"
        }`}
      >
        {/* Animated Glow Top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-[#14F195] to-transparent opacity-50" />

        <div className="!px-10 !py-12 sm:!px-16 sm:!py-14 flex flex-col items-center text-center">
          {/* Success Icon Animation */}
          <div className="relative mb-8">
            <div className={`flex h-20 w-20 items-center justify-center rounded-2xl border border-[#14F195]/30 bg-[#14F195]/10 transition-all duration-1000 delay-300 ${
              showContent ? "scale-110 border-[#14F195]" : "scale-50 border-transparent"
            }`}>
              <CheckCircle2
                className={`h-10 w-10 text-[#14F195] transition-all duration-700 delay-700 ${
                  showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                aria-hidden="true"
              />
            </div>
            {/* Pulsing rings */}
            <div className="absolute inset-0 rounded-full bg-[#14F195]/20 animate-ping opacity-20" />
          </div>

          {/* Text Content */}
          <div className={`transition-all duration-700 delay-500 ${
            showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
              {tr("payment.success.title")}
            </h2>
            <p className="text-[#94a3b8] mb-8 text-sm leading-relaxed">
              {tr("payment.success.description", {
                $tierName: (
                  <span className="text-[#14F195] font-bold">{tierName}</span>
                ),
              })}
            </p>
          </div>

          {/* Action Buttons */}
          <div className={`w-full space-y-3 transition-all duration-700 delay-700 ${
            showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            <button
              onClick={() => window.location.href = "/profile"}
              className="w-full rounded-full bg-[#14F195] py-4 text-xs font-bold uppercase tracking-[0.18em] text-[#0a0a0f] shadow-[0_14px_36px_-20px_rgba(20,241,149,0.9)] transition-all duration-300 hover:bg-[#0fd484]"
            >
              {tr("payment.success.goToProfile")}
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-full border border-white/10 py-4 text-xs font-bold uppercase tracking-[0.18em] text-[#64748b] transition-all duration-200 hover:bg-white/5 hover:text-white"
            >
              {tr("payment.shared.maybeLater")}
            </button>
          </div>

          {/* Receipt Info */}
          <p className={`mt-8 text-[10px] text-[#475569] uppercase tracking-widest transition-all duration-700 delay-1000 ${
            showContent ? "opacity-100" : "opacity-0"
          }`}>
            {tr("payment.success.receipt")}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
