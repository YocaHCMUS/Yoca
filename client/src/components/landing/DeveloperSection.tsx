import { motion } from "framer-motion";
import { Link } from "react-router";
import { TerminalSnippet } from "./TerminalSnippet";
import {
  LANDING_ACCENT,
  SECTION_PADDING_Y,
  grid12Shell,
  btnPrimaryBase,
  btnPrimaryEnter,
  btnPrimaryLeave,
} from "./tokens";

export function LandingDeveloperSection() {
  return (
    <section
      style={{
        paddingTop: SECTION_PADDING_Y,
        paddingBottom: SECTION_PADDING_Y,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(to bottom, #111118, #0a0a0f)",
      }}
    >
      <div style={{ ...grid12Shell, alignItems: "center" }}>
        <div className="landing-dev-copy">
          <p
            className="text-sm font-semibold uppercase tracking-[0.22em]"
            style={{ color: LANDING_ACCENT }}
          >
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
            className="mt-8 inline-flex"
            style={btnPrimaryBase}
            onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
            onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
          >
            Explore the app
          </Link>
        </div>

        <motion.div
          className="landing-dev-terminal"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <TerminalSnippet />
        </motion.div>
      </div>
    </section>
  );
}
