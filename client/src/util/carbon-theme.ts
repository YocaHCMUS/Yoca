/**
 * Static mapping of Carbon Design System v11 tokens to CSS Custom Properties.
 * These reflect the current theme applied to the DOM (White, G10, G90, G100).
 */
export const cds = {
  /* Backgrounds */
  background: "var(--cds-background)",
  backgroundHover: "var(--cds-background-hover)",
  backgroundActive: "var(--cds-background-active)",
  backgroundSelected: "var(--cds-background-selected)",
  backgroundSelectedHover: "var(--cds-background-selected-hover)",
  backgroundInverse: "var(--cds-background-inverse)",
  backgroundInverseHover: "var(--cds-background-inverse-hover)",
  backgroundBrand: "var(--cds-background-brand)",

  /* Layers */
  layer01: "var(--cds-layer-01)",
  layer02: "var(--cds-layer-02)",
  layer03: "var(--cds-layer-03)",
  layerHover01: "var(--cds-layer-hover-01)",
  layerHover02: "var(--cds-layer-hover-02)",
  layerHover03: "var(--cds-layer-hover-03)",
  layerActive01: "var(--cds-layer-active-01)",
  layerActive02: "var(--cds-layer-active-02)",
  layerActive03: "var(--cds-layer-active-03)",
  layerSelected01: "var(--cds-layer-selected-01)",
  layerSelected02: "var(--cds-layer-selected-02)",
  layerSelected03: "var(--cds-layer-selected-03)",

  /* Layer Accents */
  layerAccent01: "var(--cds-layer-accent-01)",
  layerAccent02: "var(--cds-layer-accent-02)",
  layerAccent03: "var(--cds-layer-accent-03)",
  layerAccentHover01: "var(--cds-layer-accent-hover-01)",
  layerAccentHover02: "var(--cds-layer-accent-hover-02)",
  layerAccentHover03: "var(--cds-layer-accent-hover-03)",

  /* Fields (Inputs) */
  field01: "var(--cds-field-01)",
  field02: "var(--cds-field-02)",
  field03: "var(--cds-field-03)",
  fieldHover01: "var(--cds-field-hover-01)",
  fieldHover02: "var(--cds-field-hover-02)",
  fieldHover03: "var(--cds-field-hover-03)",

  /* Borders */
  borderInteractive: "var(--cds-border-interactive)",
  borderSubtle00: "var(--cds-border-subtle-00)",
  borderSubtle01: "var(--cds-border-subtle-01)",
  borderSubtle02: "var(--cds-border-subtle-02)",
  borderSubtle03: "var(--cds-border-subtle-03)",
  borderStrong01: "var(--cds-border-strong-01)",
  borderStrong02: "var(--cds-border-strong-02)",
  borderStrong03: "var(--cds-border-strong-03)",
  borderInverse: "var(--cds-border-inverse)",
  borderDisabled: "var(--cds-border-disabled)",

  /* Text */
  textPrimary: "var(--cds-text-primary)",
  textSecondary: "var(--cds-text-secondary)",
  textPlaceholder: "var(--cds-text-placeholder)",
  textHelper: "var(--cds-text-helper)",
  textError: "var(--cds-text-error)",
  textInverse: "var(--cds-text-inverse)",
  textOnColor: "var(--cds-text-on-color)",
  textDisabled: "var(--cds-text-disabled)",

  /* Links */
  linkPrimary: "var(--cds-link-primary)",
  linkPrimaryHover: "var(--cds-link-primary-hover)",
  linkSecondary: "var(--cds-link-secondary)",
  linkInverse: "var(--cds-link-inverse)",

  /* Icons */
  iconPrimary: "var(--cds-icon-primary)",
  iconSecondary: "var(--cds-icon-secondary)",
  iconInverse: "var(--cds-icon-inverse)",
  iconOnColor: "var(--cds-icon-on-color)",
  iconDisabled: "var(--cds-icon-disabled)",

  /* Support / Status */
  supportSuccess: "var(--cds-support-success)",
  supportError: "var(--cds-support-error)",
  supportWarning: "var(--cds-support-warning)",
  supportInfo: "var(--cds-support-info)",

  /* Interactive States */
  interactive01: "var(--cds-interactive-01)",
  interactive02: "var(--cds-interactive-02)",
  interactive03: "var(--cds-interactive-03)",
  focus: "var(--cds-focus)",
} as const;

// Create a type for your theme for extra safety
export type CarbonThemeType = typeof cds;
