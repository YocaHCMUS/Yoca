import { useState } from "react";
import { LandingFooter, LandingNavbar } from "@/components/landing";
import {
  LANDING_ACCENT_GLOW,
  btnPrimaryBase,
  btnPrimaryEnter,
  btnPrimaryLeave,
} from "@/components/landing/tokens";

const tiers = [
  {
    name: "Standard",
    price: "FREE",
    included: "30,000 CUs/MO",
    apiLimit: "1 RPS",
    features: [],
  },
  {
    name: "Lite",
    price: "$39 / month",
    included: "1,500,000 CUs/MO",
    apiLimit: "15 RPS",
    features: [],
  },
  {
    name: "Plus",
    price: "$199 / month",
    included: "15,000,000 CUs/MO",
    apiLimit: "50 RPS",
    features: [
      "Unlimited API Keys & Custom API Access",
      "Max 100 Million Compute Units (CUs) per month",
      "WebSocket: 500 concurrent connections",
      "Priority Support",
    ],
  },
  {
    name: "Pro",
    price: "$499 / month",
    included: "60,000,000 CUs/MO",
    apiLimit: "100 RPS",
    features: [
      "Unlimited API Keys & Custom API Access",
      "Batch tokens API access",
      "Unlimited Compute Units (CUs) per month",
      "WebSocket: 2,000 concurrent connections",
      "Dedicated Support",
    ],
  },
];

export default function PricingPage() {
  const [standardToggle, setStandardToggle] = useState(false);

  return (
    <div className="landing-page min-h-screen bg-[#0a0a0f] text-base text-[#f8fafc] antialiased selection:bg-[#9945FF]/35 selection:text-[#f8fafc] relative flex flex-col">
      <LandingNavbar />

      <main className="relative z-10 flex-grow overflow-hidden pb-24">
        {/* Glowing Orbs from Landing Hero */}
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

        {/* Header Section */}
        <div className="mx-auto max-w-7xl px-6 lg:px-8 pt-24 pb-16 text-center relative z-10">
          <h1 className="text-4xl font-bold tracking-tight text-[#f8fafc] sm:text-5xl md:text-6xl mb-6">
            Pricing
          </h1>
          <p className="text-lg text-[#94a3b8] max-w-2xl mx-auto">
            Outfit your platform with real-time crypto data and insights from
            200+ markets—with just 1 integration.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((tier, idx) => {
              const isStandard = idx === 0;
              const isPlus = idx === 2;
              const isPro = idx === 3;

              return (
                <div
                  key={tier.name}
                  className={`flex flex-col bg-[#0a0a0f]/60 backdrop-blur-md p-6 relative rounded-none
                    ${
                      isPro
                        ? "border border-[#9945FF]/50 shadow-[0_0_15px_rgba(153,69,255,0.15)]"
                        : "border border-white/10"
                    }
                  `}
                >
                  {isPlus && (
                    <div className="absolute top-0 right-6 -translate-y-1/2">
                      <span className="bg-[#f59e0b] text-[#0a0a0f] text-[10px] font-bold px-3 py-1 uppercase tracking-wider rounded-sm">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-6 border-b border-white/10 pb-6">
                    <h3 className="text-lg font-medium text-[#f8fafc] flex items-center gap-2 mb-2">
                      <svg
                        className="w-4 h-4 text-[#14F195]"
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
                      {tier.name}
                    </h3>
                    <div className="text-3xl font-bold text-white mb-1">
                      {tier.price.split(" ")[0]}{" "}
                      {tier.price.includes("/") && (
                        <span className="text-sm font-normal text-[#94a3b8]">
                          / month
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-grow space-y-6">
                    <div>
                      <p className="text-sm text-[#94a3b8] mb-1">Included</p>
                      <p className="font-semibold text-[15px]">{tier.included}</p>
                    </div>
                    <div>
                      <p className="text-sm text-[#94a3b8] mb-1">
                        API Rate Limit
                      </p>
                      <p className="font-semibold text-[15px]">{tier.apiLimit}</p>
                    </div>

                    {tier.features.length > 0 && (
                      <ul className="space-y-3 pt-4 border-t border-white/5">
                        {tier.features.map((feat, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-3 text-sm text-[#e2e8f0]"
                          >
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
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-8 pt-6">
                    {isStandard && (
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
                          Standard
                        </span>
                        <button
                          type="button"
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            standardToggle ? "bg-[#14F195]" : "bg-white/20"
                          }`}
                          onClick={() => setStandardToggle(!standardToggle)}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              standardToggle ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    )}

                    {isPlus ? (
                      <button
                        className="w-full uppercase tracking-wider text-sm font-bold h-12"
                        style={{ ...btnPrimaryBase, borderRadius: 0 }}
                        onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
                        onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
                      >
                        Buy Now
                      </button>
                    ) : (
                      <button
                        className="w-full uppercase tracking-wider text-sm font-bold h-12 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        {isStandard ? "Try For Free" : "Buy Now"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
