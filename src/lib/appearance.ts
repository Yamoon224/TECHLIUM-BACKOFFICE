/**
 * Appearance settings of the back office (colours, theme, navigation layout,
 * language), stored on this device only. Pure helpers: the provider applies
 * them to the document.
 */

export type ThemeChoice = "light" | "dark" | "auto";
export type NavLayout = "side" | "top";
export type Language = "fr" | "en";

/** A background choice: null = follow the theme ("Défaut"), else a hex colour. */
export type Background = string | null;

export interface Appearance {
  primary: string;
  theme: ThemeChoice;
  layout: NavLayout;
  collapsed: boolean;
  sidebarTop: Background;
  topbar: Background;
  sidebar: Background;
  language: Language;
}

export const STORAGE_KEY = "TechLium_backoffice_appearance";

/** Brand gold first (the default), then the usual accents. */
export const PRIMARY_COLORS = [
  "#ee9e0b",
  "#2563eb",
  "#4f46e5",
  "#9333ea",
  "#e11d48",
  "#dc2626",
  "#c2410c",
  "#b45309",
  "#047857",
  "#0f766e",
  "#0e7490",
  "#475569",
] as const;

export const BACKGROUND_PRESETS = [
  "#ffffff",
  "#f1f5f9",
  "#dbeafe",
  "#0f1a33",
  "#1f2937",
  "#0b0f19",
  "#14532d",
  "#7f1d1d",
] as const;

export const DEFAULT_APPEARANCE: Appearance = {
  primary: PRIMARY_COLORS[0],
  theme: "auto",
  layout: "side",
  collapsed: false,
  sidebarTop: null,
  topbar: null,
  sidebar: null,
  language: "fr",
};

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

/** Black or white, whichever reads better on the given colour (WCAG relative luminance). */
export function readableOn(hex: string): "#ffffff" | "#0b0f19" {
  if (!isHexColor(hex)) return "#ffffff";

  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);

  // White text wins on anything darker than this mid-luminance threshold.
  return luminance > 0.4 ? "#0b0f19" : "#ffffff";
}

/** Mixes a colour toward white (amount > 0) or black (amount < 0), for hover / tint shades. */
export function shade(hex: string, amount: number): string {
  if (!isHexColor(hex)) return hex;

  const target = amount < 0 ? 0 : 255;
  const ratio = Math.min(1, Math.abs(amount));
  const mix = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(value + (target - value) * ratio)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): "light" | "dark" {
  if (choice === "auto") return systemPrefersDark ? "dark" : "light";
  return choice;
}

/** Reads what was stored, keeping only valid values: a corrupted entry never breaks the interface. */
export function parseAppearance(raw: string | null): Appearance {
  if (!raw) return DEFAULT_APPEARANCE;

  let data: Partial<Record<keyof Appearance, unknown>>;
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    return DEFAULT_APPEARANCE;
  }
  if (typeof data !== "object" || data === null) return DEFAULT_APPEARANCE;

  const background = (value: unknown): Background => (isHexColor(value) ? value : null);

  return {
    primary: isHexColor(data.primary) ? data.primary : DEFAULT_APPEARANCE.primary,
    theme: data.theme === "light" || data.theme === "dark" || data.theme === "auto" ? data.theme : DEFAULT_APPEARANCE.theme,
    layout: data.layout === "side" || data.layout === "top" ? data.layout : DEFAULT_APPEARANCE.layout,
    collapsed: data.collapsed === true,
    sidebarTop: background(data.sidebarTop),
    topbar: background(data.topbar),
    sidebar: background(data.sidebar),
    language: data.language === "fr" || data.language === "en" ? data.language : DEFAULT_APPEARANCE.language,
  };
}

export function loadAppearance(): Appearance {
  try {
    return parseAppearance(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(appearance: Appearance): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // Storage unavailable: the choice simply lasts for this session.
  }
}

/** CSS custom properties for the current choices; a null background sets nothing (the theme decides). */
export function cssVariables(appearance: Appearance, theme: "light" | "dark" = "light"): Record<string, string> {
  const vars: Record<string, string> = {
    "--gold": appearance.primary,
    // "bright" is the accent used as text: darker on a light page, lighter on a dark one.
    "--gold-bright": theme === "dark" ? shade(appearance.primary, 0.25) : shade(appearance.primary, -0.25),
    "--gold-deep": shade(appearance.primary, -0.2),
    "--on-primary": readableOn(appearance.primary),
  };

  const backgrounds: [string, Background][] = [
    ["sidebar-top", appearance.sidebarTop],
    ["topbar", appearance.topbar],
    ["sidebar", appearance.sidebar],
  ];

  for (const [name, color] of backgrounds) {
    if (color) {
      vars[`--shell-${name}-bg`] = color;
      vars[`--shell-${name}-fg`] = readableOn(color);
    }
  }

  return vars;
}

/** Every variable cssVariables() may set, so a reset can clear them all. */
export const MANAGED_VARIABLES = [
  "--gold",
  "--gold-bright",
  "--gold-deep",
  "--on-primary",
  "--shell-sidebar-top-bg",
  "--shell-sidebar-top-fg",
  "--shell-topbar-bg",
  "--shell-topbar-fg",
  "--shell-sidebar-bg",
  "--shell-sidebar-fg",
] as const;
