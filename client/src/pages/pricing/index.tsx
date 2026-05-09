import "@/styles/landing-tailwind.css";
import { useState } from "react";
import { LandingFooter, LandingNavbar } from "@/components/landing";
import {
  LANDING_ACCENT_GLOW,
  btnPrimaryBase,
  btnPrimaryEnter,
  btnPrimaryLeave,
} from "@/components/landing/tokens";

// ─── Data ─────────────────────────────────────────────────────────────────────

const LITE_DATA = {
  name: "Lite",
  price: "$39",
  period: "/ month",
  included: "1,500,000 CUs/MO",
  apiLimit: "15 RPS",
  overage: "$23/1M CUs",
  websocket: "No",
  cta: "Buy Now",
};

const STANDARD_DATA = {
  name: "Standard",
  price: "FREE",
  period: "",
  included: "30,000 CUs/MO",
  apiLimit: "1 RPS",
  overage: "Not Allowed",
  websocket: "No",
  cta: "Try For Free",
};

const PLUS_TIER = {
  name: "Plus",
  price: "$199",
  period: "/ month",
  included: "15,000,000 CUs/MO",
  apiLimit: "50 RPS",
  overage: "$9.9/1M CUs",
  features: [
    "Unlimited API Keys & Custom API Access",
    "Max 100 Million Compute Units/month",
    "WebSocket: 500 concurrent connections",
    "Priority Support",
  ],
  isMostPopular: true,
  accentColor: "#14F195" as const,
};

const PRO_TIER = {
  name: "Pro",
  price: "$499",
  period: "/ month",
  included: "60,000,000 CUs/MO",
  apiLimit: "100 RPS",
  overage: "$6.9/1M CUs",
  features: [
    "Unlimited API Keys & Custom API Access",
    "Batch tokens API access",
    "Unlimited Compute Units/month",
    "WebSocket: 2,000 concurrent connections",
    "Dedicated Support",
  ],
  isMostPopular: false,
  accentColor: "#14F195" as const,
};

