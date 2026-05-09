import "@/styles/landing-tailwind.css";
import { useState } from "react";
import { LandingFooter, LandingNavbar } from "@/components/landing";
import {
  LANDING_ACCENT_GLOW,
  btnPrimaryBase,
  btnPrimaryEnter,
  btnPrimaryLeave,
} from "@/components/landing/tokens";

// Static tiers for columns 2, 3, 4
const staticTiers = [
  {
    name: "Plus",
    price: "$199",
    included: "15,000,000 CUs/MO",
    apiLimit: "50 RPS",
    overage: "$9.9/1M CUs",
    features: [
      "Unlimited API Keys & Custom API Access",
      "Max 100 Million Compute Units (CUs) per month",
      "WebSocket: 500 concurrent connections",
      "Priority Support",
    ],
    isMostPopular: true,
    isPro: false,
  },
  {
    name: "Pro",
    price: "$499",
    included: "60,000,000 CUs/MO",
    apiLimit: "100 RPS",
    overage: "$6.9/1M CUs",
    features: [
      "Unlimited API Keys & Custom API Access",
      "Batch tokens API access",
      "Unlimited Compute Units (CUs) per month",
      "WebSocket: 2,000 concurrent connections",
      "Dedicated Support",
    ],
    isMostPopular: false,
    isPro: true,
  },
];

// Tier data for the dynamic column 1
const LITE_DATA = {
  name: "Lite",
  price: "$39",
  included: "1,500,000 CUs/MO",
  apiLimit: "15 RPS",
  overage: "$23/1M CUs",
  cta: "BUY NOW",
};

const STANDARD_DATA = {
  name: "Standard",
  price: "FREE",
  included: "30,000 CUs/MO",
  apiLimit: "1 RPS",
  overage: "Not Allowed",
  cta: "TRY FOR FREE",
};

