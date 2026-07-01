import { motion } from "framer-motion";
import { Link } from "react-router";
import { useLocalization } from "@/contexts/LocalizationContext";
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
import { WalletGraphMock } from "./WalletGraphMock";

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
  const { tr } = useLocalization();

  return (
    <section
      className="relative overflow-hidden"
      style={{
        paddingTop: 96,
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

      <div style={grid12Shell}>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="items-center"
          style={{ gridColumn: "1 / -1" }}
        >
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-6 lg:pr-4">
            <motion.p
              variants={item}
              className="mb-5 text-sm font-semibold uppercase tracking-[0.22em]"
              style={{ color: LANDING_ACCENT }}
            >
              {tr("landing.hero.eyebrow")}
            </motion.p>

            <motion.h1
              variants={item}
              className="text-4xl font-bold tracking-tight text-(--landing-foreground) sm:text-5xl md:text-6xl"
              style={{ lineHeight: 1.08, maxWidth: "700px" }}
            >
              {tr("landing.hero.title")}
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-7 text-lg text-(--landing-muted) sm:text-xl"
              style={{
                lineHeight: 1.65,
                maxWidth: "600px",
              }}
            >
              {tr("landing.hero.subtitle")}
            </motion.p>

            <motion.div
              variants={item}
              className="flex flex-wrap items-center gap-4"
              style={{ marginTop: "56px" }}
            >
              <Link
                to="/market"
                style={btnPrimaryBase}
                onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
                onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
              >
                {tr("landing.hero.primaryCta")}
              </Link>
              <Link
                to="/auth"
                style={btnSecondaryBase}
                onMouseEnter={(e) => btnSecondaryEnter(e.currentTarget)}
                onMouseLeave={(e) => btnSecondaryLeave(e.currentTarget)}
              >
                {tr("landing.hero.secondaryCta")}
              </Link>
            </motion.div>
            </div>

            <motion.div
              variants={item}
              className="lg:col-span-6"
              style={{ alignSelf: "center" }}
            >
              <WalletGraphMock />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
