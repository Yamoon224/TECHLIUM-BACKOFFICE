"use client";

import { Plus, X } from "lucide-react";
import { useAppearance } from "@/components/AppearanceProvider";
import type { ProductColor } from "@/lib/catalog";

export const MAX_COLORS = 12;

/** Quick picks; any other colour is one click away on the colour input. */
const PRESETS: ProductColor[] = [
  { name: "Noir", hex: "#1c1c1e" },
  { name: "Blanc", hex: "#f5f5f7" },
  { name: "Gris", hex: "#8e8e93" },
  { name: "Argent", hex: "#d1d1d6" },
  { name: "Bleu", hex: "#2f6fdb" },
  { name: "Rouge", hex: "#d03a3a" },
  { name: "Vert", hex: "#3a9d5d" },
  { name: "Or", hex: "#d4af37" },
];

/** Edits a product's list of colour choices: a swatch picker plus a name per colour. */
export function ColorsEditor({ value, onChange }: { value: ProductColor[]; onChange: (colors: ProductColor[]) => void }) {
  const { tr } = useAppearance();
  const full = value.length >= MAX_COLORS;

  function update(index: number, patch: Partial<ProductColor>) {
    onChange(value.map((color, i) => (i === index ? { ...color, ...patch } : color)));
  }

  function add(color: ProductColor) {
    if (!full) onChange([...value, color]);
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {value.map((color, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                type="color"
                value={color.hex}
                onChange={(event) => update(index, { hex: event.target.value })}
                aria-label={tr("Couleur")}
                className="h-9 w-11 shrink-0 cursor-pointer rounded-sm border border-line bg-surface p-0.5"
              />
              <input
                value={color.name}
                onChange={(event) => update(index, { name: event.target.value })}
                maxLength={40}
                placeholder={tr("Nom de la couleur")}
                className="h-9 flex-1 rounded-sm border border-line bg-surface px-3 text-sm text-ink focus:border-gold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={tr("Retirer la couleur")}
                className="rounded-sm border border-line p-2 text-ink-soft transition-colors hover:border-danger hover:text-danger"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.hex}
            type="button"
            disabled={full || value.some((color) => color.hex.toLowerCase() === preset.hex)}
            onClick={() => add({ ...preset, name: tr(preset.name) })}
            title={tr(preset.name)}
            aria-label={`${tr("Ajouter")} ${tr(preset.name)}`}
            className="h-6 w-6 rounded-full border border-line transition-transform hover:scale-110 disabled:opacity-30 disabled:hover:scale-100"
            style={{ backgroundColor: preset.hex }}
          />
        ))}
        <button
          type="button"
          disabled={full}
          onClick={() => add({ name: "", hex: "#888888" })}
          className="inline-flex items-center gap-1 rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> {tr("Autre couleur")}
        </button>
      </div>
    </div>
  );
}
