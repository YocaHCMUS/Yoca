import type { ReactNode } from "react";

interface ErrorLayoutProps {
  code: string;
  title: string;
  description: string;
  actions: ReactNode;
  detail?: ReactNode;
}

const PAGE_CLASSNAMES =
  "relative isolate min-h-[calc(100vh-var(--page-content-top-offset,0px))] overflow-hidden bg-neutral-950 text-neutral-100";

const CONTENT_CONTAINER_CLASSNAMES =
  "relative z-10 mx-auto flex min-h-[calc(100vh-var(--page-content-top-offset,0px))] w-full max-w-7xl flex-col items-center justify-center px-6 text-center sm:px-10 lg:px-16";

const CONTENT_CLASSNAMES = "w-full max-w-2xl";

const WATERMARK_CLASSNAMES =
  "pointer-events-none absolute right-[-0.16em] top-1/2 -z-0 -translate-y-1/2 select-none font-black leading-none tracking-tight text-white/[0.06] text-[56vw] sm:text-[44vw] lg:text-[34vw]";

const LEFT_GLOW_CLASSNAMES =
  "pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl";

const RIGHT_GLOW_CLASSNAMES =
  "pointer-events-none absolute bottom-0 right-14 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl";

const OVERLINE_CLASSNAMES =
  "m-0 text-xs font-semibold uppercase tracking-[0.28em] text-neutral-400";

const TITLE_CLASSNAMES = "m-0 mt-4 text-5xl font-semibold tracking-tight sm:text-6xl";

const DESCRIPTION_CLASSNAMES = "m-0 mt-6 max-w-xl text-lg leading-relaxed text-neutral-300";

const DETAIL_CLASSNAMES = "m-0 mt-3 max-w-xl text-sm text-neutral-400";

const ACTIONS_CLASSNAMES = "mt-10 flex w-full";

export const ERROR_ACTION_GROUP_CLASSNAMES = "flex w-full flex-wrap gap-3";

export const ERROR_PRIMARY_ACTION_CLASSNAMES =
  "inline-flex items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-400/90 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950";

export const ERROR_SECONDARY_ACTION_CLASSNAMES =
  "inline-flex items-center justify-center rounded-md border border-neutral-700 bg-neutral-900/70 px-5 py-3 text-sm font-semibold text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950";

export function ErrorLayout({
  code,
  title,
  description,
  actions,
  detail,
}: ErrorLayoutProps) {
  return (
    <section className={PAGE_CLASSNAMES}>
      <div aria-hidden className={LEFT_GLOW_CLASSNAMES} />
      <div aria-hidden className={RIGHT_GLOW_CLASSNAMES} />
      <span aria-hidden className={WATERMARK_CLASSNAMES}>
        {code}
      </span>

      <div className={CONTENT_CONTAINER_CLASSNAMES}>
        <div className={CONTENT_CLASSNAMES}>
          <p className={OVERLINE_CLASSNAMES}>{code} ERROR</p>
          <h1 className={TITLE_CLASSNAMES}>{title}</h1>
          <p className={DESCRIPTION_CLASSNAMES}>{description}</p>
          {detail ? <p className={DETAIL_CLASSNAMES}>{detail}</p> : null}
          <div className={ACTIONS_CLASSNAMES}>{actions}</div>
        </div>
      </div>
    </section>
  );
}
