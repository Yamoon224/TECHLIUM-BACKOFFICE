"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { Check, LayoutPanelTop, PanelLeft, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BACKGROUND_PRESETS,
  isHexColor,
  PRIMARY_COLORS,
  type Appearance,
  type Background,
  type Language,
  type ThemeChoice,
} from "@/lib/appearance";
import { LANGUAGE_LABEL, type MessageKey } from "@/lib/i18n";
import { useAppearance } from "./AppearanceProvider";
import { Flag } from "./Flag";

const THEMES: { value: ThemeChoice; label: MessageKey }[] = [
  { value: "light", label: "settings.themeLight" },
  { value: "dark", label: "settings.themeDark" },
  { value: "auto", label: "settings.themeAuto" },
];

/** Right-hand drawer: colours, navigation layout, backgrounds, theme, full screen, language. */
export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appearance, update, reset, t } = useAppearance();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  return (
    <>
      {open ? <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden /> : null}

      <aside
        role="dialog"
        aria-label={t("settings.title")}
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-line bg-surface text-ink shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <header className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold">{t("settings.title")}</h2>
            <p className="mt-0.5 text-xs text-ink-soft">{t("settings.saved")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("settings.close")} className="rounded-sm p-1 text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          <Section title={t("settings.primary")}>
            <div className="flex flex-wrap gap-3">
              {PRIMARY_COLORS.map((color) => (
                <Swatch key={color} color={color} selected={appearance.primary === color} onClick={() => update({ primary: color })} size="lg" />
              ))}
              <PrimaryColorPicker appearance={appearance} update={update} />
            </div>
          </Section>

          <Section title={t("settings.navigation")}>
            <div className="grid grid-cols-2 gap-3">
              <Choice selected={appearance.layout === "side"} onClick={() => update({ layout: "side" })} Icon={PanelLeft} label={t("settings.sideMenu")} />
              <Choice selected={appearance.layout === "top"} onClick={() => update({ layout: "top" })} Icon={LayoutPanelTop} label={t("settings.topMenu")} />
            </div>
            <Toggle
              label={t("settings.collapse")}
              hint={t("settings.collapseHint")}
              checked={appearance.collapsed}
              disabled={appearance.layout === "top"}
              onChange={(collapsed) => update({ collapsed })}
            />
          </Section>

          <Section title={t("settings.backgrounds")}>
            <BackgroundPicker label={t("settings.sidebarTop")} field="sidebarTop" appearance={appearance} update={update} />
            <BackgroundPicker label={t("settings.topbar")} field="topbar" appearance={appearance} update={update} />
            <BackgroundPicker label={t("settings.sidebar")} field="sidebar" appearance={appearance} update={update} />
          </Section>

          <Section title={t("settings.theme")}>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => update({ theme: choice.value })}
                  aria-pressed={appearance.theme === choice.value}
                  className={`rounded-sm border px-2 py-2 text-sm transition-colors ${
                    appearance.theme === choice.value ? "border-gold bg-bg text-ink" : "border-line text-ink-soft hover:border-gold"
                  }`}
                >
                  {t(choice.label)}
                </button>
              ))}
            </div>
          </Section>

          <Section title={t("settings.display")}>
            <Toggle label={t("settings.fullscreen")} checked={fullscreen} onChange={toggleFullscreen} />
          </Section>

          <Section title={t("settings.language")}>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(LANGUAGE_LABEL) as Language[]).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => update({ language })}
                  aria-pressed={appearance.language === language}
                  className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-3 text-sm transition-colors ${
                    appearance.language === language ? "border-gold bg-bg text-ink" : "border-line text-ink-soft hover:border-gold"
                  }`}
                >
                  <Flag language={language} />
                  {LANGUAGE_LABEL[language]}
                </button>
              ))}
            </div>
          </Section>
        </div>

        <footer className="border-t border-line px-5 py-3">
          <button type="button" onClick={reset} className="flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink">
            <RotateCcw className="h-4 w-4" aria-hidden /> {t("settings.reset")}
          </button>
        </footer>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{title}</h3>
      {children}
    </section>
  );
}

function Swatch({ color, selected, onClick, size = "md" }: { color: string; selected: boolean; onClick: () => void; size?: "md" | "lg" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={color}
      aria-pressed={selected}
      style={{ backgroundColor: color }}
      className={`flex items-center justify-center rounded-full border border-line transition-transform hover:scale-110 ${
        size === "lg" ? "h-10 w-10" : "h-8 w-8"
      } ${selected ? "ring-2 ring-gold ring-offset-2 ring-offset-surface" : ""}`}
    >
      {selected ? <Check className="h-4 w-4 text-white mix-blend-difference" aria-hidden /> : null}
    </button>
  );
}

function Choice({ selected, onClick, Icon, label }: { selected: boolean; onClick: () => void; Icon: typeof PanelLeft; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-2 rounded-sm border px-3 py-4 text-sm transition-colors ${
        selected ? "border-gold bg-bg text-ink" : "border-line text-ink-soft hover:border-gold"
      }`}
    >
      <Icon className="h-6 w-6" aria-hidden />
      {label}
    </button>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${disabled ? "opacity-50" : ""}`}>
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-gold" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[1.375rem]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function BackgroundPicker({
  label,
  field,
  appearance,
  update,
}: {
  label: string;
  field: "sidebarTop" | "topbar" | "sidebar";
  appearance: Appearance;
  update: (patch: Partial<Appearance>) => void;
}) {
  const { t } = useAppearance();
  const current: Background = appearance[field];
  const custom = current !== null && !(BACKGROUND_PRESETS as readonly string[]).includes(current);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{label}</p>
        <button
          type="button"
          onClick={() => update({ [field]: null })}
          aria-pressed={current === null}
          className={`rounded-full px-2.5 py-0.5 text-xs ${current === null ? "bg-gold/20 text-gold-bright" : "text-ink-soft hover:text-ink"}`}
        >
          <ActionLabel text={t("settings.default")} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {BACKGROUND_PRESETS.map((color) => (
          <Swatch key={color} color={color} selected={current === color} onClick={() => update({ [field]: color })} />
        ))}

        <label
          title={t("settings.custom")}
          style={custom && current ? { backgroundColor: current } : undefined}
          className={`relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-ink-soft text-ink-soft ${
            custom ? "ring-2 ring-gold ring-offset-2 ring-offset-surface" : ""
          }`}
        >
          <Plus className="h-4 w-4" aria-hidden />
          <input
            type="color"
            aria-label={`${label} - ${t("settings.custom")}`}
            value={current ?? "#ffffff"}
            onChange={(event) => isHexColor(event.target.value) && update({ [field]: event.target.value })}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

/** Any colour through the browser's colour picker, next to the ready-made swatches. */
function PrimaryColorPicker({ appearance, update }: { appearance: Appearance; update: (patch: Partial<Appearance>) => void }) {
  const { t } = useAppearance();
  const custom = !(PRIMARY_COLORS as readonly string[]).includes(appearance.primary);

  return (
    <label
      title={t("settings.custom")}
      style={custom ? { backgroundColor: appearance.primary } : undefined}
      className={`relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-dashed border-ink-soft text-ink-soft ${
        custom ? "ring-2 ring-gold ring-offset-2 ring-offset-surface" : ""
      }`}
    >
      <Plus className="h-4 w-4" aria-hidden />
      <input
        type="color"
        aria-label={`${t("settings.primary")} - ${t("settings.custom")}`}
        value={appearance.primary}
        onChange={(event) => isHexColor(event.target.value) && update({ primary: event.target.value })}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}
