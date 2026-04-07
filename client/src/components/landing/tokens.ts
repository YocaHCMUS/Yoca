import type { CSSProperties } from "react";

/** Primary accent — CTAs, key highlights */
export const LANDING_ACCENT = "#FF6B00";
export const LANDING_ACCENT_HOVER = "#ff8533";
export const LANDING_ACCENT_MUTED = "rgba(255, 107, 0, 0.35)";
export const LANDING_ACCENT_GLOW = "rgba(255, 107, 0, 0.2)";

export const SECTION_PADDING_Y = 120;
export const CARD_PADDING = 32;
export const CARD_RADIUS = 12;

export const GRID_MAX_WIDTH = "80rem";
export const GRID_GAP = "1.5rem";
export const GRID_GUTTER = "1.5rem";

/** 12-column shell shared by sections */
export const grid12Shell: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  columnGap: GRID_GAP,
  rowGap: GRID_GAP,
  width: "100%",
  maxWidth: GRID_MAX_WIDTH,
  marginLeft: "auto",
  marginRight: "auto",
  paddingLeft: GRID_GUTTER,
  paddingRight: GRID_GUTTER,
  boxSizing: "border-box",
};

export const sectionVertical: CSSProperties = {
  paddingTop: SECTION_PADDING_Y,
  paddingBottom: SECTION_PADDING_Y,
};

export const cardSurface: CSSProperties = {
  borderRadius: CARD_RADIUS,
  padding: CARD_PADDING,
  backgroundColor: "#111118",
  border: "1px solid rgba(255,255,255,0.06)",
  boxSizing: "border-box",
};

/** Primary CTA — use with onMouseEnter/onMouseLeave handlers */
export const btnPrimaryBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 24px",
  minHeight: 44,
  borderRadius: 9999,
  fontSize: "0.875rem",
  fontWeight: 600,
  backgroundColor: LANDING_ACCENT,
  color: "#0a0a0f",
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
  transition:
    "background-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease",
  boxSizing: "border-box",
};

export const btnPrimaryEnter = (el: HTMLElement) => {
  el.style.backgroundColor = LANDING_ACCENT_HOVER;
  el.style.transform = "translateY(-1px)";
  el.style.boxShadow = "0 6px 24px rgba(255, 107, 0, 0.35)";
};

export const btnPrimaryLeave = (el: HTMLElement) => {
  el.style.backgroundColor = LANDING_ACCENT;
  el.style.transform = "translateY(0)";
  el.style.boxShadow = "none";
};

/** Ghost / secondary outline — same padding as primary */
export const btnSecondaryBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 24px",
  minHeight: 44,
  borderRadius: 9999,
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "#f8fafc",
  textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.18)",
  backgroundColor: "rgba(255,255,255,0.04)",
  cursor: "pointer",
  transition:
    "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.15s ease",
  boxSizing: "border-box",
};

export const btnSecondaryEnter = (el: HTMLElement) => {
  el.style.borderColor = "rgba(255,255,255,0.28)";
  el.style.backgroundColor = "rgba(255,255,255,0.09)";
  el.style.transform = "translateY(-1px)";
};

export const btnSecondaryLeave = (el: HTMLElement) => {
  el.style.borderColor = "rgba(255,255,255,0.18)";
  el.style.backgroundColor = "rgba(255,255,255,0.04)";
  el.style.transform = "translateY(0)";
};
