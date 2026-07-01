import { Link } from "react-router";
import { useLocalization } from "@/contexts/LocalizationContext";
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
  const { tr } = useLocalization();

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
            backgroundColor: "var(--landing-panel-bg)",
            border: "1px solid var(--landing-card-border)",
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
              className="text-3xl font-bold tracking-tight text-(--landing-foreground) sm:text-4xl md:text-5xl"
              style={{ lineHeight: 1.15 }}
            >
              {tr("landing.finalCta.title")}
            </h2>
            <p
              className="mx-auto mt-5 max-w-lg text-(--landing-muted)"
              style={{ lineHeight: 1.65 }}
            >
              {tr("landing.finalCta.subtitle")}
            </p>
            <Link
              to="/auth"
              className="mt-10 inline-flex"
              style={btnPrimaryBase}
              onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
              onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
            >
              {tr("landing.finalCta.cta")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
