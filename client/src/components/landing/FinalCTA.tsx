import { Link } from "react-router";
import {
  CARD_RADIUS,
  CARD_PADDING,
  LANDING_ACCENT_GLOW,
  SECTION_PADDING_Y,
  grid12Shell,
  btnPrimaryBase,
  btnPrimaryEnter,
  btnPrimaryLeave,
} from "./tokens";

export function LandingFinalCTA() {
  return (
    <section
      id="cta"
      style={{
        paddingTop: SECTION_PADDING_Y,
        paddingBottom: SECTION_PADDING_Y,
        scrollMarginTop: "5rem",
      }}
    >
      <div style={grid12Shell}>
        <div
          className="relative overflow-hidden text-center"
          style={{
            gridColumn: "1 / -1",
            borderRadius: CARD_RADIUS,
            padding: CARD_PADDING,
            backgroundColor: "#111118",
            border: "1px solid rgba(255,255,255,0.08)",
            maxWidth: "56rem",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <div
            className="pointer-events-none absolute rounded-full"
            style={{
              left: "50%",
              top: "50%",
              width: "400px",
              height: "400px",
              transform: "translate(-50%, -50%)",
              background: LANDING_ACCENT_GLOW,
              filter: "blur(100px)",
            }}
            aria-hidden
          />

          <div className="relative">
            <h2
              className="text-3xl font-bold tracking-tight text-[#f8fafc] sm:text-4xl md:text-5xl"
              style={{ lineHeight: 1.15 }}
            >
              Create off-the-chart growth
            </h2>
            <p
              className="mx-auto mt-5 max-w-lg text-[#94a3b8]"
              style={{ lineHeight: 1.65 }}
            >
              Join teams who use Yoca to see wallets, tokens, and markets in
              one coherent story.
            </p>
            <Link
              to="/auth"
              className="mt-10 inline-flex"
              style={btnPrimaryBase}
              onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
              onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
