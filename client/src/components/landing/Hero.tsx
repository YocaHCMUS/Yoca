import { motion } from "framer-motion";
import { Link } from "react-router";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.13, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 120, damping: 22 },
  },
};

export function LandingHero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ paddingTop: "10rem", paddingBottom: "6rem" }}
    >
      {/* Glow orbs */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          left: "-8rem",
          top: "5rem",
          width: "420px",
          height: "420px",
          background: "rgba(249,115,22,0.18)",
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
          background: "rgba(139,92,246,0.22)",
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
          background: "rgba(249,115,22,0.06)",
          filter: "blur(80px)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-4xl text-center"
        >
          <motion.p
            variants={item}
            className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-[#f97316]"
          >
            Onchain analytics
          </motion.p>

          <motion.h1
            variants={item}
            className="text-4xl font-bold tracking-tight text-[#f8fafc] sm:text-5xl md:text-6xl"
            style={{ lineHeight: 1.1 }}
          >
            Make onchain data
            <br />
            work for you.
          </motion.h1>

          <motion.p
            variants={item}
            className="mx-auto mt-7 max-w-2xl text-lg text-[#94a3b8] sm:text-xl"
            style={{ lineHeight: 1.65 }}
          >
            Build with the onchain data platform trusted by teams who need
            clarity across wallets, tokens, and markets — powered by Yoca.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              to="/market"
              className="inline-flex items-center justify-center rounded-full bg-[#f97316] px-8 py-3.5 text-sm font-semibold text-[#0a0a0f]"
              style={{ transition: "transform 0.15s ease" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.03)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              Explore data
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-full px-8 py-3.5 text-sm font-semibold text-[#f8fafc]"
              style={{
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.03)",
                transition: "border-color 0.2s ease, background 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)";
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
            >
              Get started
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
