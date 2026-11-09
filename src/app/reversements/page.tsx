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
import { formatMoney } from "@/lib/money";
import { listVendors, type Vendor } from "@/lib/vendors";
import {
  PAYOUT_STATUS_LABEL,
  PayoutsError,
  calculatePayout,
  getPayout,
  listPayouts,
  markPayoutPaid,
  totalOwed,
  type Payout,
} from "@/lib/payouts";

export default function PayoutsPage() {
  const { tr, trf } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [detail, setDetail] = useState<Payout | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listPayouts(token)
      .then(setPayouts)
      .catch((caught) => setError(caught instanceof PayoutsError ? caught.message : tr("Reversements indisponibles.")))
      .finally(() => setLoading(false));
  }, [token, tr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!token) return;
    listVendors(token, "active")
      .then(setVendors)
      .catch(() => setVendors([]));
  }, [token]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      refresh();
    } catch (caught) {
      setError(caught instanceof PayoutsError ? caught.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  function handleCalculate(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !vendorId) return;
    void run(() => calculatePayout(token, Number(vendorId)), tr("Calcul impossible."));
  }

  function handlePay(payout: Payout) {
    if (!token) return;
    const reference = window.prompt(trf("Référence du virement / mobile money pour {name} ?", { name: payout.vendor_name }));
    if (!reference) return;
    void run(() => markPayoutPaid(token, payout.id, reference), tr("Enregistrement impossible."));
  }

  async function handleDetail(payout: Payout) {
    if (!token) return;
    if (detail?.id === payout.id) {
      setDetail(null);
      return;
    }
    try {
      setDetail(await getPayout(token, payout.id));
    } catch (caught) {
      setError(caught instanceof PayoutsError ? caught.message : tr("Relevé indisponible."));
    }
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux reversements.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  const owed = totalOwed(payouts);

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Reversements vendeurs")}</h1>
          <p className="text-sm text-ink-soft">
            {tr("Restant dû aux vendeurs :")}{" "}
            <span className="text-ink">{formatMoney({ amount: owed, currency: "XOF" })}</span>
          </p>
        </div>

        <form
          onSubmit={handleCalculate}
          className="flex flex-wrap items-end gap-3 rounded-sm border border-line p-4 bg-surface shadow-card border-b-4 border-b-gold"
        >
          <label className="field">
            <select
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
              className="min-w-56 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="">{tr("Choisir un vendeur…")}</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.company_name}
                </option>
              ))}
            </select>
            <span className="field-label">{tr("Vendeur")}</span>
          </label>
          <Button type="submit" disabled={busy || !vendorId}>
            <ActionLabel text={tr("Calculer le reversement")} />
          </Button>
          <p className="w-full text-xs text-ink-soft">
            {tr(
              "Inclut les commandes livrées dont le délai de retour est écoulé et qui n'ont pas encore été reversées.",
            )}
          </p>
        </form>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : payouts.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucun reversement.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="reversements"
  rows={payouts}
  headers={[tr("Vendeur"), tr("Ventes"), tr("Commission"), tr("Net à verser"), tr("Statut"), tr("Actions")]}
  actionColumns={[5]}
  renderRow={(payout) => {
                  const money = (amount: number) => formatMoney({ amount, currency: payout.currency });
                  return (
                    <Fragment key={payout.id}>
                      <tr className="border-b border-line">
                        <td className="py-3 pr-4 text-ink">{payout.vendor_name}</td>
                        <td className="py-3 pr-4 text-ink-soft">{money(payout.gross_amount)}</td>
                        <td className="py-3 pr-4 text-ink-soft">
                          {money(payout.commission_amount)} ({payout.commission_rate_percent} %)
                        </td>
                        <td className="py-3 pr-4 text-ink">{money(payout.net_amount)}</td>
                        <td className="py-3 pr-4 text-ink-soft">
                          {tr(PAYOUT_STATUS_LABEL[payout.status])}
                          {payout.payment_reference ? ` · ${payout.payment_reference}` : ""}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleDetail(payout)}
                              className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                            >
                              <ActionLabel text={tr("Relevé")} />
                            </button>
                            {payout.status === "pending" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handlePay(payout)}
                                className="rounded-sm border border-gold px-2 py-1 text-xs text-gold transition-colors disabled:opacity-50"
                              >
                                <ActionLabel text={tr("Marquer payé")} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {detail?.id === payout.id && detail.items ? (
                        <tr className="border-b border-line bg-surface">
                          <td colSpan={6} className="px-3 py-3">
                            <ul className="flex flex-col gap-1 text-xs text-ink-soft">
                              {detail.items.map((item) => (
                                <li key={item.order_number} className="flex justify-between gap-4">
                                  <span>{item.order_number}</span>
                                  <span>
                                    {item.refund_deduction_amount > 0
                                      ? `retours −${money(item.refund_deduction_amount)} · `
                                      : ""}
                                    {money(item.gross_amount)} − {money(item.commission_amount)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                }}
/>
          </div>
        )}
      </main>
    </div>
  );
}
