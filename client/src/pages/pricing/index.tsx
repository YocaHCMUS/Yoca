import "@/styles/landing-tailwind.css";
import { useState, useEffect } from "react";
import { Check, Zap } from "lucide-react";
import { LandingFooter, LandingNavbar } from "@/components/landing";
import {
  LANDING_ACCENT_GLOW,
} from "@/components/landing/tokens";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { createLandingThemeStyles } from "@/components/landing/tokens";
import { AuthReminderModal, PaymentModalWrapper, PaymentSuccessModal } from "@/components/payment";

// ─── Data ─────────────────────────────────────────────────────────────────────

const LITE_DATA = {
  name: "Lite",
  price: "$39",
};

const STANDARD_DATA = {
  name: "Standard",
};

const PLUS_TIER = {
  name: "Plus",
  price: "$199",
  isMostPopular: true,
  accentColor: "#14F195" as const,
};

const PRO_TIER = {
  name: "Pro",
  price: "$499",
  isMostPopular: false,
  accentColor: "#14F195" as const,
};

// ─── Main Component ────────────────────────────────────────────────────────────

const pricingCardClass =
  "flex flex-col !p-7 lg:!p-8 rounded-2xl border border-[var(--landing-card-border)] bg-[var(--landing-card-bg)] backdrop-blur-xl shadow-[var(--landing-card-shadow)] transition-all duration-300 hover:-translate-y-1 hover:border-[#14F195]/45 hover:shadow-[0_22px_70px_-44px_rgba(20,241,149,0.65)]";

const pricingCtaClass =
  "w-full min-h-11 py-3 rounded-full text-xs font-bold uppercase tracking-[0.18em] bg-[var(--landing-button-secondary-bg)] border border-[var(--landing-button-secondary-border)] hover:bg-[var(--landing-button-secondary-hover-bg)] hover:border-[var(--landing-button-secondary-hover-border)] transition-all duration-300 text-[var(--landing-foreground)]";

