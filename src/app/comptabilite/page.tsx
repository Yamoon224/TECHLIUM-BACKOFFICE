"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { DataTable } from "@/components/DataTable";
import { useAppearance } from "@/components/AppearanceProvider";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { useAuth } from "@/lib/useAuth";
import {
  AccountingError,
  JOURNAL_LABEL,
  entryTotals,
  getTrialBalance,
  isTrialBalanced,
  listEntries,
  type JournalEntry,
  type TrialBalance,
} from "@/lib/accounting";

const fmt = (amount: number) => amount.toLocaleString("fr-FR");

export default function AccountingPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [balance, setBalance] = useState<TrialBalance | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [journal, setJournal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getTrialBalance(token)
      .then(setBalance)
      .catch((caught) => setError(caught instanceof AccountingError ? caught.message : tr("Balance indisponible.")));
  }, [token, tr]);

  useEffect(() => {
    if (!token) return;
    listEntries(token, { journal: journal ?? undefined })
      .then(setEntries)
      .catch((caught) => setError(caught instanceof AccountingError ? caught.message : tr("Écritures indisponibles.")));
  }, [token, journal, tr]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder à la comptabilité.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} />

      <main className="flex w-full flex-1 flex-col gap-8 px-4 py-8">
        <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Comptabilité")}</h1>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <section className="flex flex-col gap-3">
          <h2 className="section-title font-display text-lg text-ink">{tr("Balance générale")}</h2>
          {balance ? (
            <div className="rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
              <DataTable
                name="balance-generale"
                title={tr("Balance générale")}
                rows={balance.accounts}
                headers={[tr("Compte"), tr("Libellé"), tr("Débit"), tr("Crédit"), tr("Solde")]}
                renderRow={(account) => (
                  <tr key={account.code} className="border-b border-line">
                    <td className="py-2 text-ink">{account.code}</td>
                    <td className="py-2 text-ink-soft">{account.name}</td>
                    <td className="py-2 text-right text-ink">{fmt(account.debit)}</td>
                    <td className="py-2 text-right text-ink">{fmt(account.credit)}</td>
                    <td className="py-2 text-right text-ink">{fmt(account.balance)}</td>
                  </tr>
                )}
                footer={
                  <tr className="font-medium">
                    <td className="py-2 text-ink" colSpan={2}>
                      {tr("Total")} {isTrialBalanced(balance) ? "" : tr("- DÉSÉQUILIBRÉ")}
                    </td>
                    <td className="py-2 text-right text-ink">{fmt(balance.total_debit)}</td>
                    <td className="py-2 text-right text-ink">{fmt(balance.total_credit)}</td>
                    <td />
                  </tr>
                }
              />
            </div>
          ) : (
            <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="section-title font-display text-lg text-ink">{tr("Écritures")}</h2>
          <nav className="flex flex-wrap gap-2">
            {[null, ...Object.keys(JOURNAL_LABEL)].map((code) => (
              <button
                key={code ?? "all"}
                type="button"
                onClick={() => setJournal(code)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  journal === code ? "border-gold bg-gold text-on-primary font-medium" : "border-line text-ink hover:border-gold"
                }`}
              >
                {code === null ? <ActionLabel text={tr("Tous les journaux")} /> : JOURNAL_LABEL[code]}
              </button>
            ))}
          </nav>

          {entries.length === 0 ? (
            <p className="text-sm text-ink-soft">{tr("Aucune écriture.")}</p>
          ) : (
            <div className="rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
              <DataTable
                name="ecritures"
                title={tr("Écritures")}
                rows={entries}
                headers={[tr("Date"), tr("Journal"), tr("Libellé"), tr("Référence"), tr("Débit"), tr("Crédit")]}
                renderRow={(entry) => {
                  const totals = entryTotals(entry);
                  return (
                    <Fragment key={entry.id}>
                      <tr className="border-t border-line text-ink">
                        <td className="py-2">{entry.entry_date}</td>
                        <td className="py-2">{tr(JOURNAL_LABEL[entry.journal] ?? entry.journal)}</td>
                        <td className="py-2">{entry.description}</td>
                        <td className="py-2 text-ink-soft">{entry.reference}</td>
                        <td className="py-2 text-right">{fmt(totals.debit)}</td>
                        <td className="py-2 text-right">{fmt(totals.credit)}</td>
                      </tr>
                      <tr className="border-b border-line">
                        <td colSpan={6} className="pb-2 pl-6">
                          <table className="w-full text-xs">
                            <tbody>
                              {entry.lines.map((line, index) => (
                                <tr key={index} className="text-ink-soft">
                                  <td className="py-0.5 pr-4">{line.account}</td>
                                  <td className="py-0.5 pr-4 text-right">{line.debit ? fmt(line.debit) : ""}</td>
                                  <td className="py-0.5 text-right">{line.credit ? fmt(line.credit) : ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </Fragment>
                  );
                }}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
