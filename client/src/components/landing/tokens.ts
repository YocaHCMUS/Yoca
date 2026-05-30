import type { CSSProperties } from "react";
import type { ThemeMode } from "@/contexts/ThemeContext";

type CSSVariableStyle = CSSProperties & Record<`--${string}`, string>;

/** Solana accent system */
export const LANDING_ACCENT = "#9945FF";
export const LANDING_ACCENT_2 = "#14F195";
export const LANDING_ACCENT_HOVER = "#ad6dff";
export const LANDING_ACCENT_MUTED = "rgba(153, 69, 255, 0.4)";
export const LANDING_ACCENT_GLOW = "rgba(20, 241, 149, 0.24)";

const landingThemeStyles: Record<ThemeMode, CSSVariableStyle> = {
  dark: {
    "--landing-bg": "#0a0a0f",
    "--landing-surface": "rgba(17,17,24,0.62)",
    "--landing-surface-strong": "rgba(17,17,24,0.84)",
    "--landing-foreground": "#f8fafc",
    "--landing-muted": "#94a3b8",
    "--landing-border": "rgba(255,255,255,0.08)",
    "--landing-card-bg": "rgba(17,17,24,0.72)",
    "--landing-card-border": "rgba(255,255,255,0.08)",
    "--landing-card-shadow": "0 0 28px -16px rgba(153,69,255,0.7), 0 0 18px -14px rgba(20,241,149,0.62)",
    "--landing-button-secondary-bg": "rgba(20,241,149,0.06)",
    "--landing-button-secondary-hover-bg": "rgba(20,241,149,0.14)",
    "--landing-button-secondary-border": "rgba(153,69,255,0.45)",
    "--landing-button-secondary-hover-border": "rgba(20,241,149,0.65)",
    "--landing-section-border": "rgba(255,255,255,0.06)",
    "--landing-panel-bg": "rgba(17,17,24,0.85)",
    "--landing-accent": LANDING_ACCENT,
  },
  light: {
    "--landing-bg": "#f8fafc",
    "--landing-surface": "rgba(255,255,255,0.8)",
    "--landing-surface-strong": "rgba(255,255,255,0.94)",
    "--landing-foreground": "#0f172a",
    "--landing-muted": "#475569",
    "--landing-border": "rgba(15,23,42,0.1)",
    "--landing-card-bg": "rgba(255,255,255,0.88)",
    "--landing-card-border": "rgba(15,23,42,0.1)",
    "--landing-card-shadow": "0 18px 40px -30px rgba(15,23,42,0.32)",
    "--landing-button-secondary-bg": "rgba(20,241,149,0.1)",
    "--landing-button-secondary-hover-bg": "rgba(20,241,149,0.18)",
    "--landing-button-secondary-border": "rgba(153,69,255,0.32)",
    "--landing-button-secondary-hover-border": "rgba(20,241,149,0.55)",
    "--landing-section-border": "rgba(15,23,42,0.08)",
    "--landing-panel-bg": "rgba(255,255,255,0.9)",
    "--landing-accent": LANDING_ACCENT,
  },
};

export function createLandingThemeStyles(theme: ThemeMode): CSSProperties {
  return landingThemeStyles[theme];
}

export const NAVBAR_HEIGHT = "4rem";
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
  background: "var(--landing-card-bg)",
  border: "1px solid var(--landing-card-border)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  boxShadow: "var(--landing-card-shadow)",
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
  color: "var(--landing-foreground)",
  textDecoration: "none",
  border: "1px solid var(--landing-button-secondary-border)",
  backgroundColor: "var(--landing-button-secondary-bg)",
  cursor: "pointer",
  transition:
    "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.15s ease",
  boxSizing: "border-box",
};

export const btnSecondaryEnter = (el: HTMLElement) => {
  el.style.borderColor = "var(--landing-button-secondary-hover-border)";
  el.style.backgroundColor = "var(--landing-button-secondary-hover-bg)";
  el.style.transform = "translateY(-1px)";
  el.style.boxShadow = "0 0 18px rgba(20,241,149,0.24)";
};

export const btnSecondaryLeave = (el: HTMLElement) => {
  el.style.borderColor = "var(--landing-button-secondary-border)";
  el.style.backgroundColor = "var(--landing-button-secondary-bg)";
  el.style.transform = "translateY(0)";
  el.style.boxShadow = "none";
};
