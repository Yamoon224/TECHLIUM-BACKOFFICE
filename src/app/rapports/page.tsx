"use client";

import { DataTable } from "@/components/DataTable";
import { useAppearance } from "@/components/AppearanceProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/useAuth";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_META, type OrderStatus } from "@/lib/orderStatus";
import { RETURN_STATUS_LABEL, type ReturnStatus } from "@/lib/returns";
import {
  ReportsError,
  barPercent,
  defaultPeriod,
  downloadMarginCsv,
  downloadSalesCsv,
  getMargin,
  hasCostGap,
  marginPercentLabel,
  getDashboard,
  getSalesBySeller,
  isValidPeriod,
  maxRevenue,
  type Dashboard,
  type MarginReport,
  type Period,
  type SellerSales,
} from "@/lib/reports";

const xof = (amount: number) => formatMoney({ amount, currency: "XOF" });

const METHOD_LABEL: Record<string, string> = { cod: "Paiement à la livraison", mobile_money: "Mobile money" };

export default function ReportsPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, user, logout } = useAuth();
  // "Today" is only known in the browser: reading the clock during render
  // would be frozen at build time by the prerender, so the default period is
  // set on mount.
  const [draft, setDraft] = useState<Period>({ from: "", to: "" });
  const [period, setPeriod] = useState<Period | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [sellers, setSellers] = useState<SellerSales[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const initial = defaultPeriod(new Date());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initial);
    setPeriod(initial);
  }, []);

  useEffect(() => {
    if (!token || !period) return;
    let cancelled = false;

    Promise.all([getDashboard(token, period), getSalesBySeller(token, period)])
      .then(([dash, sellerRows]) => {
        if (cancelled) return;
        setDashboard(dash);
        setSellers(sellerRows);
        setError(null);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ReportsError ? caught.message : tr("Rapports indisponibles."));
      });

    return () => {
      cancelled = true;
    };
  }, [token, period, tr]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function handleExport() {
    if (!token || !period) return;
    setExporting(true);
    try {
      await downloadSalesCsv(token, period);
    } catch (caught) {
      setError(caught instanceof ReportsError ? caught.message : tr("Export impossible."));
    } finally {
      setExporting(false);
    }
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux rapports.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} roles={user?.roles} />

      <main className="flex w-full flex-1 flex-col gap-8 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Rapports")}</h1>

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (isValidPeriod(draft)) setPeriod(draft);
            }}
          >
            <label className="field">
              <input
                placeholder=" "
                type="date"
                value={draft.from}
                onChange={(event) => setDraft({ ...draft, from: event.target.value })}
                className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
              />
              <span className="field-label">{tr("Du")}</span>
            </label>
            <label className="field">
              <input
                placeholder=" "
                type="date"
                value={draft.to}
                onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
              />
              <span className="field-label">{tr("Au")}</span>
            </label>
            <Button type="submit" disabled={!isValidPeriod(draft)}>
              {tr("Appliquer")}
            </Button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-sm border border-line px-3 py-2 text-sm text-ink transition-colors hover:border-gold disabled:opacity-50"
            >
              {tr("Exporter les ventes (CSV)")}
            </button>
          </form>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {!dashboard ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : (
          <Report dashboard={dashboard} sellers={sellers} />
        )}
        {period ? <MarginSection token={token} period={period} /> : null}
      </main>
    </div>
  );
}

