import { motion } from "framer-motion";
import { Link } from "react-router";
import { Terminal } from "lucide-react";

const codeLines = [
  { text: "curl -s https://api.yoca.example/v1/wallets/...", dim: false },
  { text: '  -H "Authorization: Bearer $YOCA_TOKEN"', dim: true },
  { text: " ", dim: true },
  { text: '{ "address": "\u2026", "pnl_30d": -1240.5, "tokens": 42 }', dim: false },
];

export function LandingDeveloperSection() {
  return (
    <section
      className="py-24 sm:py-32"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(to bottom, #111118, #0a0a0f)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          {/* Text side */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8b5cf6]">
              For developers
            </p>
            <h2
              className="mt-4 text-3xl font-bold tracking-tight text-[#f8fafc] sm:text-4xl"
              style={{ lineHeight: 1.15 }}
            >
              Build across chains.
              <br />
              Ship without setup.
            </h2>
            <p
              className="mt-6 max-w-lg text-[#94a3b8]"
              style={{ lineHeight: 1.7 }}
            >
              Drop into market and wallet routes from the same app you already
              run. Opinionated defaults, escape hatches when you need them.
            </p>
            <Link
              to="/market"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-[#8b5cf6] px-8 py-3.5 text-sm font-semibold text-white"
              style={{ transition: "opacity 0.15s ease" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Explore the app
            </Link>
          </div>

          {/* Terminal mock */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-2xl"
            style={{
              backgroundColor: "#0a0a0f",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 0 60px -20px rgba(139,92,246,0.35)",
            }}
          >
            <div
              className="flex items-center gap-2 px-5 py-3"
              style={{
                backgroundColor: "#111118",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: "#ef4444" }}
                />
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: "#eab308" }}
                />
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: "#22c55e" }}
                />
              </div>
              <Terminal className="ml-2 h-4 w-4 text-[#94a3b8]" aria-hidden />
              <span className="font-mono text-xs text-[#94a3b8]">
                yoca-cli &mdash; wallet snapshot
              </span>
            </div>
            <pre
              className="overflow-x-auto p-6 font-mono text-sm"
              style={{ lineHeight: 1.75 }}
            >
              {codeLines.map((line, i) => (
                <div
                  key={i}
                  className={line.dim ? "text-[#64748b]" : "text-[#e2e8f0]"}
                >
                  {line.text || "\u00a0"}
                </div>
              ))}
            </pre>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