// ─── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon({ color = "#14F195" }: { color?: string }) {
  return (
    <svg
      className="w-4 h-4 shrink-0 mt-0.5"
      fill="none"
      stroke={color}
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function BoltIcon({ color = "#14F195" }: { color?: string }) {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

// ─── Metric Row ────────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  accent = false,
  color = "#14F195",
}: {
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-1">
        {label}
      </p>
      <p
        className="text-[15px] font-semibold"
        style={{ color: accent ? color : "#f8fafc" }}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [isStandard, setIsStandard] = useState(false);
  const col1 = isStandard ? STANDARD_DATA : LITE_DATA;

  return (
    <div
      id="pricing"
      className="landing-page min-h-screen w-full bg-[#0a0a0f] text-[#f8fafc] antialiased relative flex flex-col"
    >
      <LandingNavbar />

      <main className="relative flex-grow flex flex-col items-center pt-32 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* ── Background Orbs ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            left: "-10rem",
            top: "4rem",
            width: 500,
            height: 500,
            background: "rgba(153,69,255,0.2)",
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
            background: "rgba(20,241,149,0.10)",
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
            background: LANDING_ACCENT_GLOW,
            filter: "blur(90px)",
          }}
        />

        {/* ── Header ── */}
        <div className="relative z-10 flex flex-col items-center text-center w-full max-w-3xl mx-auto mb-20">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white mb-5">
            Pricing
          </h1>
          <p className="text-lg text-[#94a3b8] leading-relaxed">
            Outfit your platform with real-time crypto data and insights from
            200+ markets—with just 1 integration.
          </p>
        </div>

        {/* ── Cards Grid ── */}
        <div className="relative z-10 w-full max-w-6xl mx-auto mt-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">

            {/* ── Card 1: Dynamic Lite / Standard ── */}
            <div className="flex flex-col p-8 lg:p-10 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl hover:border-[#14F195]/40 transition-all duration-300">
              <div className="flex flex-col flex-1 gap-6">

                {/* Tier name + price */}
                <div className="space-y-3 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <BoltIcon color="#14F195" />
                    <h3 className="text-lg font-semibold text-white">{col1.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-extrabold text-white">{col1.price}</span>
                    {col1.period && (
                      <span className="text-sm text-[#64748b] font-medium">{col1.period}</span>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="space-y-5 flex-1">
                  <MetricRow label="Included" value={col1.included} accent color="#14F195" />
                  <MetricRow label="API Rate Limit" value={col1.apiLimit} />
                  <MetricRow label="Overage Cost" value={col1.overage} accent color="#14F195" />
                  <MetricRow label="WebSocket Access" value={col1.websocket} />
                </div>

                {/* Toggle + CTA */}
                <div className="space-y-4 pt-6 border-t border-white/10">
                  {/* Pill toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isStandard}
                    onClick={() => setIsStandard((v) => !v)}
                    className="w-full flex items-center justify-between bg-white/5 hover:bg-white/8 border border-white/10 rounded-full px-4 py-2.5 transition-all duration-200 cursor-pointer"
                  >
                    <span className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
                      Standard (Free)
                    </span>
                    <span
                      className={`relative inline-flex h-6 w-11 shrink-0 border-2 border-transparent rounded-full transition-colors duration-300 ${
                        isStandard ? "bg-[#14F195]" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
                          isStandard ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>

                  <button className="w-full py-3 rounded-full text-sm font-bold uppercase tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#14F195]/40 transition-all duration-300 text-white shadow-lg">
                    {col1.cta}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Card 2: Plus ── */}
            <div className="flex flex-col p-8 lg:p-10 rounded-3xl border border-[#14F195]/30 bg-white/[0.04] backdrop-blur-xl shadow-[0_0_40px_rgba(20,241,149,0.08)] hover:shadow-[0_0_60px_rgba(20,241,149,0.15)] hover:border-[#14F195]/60 transition-all duration-300 relative">
              <div className="flex flex-col flex-1 gap-6">
                {/* Tier name + price */}
                <div className="space-y-3 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <BoltIcon color="#14F195" />
                    <h3 className="text-lg font-semibold text-white">{PLUS_TIER.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-extrabold text-white">{PLUS_TIER.price}</span>
                    <span className="text-sm text-[#64748b] font-medium">{PLUS_TIER.period}</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="space-y-5">
                  <MetricRow label="Included" value={PLUS_TIER.included} accent color="#14F195" />
                  <MetricRow label="API Rate Limit" value={PLUS_TIER.apiLimit} />
                  <MetricRow label="Overage Cost" value={PLUS_TIER.overage} accent color="#14F195" />
                </div>

                {/* Features */}
                <ul className="space-y-3 pt-4 border-t border-white/5 flex-1">
                  {PLUS_TIER.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[#cbd5e1] leading-relaxed">
                      <CheckIcon color="#14F195" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="pt-4 border-t border-white/10">
                  <button
                    className="w-full py-3 rounded-full text-sm font-bold uppercase tracking-widest shadow-[0_0_24px_rgba(20,241,149,0.35)] hover:shadow-[0_0_36px_rgba(20,241,149,0.5)] transition-all duration-300"
                    style={{ ...btnPrimaryBase }}
                    onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
                    onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            </div>

            {/* ── Card 3: Pro ── */}
            <div className="flex flex-col p-8 lg:p-10 rounded-3xl border border-[#14F195]/30 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_30px_rgba(20,241,149,0.08)] hover:shadow-[0_0_50px_rgba(20,241,149,0.15)] hover:border-[#14F195]/60 transition-all duration-300 relative">
              <div className="flex flex-col flex-1 gap-6">
                {/* Tier name + price */}
                <div className="space-y-3 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <BoltIcon color="#14F195" />
                    <h3 className="text-lg font-semibold text-white">{PRO_TIER.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-extrabold text-white">{PRO_TIER.price}</span>
                    <span className="text-sm text-[#64748b] font-medium">{PRO_TIER.period}</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="space-y-5">
                  <MetricRow label="Included" value={PRO_TIER.included} accent color="#14F195" />
                  <MetricRow label="API Rate Limit" value={PRO_TIER.apiLimit} />
                  <MetricRow label="Overage Cost" value={PRO_TIER.overage} accent color="#14F195" />
                </div>

                {/* Features */}
                <ul className="space-y-3 pt-4 border-t border-white/5 flex-1">
                  {PRO_TIER.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[#cbd5e1] leading-relaxed">
                      <CheckIcon color="#14F195" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="pt-4 border-t border-white/10">
                  <button className="w-full py-3 rounded-full text-sm font-bold uppercase tracking-widest bg-white/5 border border-[#14F195]/40 hover:bg-[#14F195]/10 hover:border-[#14F195] transition-all duration-300 text-white shadow-lg">
                    Buy Now
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