function Report({ dashboard, sellers }: { dashboard: Dashboard; sellers: SellerSales[] }) {
  const { tr } = useAppearance();
  const { sales, finance, returns, alerts } = dashboard;

  return (
    <>
      <section aria-label={tr("Indicateurs")}>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label={tr("Chiffre d'affaires")} value={xof(sales.revenue)} />
          <Tile label={tr("Commandes")} value={String(sales.orders)} />
          <Tile label={tr("Panier moyen")} value={xof(sales.average_basket)} />
          <Tile label={tr("Taux de retour")} value={`${returns.rate_percent} %`} />
        </dl>
      </section>

      {alerts.stalled_orders > 0 || alerts.low_stock_count > 0 ? (
        <section
          aria-label={tr("Alertes")}
          className="flex flex-col gap-2 rounded-sm border border-gold-deep p-4 text-sm"
        >
          <h2 className="section-title font-display text-lg text-ink">{tr("Alertes")}</h2>
          {alerts.stalled_orders > 0 ? (
            <p className="text-ink">
              {alerts.stalled_orders} {tr("commande(s) en attente ou confirmée(s) depuis plus de quelques jours.")}
            </p>
          ) : null}
          {alerts.low_stock_count > 0 ? (
            <>
              <p className="text-ink">
                {alerts.low_stock_count} {tr("offre(s) en stock bas ou en rupture :")}
              </p>
              <ul className="text-xs text-ink-soft">
                {alerts.low_stock.map((offer) => (
                  <li key={offer.offer_id}>
                    {offer.product} ({offer.sku}
                    {tr(") - stock :")} {offer.stock}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      <SalesChart days={sales.by_day} />

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="section-title font-display text-lg text-ink">{tr("Meilleurs produits")}</h2>
          {dashboard.top_products.length === 0 ? (
            <p className="text-sm text-ink-soft">{tr("Aucune vente sur la période.")}</p>
          ) : (
            <DataTable
              name="meilleurs-produits"
              title={tr("Meilleurs produits")}
              rows={dashboard.top_products}
              headers={[tr("Produit"), tr("Quantité"), tr("Chiffre d'affaires")]}
              renderRow={(product) => (
                <tr key={product.product} className="border-b border-line">
                  <td className="py-2 text-ink">{product.product}</td>
                  <td className="py-2 text-right text-ink-soft">× {product.quantity}</td>
                  <td className="py-2 text-right text-ink">{xof(product.revenue)}</td>
                </tr>
              )}
            />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="section-title font-display text-lg text-ink">{tr("Commandes par statut")}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {Object.entries(dashboard.orders_by_status).map(([status, count]) => (
              <li key={status} className="flex justify-between border-b border-line py-1">
                <span className="text-ink-soft">{tr(ORDER_STATUS_META[status as OrderStatus]?.label ?? status)}</span>
                <span className="text-ink">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="section-title font-display text-lg text-ink">{tr("Finance")}</h2>
          <dl className="flex flex-col gap-1 text-sm">
            <Row label={tr("Encaissé")} value={xof(finance.collected)} />
            {Object.entries(finance.collected_by_method).map(([method, amount]) => (
              <Row
                key={method}
                label={`${tr("dont")} ${tr(METHOD_LABEL[method] ?? method)}`}
                value={xof(amount)}
                muted
              />
            ))}
            <Row label={tr("Remboursé aux clients")} value={xof(finance.refunded)} />
            <Row label={tr("Commissions")} value={xof(finance.commissions)} />
            <Row label={tr("Reversé aux vendeurs")} value={xof(finance.paid_to_vendors)} />
            <Row label={tr("Restant dû aux vendeurs")} value={xof(finance.owed_to_vendors)} />
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="section-title font-display text-lg text-ink">{tr("Retours")}</h2>
          <dl className="flex flex-col gap-1 text-sm">
            <Row label={tr("Dossiers ouverts sur la période")} value={String(returns.count)} />
            <Row label={tr("Montant remboursé")} value={xof(returns.refunded_amount)} />
            {Object.entries(returns.by_status).map(([status, count]) => (
              <Row
                key={status}
                label={tr(RETURN_STATUS_LABEL[status as ReturnStatus] ?? status)}
                value={String(count)}
                muted
              />
            ))}
          </dl>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="section-title font-display text-lg text-ink">{tr("Ventes par vendeur")}</h2>
        {sellers.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucune vente sur la période.")}</p>
        ) : (
          <DataTable
            name="ventes-par-vendeur"
            title={tr("Ventes par vendeur")}
            rows={sellers}
            headers={[tr("Vendeur"), tr("Commandes"), tr("Chiffre d'affaires")]}
            renderRow={(seller) => (
              <tr key={seller.vendor_id ?? "own"} className="border-b border-line">
                <td className="py-2 text-ink">{seller.seller}</td>
                <td className="py-2 text-right text-ink-soft">
                  {seller.orders} {tr("cmd")}
                </td>
                <td className="py-2 text-right text-ink">{xof(seller.revenue)}</td>
              </tr>
            )}
          />
        )}
      </section>

      <p className="text-xs text-ink-soft">
        {tr("Montants en F CFA. Le chiffre d'affaires compte les commandes non annulées, TVA comprise.")}
      </p>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-line p-4 bg-surface shadow-card border-b-4 border-b-gold">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-1 font-display text-xl text-ink">{value}</dd>
    </div>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between border-b border-line py-1">
      <dt className={muted ? "pl-4 text-xs text-ink-soft" : "text-ink-soft"}>{label}</dt>
      <dd className={muted ? "text-xs text-ink-soft" : "text-ink"}>{value}</dd>
    </div>
  );
}

/**
 * One series (revenue per day), so no legend: the title names it. Bars are
 * thin with a rounded data end; the value is in each bar's tooltip, and an
 * equivalent table is one toggle away so the chart is never the only way in.
 */
function SalesChart({ days }: { days: { date: string; orders: number; revenue: number }[] }) {
  const { tr } = useAppearance();
  const [showTable, setShowTable] = useState(false);
  const max = maxRevenue(days);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="section-title font-display text-lg text-ink">{tr("Chiffre d'affaires par jour")}</h2>
        {days.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowTable((current) => !current)}
            className="text-xs text-gold underline-offset-4 hover:underline"
          >
            {showTable ? tr("Voir le graphique") : tr("Voir le tableau")}
          </button>
        ) : null}
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-ink-soft">{tr("Aucune vente sur la période.")}</p>
      ) : showTable ? (
        <DataTable
  name="chiffre-daffaires-par-jour"
  rows={days}
  headers={[tr("Jour"), tr("Commandes"), tr("Chiffre d'affaires")]}
  renderRow={(day) => (
              <tr key={day.date} className="border-b border-line">
                <td className="py-1 pr-4 text-ink">{day.date}</td>
                <td className="py-1 pr-4 text-right text-ink-soft">{day.orders}</td>
                <td className="py-1 text-right text-ink">{xof(day.revenue)}</td>
              </tr>
            )}
/>
      ) : (
        <div
          role="img"
          aria-label={tr("Chiffre d'affaires par jour")}
          className="flex h-40 items-end gap-1 border-b border-line"
        >
          {days.map((day) => (
            <div
              key={day.date}
              title={`${day.date} - ${xof(day.revenue)} (${day.orders} ${tr(day.orders > 1 ? "commandes" : "commande")})`}
              className="min-w-1 flex-1 rounded-t-[4px] bg-gold hover:bg-gold-bright"
              style={{ height: `${barPercent(day.revenue, max)}%` }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
<<<<<<< HEAD
 * TechLium's own-stock gross margin. Revenue is excluding VAT and net of the
=======
 * TechniLium's own-stock gross margin. Revenue is excluding VAT and net of the
>>>>>>> 0376d01425630b79cfcc80c036cb7a4206e89841
 * coupon share borne by own lines; third-party vendors' sales and commissions
 * are not in it. Returns are shown beside it, not netted.
 */
function MarginSection({ token, period }: { token: string; period: Period }) {
  const { tr } = useAppearance();
  const [margin, setMargin] = useState<MarginReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getMargin(token, period)
      .then((report) => {
        if (cancelled) return;
        setMargin(report);
        setError(null);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ReportsError ? caught.message : tr("Marge indisponible."));
      });

    return () => {
      cancelled = true;
    };
  }, [token, period, tr]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!margin) return <p className="text-sm text-ink-soft">{tr("Chargement de la marge…")}</p>;

  const { totals } = margin;

  return (
<<<<<<< HEAD
    <section className="flex flex-col gap-4 border-t border-line pt-8" aria-label={tr("Marge de TechLium")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title font-display text-xl font-semibold text-ink">{tr("Marge de TechLium")}</h2>
=======
    <section className="flex flex-col gap-4 border-t border-line pt-8" aria-label={tr("Marge de TechniLium")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title font-display text-xl font-semibold text-ink">{tr("Marge de TechniLium")}</h2>
>>>>>>> 0376d01425630b79cfcc80c036cb7a4206e89841
        <button
          type="button"
          onClick={() =>
            downloadMarginCsv(token, period).catch((caught) =>
              setError(caught instanceof ReportsError ? caught.message : tr("Export impossible.")),
            )
          }
          className="rounded-sm border border-line px-3 py-2 text-sm text-ink transition-colors hover:border-gold"
        >
          {tr("Exporter la marge (CSV)")}
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label={tr("Chiffre d'affaires HT")} value={xof(totals.revenue)} />
        <Tile label={tr("Coût des ventes")} value={xof(totals.cost)} />
        <Tile label={tr("Marge brute")} value={xof(totals.margin)} />
        <Tile label={tr("Taux de marge")} value={marginPercentLabel(totals.margin_percent)} />
      </dl>

      {hasCostGap(margin.quality) ? (
        <p role="alert" className="rounded-sm border border-gold-deep p-3 text-sm text-ink">
          {margin.quality.uncosted_lines} {tr("ligne(s) vendue(s), soit")} {xof(margin.quality.uncosted_revenue)}{" "}
          {tr(
            "de chiffre d'affaires HT, n'ont aucun coût enregistré (produit jamais acheté par le module Achats) : la marge affichée est surestimée d'autant.",
          )}
        </p>
      ) : null}

      {margin.by_product.length === 0 ? (
        <p className="text-sm text-ink-soft">{tr("Aucune vente en propre livrée sur la période.")}</p>
      ) : (
        <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
          <DataTable
<<<<<<< HEAD
  name="marge-TechLium"
=======
  name="marge-TechniLium"
>>>>>>> 0376d01425630b79cfcc80c036cb7a4206e89841
  rows={margin.by_product}
  headers={[tr("Produit"), tr("Unités"), tr("CA HT"), tr("Coût"), tr("Marge"), tr("Taux")]}
  renderRow={(row) => (
                <tr key={row.offer_id} className="border-b border-line">
                  <td className="py-2 pr-4 text-ink">{row.product}</td>
                  <td className="py-2 pr-4 text-right text-ink-soft">{row.units}</td>
                  <td className="py-2 pr-4 text-right text-ink-soft">{xof(row.revenue)}</td>
                  <td className="py-2 pr-4 text-right text-ink-soft">{xof(row.cost)}</td>
                  <td className={`py-2 pr-4 text-right ${row.margin < 0 ? "text-danger" : "text-ink"}`}>
                    {xof(row.margin)}
                  </td>
                  <td className="py-2 text-right text-ink-soft">{marginPercentLabel(row.margin_percent)}</td>
                </tr>
              )}
/>
        </div>
      )}

      <p className="text-xs text-ink-soft">
        {tr("Retours sur la période (non déduits ci-dessus) :")} {xof(margin.returns.refunded_ttc)}{" "}
        {tr("remboursés TTC,")} {xof(margin.returns.cost_given_back)} {tr("de coût repris. Montants hors TVA à")}{" "}
        {margin.vat_percent} {tr("%, remises comprises, ventes de vendeurs tiers et commissions exclues.")}
      </p>
    </section>
  );
}
