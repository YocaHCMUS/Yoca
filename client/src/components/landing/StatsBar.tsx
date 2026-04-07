import { useInView } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

function StatValue({
  end,
  format,
}: {
  end: number;
  format: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const stableFormat = useCallback(format, []);
  const [display, setDisplay] = useState(() => stableFormat(0));

  useEffect(() => {
    if (!isInView) return;
    const duration = 2000;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(stableFormat(end * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [isInView, end, stableFormat]);

  return (
    <span
      ref={ref}
      className="font-mono text-4xl font-bold tabular-nums text-[#f8fafc] sm:text-5xl"
      style={{ lineHeight: 1.1 }}
    >
      {display}
    </span>
  );
}

const stats = [
  {
    label: "Chains",
    end: 100,
    format: (n: number) => `${Math.max(0, Math.round(n))}+`,
  },
  {
    label: "Users",
    end: 1_000_000,
    format: (n: number) => {
      const m = n / 1_000_000;
      if (m < 0.05) return "0";
      return `${m >= 1 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M+`;
    },
  },
  {
    label: "Datasets",
    end: 1_500_000,
    format: (n: number) => {
      const m = n / 1_000_000;
      if (m < 0.05) return "0";
      const s =
        m >= 1 && m % 1 < 0.05
          ? m.toFixed(0)
          : m.toFixed(1).replace(/\.0$/, "");
      return `${s}M+`;
    },
  },
] as const;

export function LandingStatsBar() {
  return (
    <section
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(17,17,24,0.55)",
      }}
      className="py-14 sm:py-16"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-10 gap-x-6 px-6 sm:grid-cols-4 lg:px-8">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="flex flex-col items-center gap-2 text-center"
            style={
              i > 0
                ? {
                    borderLeft: "1px solid rgba(255,255,255,0.08)",
                    paddingLeft: "1.5rem",
                  }
                : undefined
            }
          >
            <StatValue end={s.end} format={s.format} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
              {s.label}
            </span>
          </div>
        ))}

        <div
          className="col-span-2 flex flex-col items-center justify-center gap-2 pt-8 sm:col-span-1 sm:pt-0"
          style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "1.5rem" }}
        >
          <span
            className="rounded-full px-4 py-1.5 font-mono text-sm font-bold text-[#c4b5fd]"
            style={{
              border: "1px solid rgba(139,92,246,0.4)",
              background: "rgba(139,92,246,0.1)",
            }}
          >
            AI
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
            Ready
          </span>
        </div>
      </div>
    </section>
  );
}