// Check icon SVG
function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-[#14F195] mt-0.5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

// Bolt icon SVG
function BoltIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

export default function PricingPage() {
  const [isStandardMode, setIsStandardMode] = useState(false);

  const col1 = isStandardMode ? STANDARD_DATA : LITE_DATA;

  return (
    <div
      id="pricing"
      className="landing-page min-h-screen bg-[#0a0a0f] text-base text-[#f8fafc] antialiased selection:bg-[#9945FF]/35 selection:text-[#f8fafc] relative flex flex-col"
    >
      <LandingNavbar />

      <main className="relative z-10 flex-grow overflow-hidden pb-24 pt-32">
        {/* Glowing Orbs — copied from LandingHero */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: "-8rem",
            top: "5rem",
            width: "420px",
            height: "420px",
            background: "rgba(153,69,255,0.22)",
            filter: "blur(100px)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            right: "-6rem",
            top: "10rem",
            width: "380px",
            height: "380px",
            background: "rgba(139,92,246,0.18)",
            filter: "blur(100px)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: "50%",
            top: "50%",
            width: "600px",
            height: "300px",
            transform: "translate(-50%, -50%)",
            background: LANDING_ACCENT_GLOW,
            filter: "blur(80px)",
          }}
          aria-hidden
        />

        <div className="max-w-7xl mx-auto w-full px-4 flex flex-col items-center relative z-10">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center pb-16 w-full">
            <h1 className="text-4xl font-bold tracking-tight text-[#f8fafc] sm:text-5xl md:text-6xl mb-6">
              Pricing
            </h1>
            <p className="text-lg text-[#94a3b8] max-w-2xl mx-auto">
              Outfit your platform with real-time crypto data and insights from
              200+ markets—with just 1 integration.
            </p>
          </div>

          {/* Pricing Cards Grid — 1 col mobile, 2 tablet, 3 desktop (col1 + 2 static) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full justify-center">

            {/* ── Column 1: Dynamic Lite / Standard ── */}
            <div className="flex flex-col bg-[#0a0a0f]/80 backdrop-blur-xl p-8 lg:p-10 relative rounded-3xl border border-white/10 hover:border-[#14F195]/50 transition-all duration-300 shadow-2xl">
              {/* Tier header */}
              <div className="mb-6 border-b border-white/10 pb-6">
                <h3 className="text-base font-medium text-[#f8fafc] flex items-center gap-2 mb-3">
                  <BoltIcon className="w-5 h-5 text-[#14F195]" />
                  {col1.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">
                    {col1.price}
                  </span>
                  {col1.price !== "FREE" && (
                    <span className="text-sm text-[#94a3b8] font-medium">/ month</span>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="flex-grow space-y-5">
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1 font-medium uppercase tracking-wider">Included</p>
                  <p className="text-[15px] font-semibold text-[#14F195]">
                    {col1.included}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1 font-medium uppercase tracking-wider">API Rate Limit</p>
                  <p className="text-[15px] font-semibold text-white">{col1.apiLimit}</p>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1 font-medium uppercase tracking-wider">Overage cost</p>
                  <p className="text-[15px] font-semibold text-[#14F195]">
                    {col1.overage}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1 font-medium uppercase tracking-wider">
                    WebSocket Access
                  </p>
                  <p className="text-[15px] font-semibold text-white">No</p>
                </div>
              </div>

              {/* Toggle switch + CTA */}
              <div className="mt-8 pt-6 border-t border-white/10 space-y-5">
                <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#f8fafc]">
                    Standard
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isStandardMode}
                    onClick={() => setIsStandardMode(!isStandardMode)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none rounded-full ${
                      isStandardMode ? "bg-[#14F195]" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${
                        isStandardMode ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <button className="w-full uppercase tracking-widest text-xs font-bold h-12 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#14F195]/30 transition-all duration-300 text-[#f8fafc] rounded-full shadow-lg">
                  {col1.cta}
                </button>
              </div>
            </div>

            {/* ── Columns 2-3: Plus & Pro (static) ── */}
            {staticTiers.map((tier) => (
              <div
                key={tier.name}
                className={`flex flex-col bg-[#0a0a0f]/80 backdrop-blur-xl p-8 lg:p-10 relative rounded-3xl transition-all duration-300 shadow-2xl
                  ${
                    tier.isPro
                      ? "border border-[#9945FF]/50 shadow-[0_0_30px_rgba(153,69,255,0.15)] hover:shadow-[0_0_40px_rgba(153,69,255,0.25)] hover:border-[#9945FF]"
                      : "border border-white/10 hover:border-[#14F195]/50"
                  }
                `}
              >
                {/* Most Popular badge */}
                {tier.isMostPopular && (
                  <div className="absolute top-0 right-8 -translate-y-1/2">
                    <span className="bg-gradient-to-r from-[#14F195] to-[#0ea5e9] text-[#0a0a0f] text-[10px] font-extrabold px-4 py-1.5 uppercase tracking-widest rounded-full shadow-[0_0_20px_rgba(20,241,149,0.5)] border border-white/20">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Tier header */}
                <div className="mb-6 border-b border-white/10 pb-6">
                  <h3 className="text-base font-medium text-[#f8fafc] flex items-center gap-2 mb-3">
                    <BoltIcon className={`w-5 h-5 ${tier.isPro ? "text-[#9945FF]" : "text-[#14F195]"}`} />
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">
                      {tier.price}
                    </span>
                    <span className="text-sm text-[#94a3b8] font-medium">/ month</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex-grow space-y-5">
                  <div>
                    <p className="text-xs text-[#94a3b8] mb-1 font-medium uppercase tracking-wider">Included</p>
                    <p className={`text-[15px] font-semibold ${tier.isPro ? "text-[#9945FF]" : "text-[#14F195]"}`}>
                      {tier.included}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94a3b8] mb-1 font-medium uppercase tracking-wider">
                      API Rate Limit
                    </p>
                    <p className="text-[15px] font-semibold text-white">{tier.apiLimit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94a3b8] mb-1 font-medium uppercase tracking-wider">Overage cost</p>
                    <p className={`text-[15px] font-semibold ${tier.isPro ? "text-[#9945FF]" : "text-[#14F195]"}`}>
                      {tier.overage}
                    </p>
                  </div>

                  {/* Feature list */}
                  {tier.features.length > 0 && (
                    <ul className="space-y-4 pt-5 border-t border-white/5">
                      {tier.features.map((feat, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-sm text-[#e2e8f0]"
                        >
                          <CheckIcon />
                          <span className="leading-relaxed">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* CTA */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  {tier.isMostPopular ? (
                    <button
                      className="w-full uppercase tracking-widest text-xs font-bold h-12 rounded-full shadow-[0_0_20px_rgba(20,241,149,0.3)]"
                      style={{ ...btnPrimaryBase }}
                      onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
                      onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
                    >
                      Buy Now
                    </button>
                  ) : (
                    <button className="w-full uppercase tracking-widest text-xs font-bold h-12 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#9945FF]/40 transition-all duration-300 text-[#f8fafc] rounded-full shadow-lg">
                      Buy Now
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
