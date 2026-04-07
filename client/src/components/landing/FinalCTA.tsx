import { Link } from "react-router";

export function LandingFinalCTA() {
  return (
    <section
      id="cta"
      className="py-24 sm:py-32"
      style={{ scrollMarginTop: "6rem" }}
    >
      <div
        className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-8 py-24 text-center sm:px-14"
        style={{
          backgroundColor: "#111118",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Radial glow */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: "50%",
            top: "50%",
            width: "400px",
            height: "400px",
            transform: "translate(-50%, -50%)",
            background: "rgba(249,115,22,0.15)",
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
            Join teams who use Yoca to see wallets, tokens, and markets in one
            coherent story.
          </p>
          <Link
            to="/auth"
            className="mt-10 inline-flex items-center justify-center rounded-full bg-[#f97316] px-10 py-4 text-sm font-semibold text-[#0a0a0f]"
            style={{ transition: "transform 0.15s ease" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "scale(1.03)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = "scale(1)")
            }
          >
            Get started
          </Link>
        </div>
      </div>
    </section>
  );
}
