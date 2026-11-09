"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { DataTable } from "@/components/DataTable";
import { useAppearance } from "@/components/AppearanceProvider";
import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/useAuth";
import {
  AUDIT_METHODS,
  AuditError,
  describeAction,
  isFailure,
  listAuditEntries,
  outcomeLabel,
  verifyAuditChain,
  type AuditEntry,
  type AuditFilters,
  type AuditVerification,
} from "@/lib/audit";

export default function AuditPage() {
  const { tr, trf } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, user, logout } = useAuth();
  const [draft, setDraft] = useState<AuditFilters>({});
  const [filters, setFilters] = useState<AuditFilters>({});
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<AuditVerification | null>(null);
  const [verifying, setVerifying] = useState(false);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listAuditEntries(token, filters)
      .then(setEntries)
      .catch((caught) => setError(caught instanceof AuditError ? caught.message : tr("Journal indisponible.")))
      .finally(() => setLoading(false));
  }, [token, filters, tr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function handleVerify() {
    if (!token) return;
    setVerifying(true);
    setError(null);
    try {
      setVerification(await verifyAuditChain(token));
    } catch (caught) {
      setError(caught instanceof AuditError ? caught.message : tr("Vérification impossible."));
    } finally {
      setVerifying(false);
    }
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder au journal d'audit.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  const field = "rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink";

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} roles={user?.roles} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Journal d'audit")}</h1>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="rounded-sm border border-gold px-3 py-2 text-sm text-gold transition-colors disabled:opacity-50"
          >
            {verifying ? <ActionLabel text={tr("Vérification…")} /> : <ActionLabel text={tr("Vérifier l'intégrité")} />}
          </button>
        </div>

        {verification ? (
          <p
            role="status"
            className={`rounded-sm border p-3 text-sm ${verification.valid ? "border-line text-ink" : "border-danger text-danger"}`}
          >
            {verification.valid
              ? trf("Chaîne intacte : {count} entrée(s) vérifiée(s).", { count: verification.checked })
              : trf("Intégrité compromise à l'entrée n° {at} ({count} vérifiée(s) avant) - {reason}", { at: verification.broken_at ?? "?", count: verification.checked, reason: verification.reason ?? "" })}
          </p>
        ) : null}

        <form
          className="flex flex-wrap items-end gap-3 rounded-sm border border-line p-4 bg-surface shadow-card border-b-4 border-b-gold"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters(draft);
          }}
        >
          <label className="field">
            <input
              placeholder="12"
              value={draft.user_id ?? ""}
              onChange={(e) => setDraft({ ...draft, user_id: e.target.value })}
              inputMode="numeric"
              className={`${field} w-28`}
            />
            <span className="field-label">{tr("Utilisateur (id)")}</span>
          </label>
          <label className="field">
            <select
              value={draft.method ?? ""}
              onChange={(e) => setDraft({ ...draft, method: e.target.value })}
              className={field}
            >
              <option value="">{tr("Toutes")}</option>
              {AUDIT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <span className="field-label">{tr("Méthode")}</span>
          </label>
          <label className="field">
            <input
              value={draft.path ?? ""}
              onChange={(e) => setDraft({ ...draft, path: e.target.value })}
              placeholder={tr("refund")}
              className={`${field} w-44`}
            />
            <span className="field-label">{tr("Chemin contient")}</span>
          </label>
          <label className="field">
            <input
              placeholder=" "
              type="date"
              value={draft.from ?? ""}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              className={field}
            />
            <span className="field-label">{tr("Du")}</span>
          </label>
          <label className="field">
            <input
              placeholder=" "
              type="date"
              value={draft.to ?? ""}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              className={field}
            />
            <span className="field-label">{tr("Au")}</span>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={draft.failed ?? false}
              onChange={(e) => setDraft({ ...draft, failed: e.target.checked })}
            />
            {tr("Échecs et refus seulement")}
          </label>
          <Button type="submit"><ActionLabel text={tr("Filtrer")} /></Button>
        </form>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucune entrée.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="audit"
  rows={entries}
  headers={[tr("Date"), tr("Utilisateur"), tr("Action"), tr("Résultat"), tr("IP"), ""]}
  actionColumns={[5]}
  renderRow={(entry) => (
                  <Fragment key={entry.id}>
                    <tr className="border-b border-line align-top">
                      <td className="py-3 pr-4 text-ink-soft">{entry.occurred_at.slice(0, 19).replace("T", " ")}</td>
                      <td className="py-3 pr-4 text-ink">
                        {entry.user_name ?? "-"}
                        <span className="block text-xs text-ink-soft">
                          #{entry.user_id} · {entry.roles}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-ink">
                        {describeAction(entry) ? <span className="block font-medium">{tr(describeAction(entry) ?? "")}</span> : null}
                        <span className="text-ink-soft">{entry.method}</span> {entry.path}
                      </td>
                      <td className={`py-3 pr-4 ${isFailure(entry) ? "text-danger" : "text-ink-soft"}`}>
                        {entry.status} · {outcomeLabel(entry.status)}
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{entry.ip}</td>
                      <td className="py-3">
                        {entry.payload && Object.keys(entry.payload).length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setOpen(open === entry.id ? null : entry.id)}
                            className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                          >
                            <ActionLabel text={tr("Données")} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {open === entry.id ? (
                      <tr className="border-b border-line bg-surface">
                        <td colSpan={6} className="px-3 py-3">
                          <pre className="overflow-x-auto text-xs text-ink-soft">
                            {JSON.stringify(entry.payload, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )}
/>
          </div>
        )}

        <p className="text-xs text-ink-soft">
          {tr(
            "Les mots de passe, codes de confirmation et autres secrets sont masqués avant enregistrement. Le journal est en écriture seule et chaque entrée est signée avec la précédente : toute modification ou suppression est détectée par la vérification d'intégrité.",
          )}
        </p>
      </main>
    </div>
  );
}
