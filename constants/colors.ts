/**
 * Semantic design tokens for 잔물결 (Jan-mulgyeol / "gentle ripple").
 *
 * A calm, water-inspired palette: deep teal as the primary tone, soft
 * sage/mist surfaces, and a warm sand accent — evoking a quiet streamside
 * moment rather than a clinical wellness app.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#152E2B',
    tint: '#2F6F6B',

    // Core surfaces
    background: '#F3F7F5',
    foreground: '#152E2B',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#152E2B',

    // Primary action color (buttons, links, active states)
    primary: '#2F6F6B',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E3EEEA',
    secondaryForeground: '#1F3A37',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#E9F1EE',
    mutedForeground: '#72897F',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#C9A876',
    accentForeground: '#2A2015',

    // Destructive / safety-warning actions
    destructive: '#C1503F',
    destructiveForeground: '#FFFFFF',
    // Soft warning surface used behind destructive-toned banners
    warningSoft: '#F4DAD3',

    // Borders and input outlines
    border: '#DCE7E3',
    input: '#DCE7E3',
  },

  // Border radius (in px) — soft, water-drop rounded corners throughout.
  radius: 20,
};

export default colors;