function PricingFeatures({
  label,
  features,
}: {
  label: string;
  features: string[];
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#14F195]">
        {label}
      </p>
      <ul className="space-y-3">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-3 text-sm leading-relaxed text-[var(--landing-muted)]"
          >
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-[#14F195]"
              aria-hidden="true"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PricingPage() {
  const { user } = useAuth();
  const { tr } = useLocalization();
  const { theme } = useUserTheme();
  const [isStandard, setIsStandard] = useState(false);
  const featureLabel = String(tr("pricing.features.label"));
  const aiFeature = (
    key:
      | "pricing.features.askYoca"
      | "pricing.features.volatilitySummary"
      | "pricing.features.walletSwapSummary",
    count: number,
  ) => String(tr(key, { $count: count }));
  const localizedLite = {
    ...LITE_DATA,
    period: tr("pricing.period.month"),
    features: [
      aiFeature("pricing.features.askYoca", 20),
      aiFeature("pricing.features.volatilitySummary", 25),
      aiFeature("pricing.features.walletSwapSummary", 20),
      String(tr("pricing.features.dailyReset")),
    ],
    cta: tr("pricing.cta.buyNow"),
  };
  const localizedStandard = {
    ...STANDARD_DATA,
    price: tr("pricing.free"),
    period: undefined,
    features: [
      aiFeature("pricing.features.askYoca", 5),
      aiFeature("pricing.features.volatilitySummary", 10),
      aiFeature("pricing.features.walletSwapSummary", 10),
      String(tr("pricing.features.dailyReset")),
    ],
    cta: tr("pricing.cta.tryForFree"),
  };
  const localizedPlus = {
    ...PLUS_TIER,
    period: tr("pricing.period.month"),
    features: [
      aiFeature("pricing.features.askYoca", 50),
      aiFeature("pricing.features.volatilitySummary", 50),
      aiFeature("pricing.features.walletSwapSummary", 50),
      String(tr("pricing.features.dailyReset")),
    ],
  };
  const localizedPro = {
    ...PRO_TIER,
    period: tr("pricing.period.month"),
    features: [
      aiFeature("pricing.features.askYoca", 100),
      aiFeature("pricing.features.volatilitySummary", 100),
      aiFeature("pricing.features.walletSwapSummary", 100),
      String(tr("pricing.features.dailyReset")),
    ],
  };
  const col1 = isStandard ? localizedStandard : localizedLite;
  const isLightTheme = theme === "light";
  const purpleOrb = isLightTheme ? "rgba(153,69,255,0.08)" : "rgba(153,69,255,0.2)";
  const greenOrb = isLightTheme ? "rgba(20,241,149,0.07)" : "rgba(20,241,149,0.10)";
  const centerGlow = isLightTheme ? "rgba(20,241,149,0.11)" : LANDING_ACCENT_GLOW;

  // Payment flow state
  const [isAuthReminderOpen, setIsAuthReminderOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<{ name: string; price: string } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Check for success redirect from Stripe (return_url flow only)
  // Requires both ?success=true AND ?tier=<name> to prevent stale-URL false-positives.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const successParam = params.get("success");
    const tierParam = params.get("tier");
    if (successParam === "true" && tierParam) {
      setSelectedTier({ name: tierParam, price: "" });
      setPaymentSuccess(true);
      // Clean up URL without reloading
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  /**
   * Called when a "Buy Now" CTA button is clicked.
   * Intercepts unauthenticated users; opens the payment modal for authenticated ones.
   */
  function handleBuyNow(tier: { name: string; price: string }) {
    if (!user) {
      setIsAuthReminderOpen(true);
      return;
    }
    setSelectedTier(tier);
    setIsPaymentModalOpen(true);
  }

  function handlePaymentSuccess() {
    setIsPaymentModalOpen(false);
    setPaymentSuccess(true);
  }

  return (
    <div
      id="pricing"
      className="landing-page relative h-screen w-full overflow-y-auto antialiased"
      style={createLandingThemeStyles(theme)}
    >
      <LandingNavbar />

      <main className="relative flex flex-col items-center pt-32 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* ── Background Orbs ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            left: "-10rem",
            top: "4rem",
            width: 500,
            height: 500,
            background: purpleOrb,
            filter: "blur(110px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            right: "-8rem",
            top: "8rem",
            width: 420,
            height: 420,
            background: greenOrb,
            filter: "blur(110px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            left: "50%",
            top: "55%",
            width: 700,
            height: 350,
            transform: "translate(-50%, -50%)",
            background: centerGlow,
            filter: "blur(90px)",
          }}
        />

        {/* ── Payment Success Modal ── */}
        <PaymentSuccessModal
          open={paymentSuccess}
          tierName={selectedTier?.name ?? ""}
          onClose={() => setPaymentSuccess(false)}
        />

        {/* ── Header ── */}
        <div className="relative z-10 flex flex-col items-center gap-5 text-center w-full max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[var(--landing-foreground)]">
            {tr("pricing.title")}
          </h1>
          <p className="text-base sm:text-lg text-[var(--landing-muted)] leading-relaxed">
            {tr("pricing.subtitle")}
          </p>
        </div>

        {/* ── Cards Grid ── */}
        <div className="relative z-10 w-full max-w-6xl mx-auto !mt-14 sm:!mt-16 lg:!mt-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">

            {/* ── Card 1: Dynamic Lite / Standard ── */}
            <div className={pricingCardClass}>
              <div className="flex flex-col flex-1 gap-6">

                {/* Tier name + price */}
                <div className="space-y-3 pb-6 border-b border-[var(--landing-border)]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#14F195]/25 bg-[#14F195]/10 text-[#14F195]">
                      <Zap className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="text-xl font-semibold text-[var(--landing-foreground)]">{col1.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-semibold text-[var(--landing-foreground)]">{col1.price}</span>
                    {col1.period && <span className="text-sm text-[var(--landing-muted)] font-medium">{col1.period}</span>}
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex-1">
                  <PricingFeatures
                    label={featureLabel}
                    features={col1.features}
                  />
                </div>

                {/* Toggle + CTA */}
                <div className="space-y-4 pt-6 border-t border-[var(--landing-border)]">
                  {/* Pill toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isStandard}
                    onClick={() => setIsStandard((v) => !v)}
                    className="w-full flex items-center justify-between bg-[var(--landing-button-secondary-bg)] hover:bg-[var(--landing-button-secondary-hover-bg)] border border-[var(--landing-button-secondary-border)] !rounded-full px-4 py-2.5 transition-all duration-200 cursor-pointer"
                  >
                    <span className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
                      {tr("pricing.tiers.standard.name")}
                    </span>
                    <span
                      className={`relative flex items-center justify-start h-6 w-11 shrink-0 !rounded-full transition-colors duration-300 p-0.5 ${
                        isStandard ? "bg-[#14F195]" : "bg-[var(--landing-card-border)]"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 !rounded-full bg-[var(--landing-foreground)] shadow-md transition-transform duration-300 ${
                          isStandard ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>

                  {/* CTA: only show "Buy Now" for Lite (paid), not for Standard (free) */}
                  {!isStandard ? (
                    <button
                      id="pricing-lite-buy-btn"
                      type="button"
                      onClick={() => handleBuyNow({ name: col1.name, price: col1.price })}
                      className={pricingCtaClass}
                    >
                      {col1.cta}
                    </button>
                  ) : (
                    <button
                      id="pricing-standard-try-btn"
                      type="button"
                      className={pricingCtaClass}
                    >
                      {col1.cta}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Card 2: Plus ── */}
            <div className={`${pricingCardClass} relative border-[#14F195]/35 shadow-[0_22px_70px_-48px_rgba(20,241,149,0.8)]`}>
              <div className="flex flex-col flex-1 gap-6">
                {/* Tier name + price */}
                <div className="space-y-3 pb-6 border-b border-[var(--landing-border)]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#14F195]/25 bg-[#14F195]/10 text-[#14F195]">
                      <Zap className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="text-xl font-semibold text-[var(--landing-foreground)]">{localizedPlus.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-semibold text-[var(--landing-foreground)]">{localizedPlus.price}</span>
                    <span className="text-sm text-[var(--landing-muted)] font-medium">{localizedPlus.period}</span>
                  </div>
                </div>

                <div className="flex-1">
                  <PricingFeatures
                    label={featureLabel}
                    features={localizedPlus.features}
                  />
                </div>

                {/* CTA */}
                <div className="pt-4 border-t border-[var(--landing-border)]">
                  <button
                    id="pricing-plus-buy-btn"
                    type="button"
                    onClick={() => handleBuyNow({ name: localizedPlus.name, price: localizedPlus.price })}
                    className={pricingCtaClass}
                  >
                    {tr("pricing.cta.buyNow")}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Card 3: Pro ── */}
            <div className={`${pricingCardClass} relative`}>
              <div className="flex flex-col flex-1 gap-6">
                {/* Tier name + price */}
                <div className="space-y-3 pb-6 border-b border-[var(--landing-border)]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#14F195]/25 bg-[#14F195]/10 text-[#14F195]">
                      <Zap className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="text-xl font-semibold text-[var(--landing-foreground)]">{localizedPro.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-semibold text-[var(--landing-foreground)]">{localizedPro.price}</span>
                    <span className="text-sm text-[var(--landing-muted)] font-medium">{localizedPro.period}</span>
                  </div>
                </div>

                <div className="flex-1">
                  <PricingFeatures
                    label={featureLabel}
                    features={localizedPro.features}
                  />
                </div>

                {/* CTA */}
                <div className="pt-4 border-t border-[var(--landing-border)]">
                  <button
                    id="pricing-pro-buy-btn"
                    type="button"
                    onClick={() => handleBuyNow({ name: localizedPro.name, price: localizedPro.price })}
                    className={pricingCtaClass}
                  >
                    {tr("pricing.cta.buyNow")}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <LandingFooter />

      {/* ── Auth Reminder Modal (unauthenticated users) ── */}
      <AuthReminderModal
        open={isAuthReminderOpen}
        onClose={() => setIsAuthReminderOpen(false)}
      />

      {/* ── Payment Modal (authenticated users) ── */}
      <PaymentModalWrapper
        open={isPaymentModalOpen}
        tier={selectedTier}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
