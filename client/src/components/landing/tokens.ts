import type { CSSProperties } from "react";

/** Solana accent system */
export const LANDING_ACCENT = "#9945FF";
export const LANDING_ACCENT_2 = "#14F195";
export const LANDING_ACCENT_HOVER = "#ad6dff";
export const LANDING_ACCENT_MUTED = "rgba(153, 69, 255, 0.4)";
export const LANDING_ACCENT_GLOW = "rgba(20, 241, 149, 0.24)";

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
  backgroundColor: "rgba(17, 17, 24, 0.62)",
  border: "1px solid rgba(153,69,255,0.38)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  boxShadow: "0 0 28px -16px rgba(153,69,255,0.7)",
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
  background:
    "linear-gradient(120deg, #9945FF 0%, #7d5fff 52%, #14F195 100%)",
  color: "#050509",
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
  transition:
    "background-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease",
  boxSizing: "border-box",
};

export const btnPrimaryEnter = (el: HTMLElement) => {
  el.style.background =
    "linear-gradient(120deg, #ad6dff 0%, #8f76ff 52%, #40f3b0 100%)";
  el.style.transform = "translateY(-1px)";
  el.style.boxShadow =
    "0 8px 28px rgba(153,69,255,0.4), 0 0 22px rgba(20,241,149,0.35)";
};

export const btnPrimaryLeave = (el: HTMLElement) => {
  el.style.background =
    "linear-gradient(120deg, #9945FF 0%, #7d5fff 52%, #14F195 100%)";
  el.style.transform = "translateY(0)";
  el.style.boxShadow = "0 0 14px rgba(153,69,255,0.25)";
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
  border: "1px solid rgba(153,69,255,0.45)",
  backgroundColor: "rgba(20,241,149,0.06)",
  cursor: "pointer",
  transition:
    "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.15s ease",
  boxSizing: "border-box",
};

export const btnSecondaryEnter = (el: HTMLElement) => {
  el.style.borderColor = "rgba(20,241,149,0.65)";
  el.style.backgroundColor = "rgba(20,241,149,0.14)";
  el.style.transform = "translateY(-1px)";
  el.style.boxShadow = "0 0 18px rgba(20,241,149,0.24)";
};

export const btnSecondaryLeave = (el: HTMLElement) => {
  el.style.borderColor = "rgba(153,69,255,0.45)";
  el.style.backgroundColor = "rgba(20,241,149,0.06)";
  el.style.transform = "translateY(0)";
  el.style.boxShadow = "none";
};
