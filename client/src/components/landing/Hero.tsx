import { motion } from "framer-motion";
import { Link } from "react-router";
import {
  LANDING_ACCENT,
  LANDING_ACCENT_GLOW,
  SECTION_PADDING_Y,
  grid12Shell,
  btnPrimaryBase,
  btnPrimaryEnter,
  btnPrimaryLeave,
  btnSecondaryBase,
  btnSecondaryEnter,
  btnSecondaryLeave,
} from "./tokens";

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
      style={{
        paddingTop: SECTION_PADDING_Y + 80,
        paddingBottom: SECTION_PADDING_Y,
      }}
    >
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          left: "-8rem",
          top: "5rem",
          width: "420px",
          height: "420px",
          background: "rgba(255, 107, 0, 0.16)",
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

      <div style={grid12Shell}>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="text-center"
          style={{ gridColumn: "1 / -1" }}
        >
          <div className="mx-auto max-w-4xl">
            <motion.p
              variants={item}
              className="mb-5 text-sm font-semibold uppercase tracking-[0.22em]"
              style={{ color: LANDING_ACCENT }}
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
                style={btnPrimaryBase}
                onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
                onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
              >
                Explore data
              </Link>
              <Link
                to="/auth"
                style={btnSecondaryBase}
                onMouseEnter={(e) => btnSecondaryEnter(e.currentTarget)}
                onMouseLeave={(e) => btnSecondaryLeave(e.currentTarget)}
              >
                Get started
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
