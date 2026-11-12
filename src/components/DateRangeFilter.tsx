"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { useAppearance } from "@/components/AppearanceProvider";

/** From / to date pickers with a reset button, shared by the list pages (same look as Commandes). */
export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const { tr } = useAppearance();
  const input = "rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="field">
        <input type="date" value={from} max={to || undefined} onChange={(event) => onChange({ from: event.target.value, to })} className={input} />
        <span className="field-label">{tr("Date de début")}</span>
      </label>
      <label className="field">
        <input type="date" value={to} min={from || undefined} onChange={(event) => onChange({ from, to: event.target.value })} className={input} />
        <span className="field-label">{tr("Date de fin")}</span>
      </label>
      {from || to ? (
        <button
          type="button"
          onClick={() => onChange({ from: "", to: "" })}
          className="rounded-sm border border-line px-3 py-2 text-sm text-ink transition-colors hover:border-gold"
        >
          <ActionLabel text={tr("Réinitialiser les dates")} />
        </button>
      ) : null}
    </div>
  );
}

/** Whether an ISO timestamp falls within the inclusive YYYY-MM-DD range (empty bounds are open). */
export function inDateRange(iso: string | null, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const day = iso.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}
