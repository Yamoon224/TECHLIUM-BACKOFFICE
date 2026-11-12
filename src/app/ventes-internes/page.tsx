"use client";

import { SearchSelect } from "@/components/SearchSelect";
import { ActionLabel } from "@/components/ActionLabel";
import { Fragment, useCallback, useEffect, useState } from "react";
import { DateRangeFilter, inDateRange } from "@/components/DateRangeFilter";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { DataTable } from "@/components/DataTable";
import { useAppearance } from "@/components/AppearanceProvider";
import { openPdf, savePdf, withLanguage } from "@/lib/download";
import {
  InternalSalesError,
  addToCart,
  cancelInternalSale,
  cartTotal,
  changeDue,
  closeTill,
  closingPdfPath,
  currentTill,
  formatVariance,
  listClosings,
  listInternalSales,
  tillVariance,
  recordInternalSale,
  saleReceiptPath,
  searchSellableOffers,
  setQuantity,
  type CartLine,
  type CashClosing,
  type ReceiptFormat,
  type TillPeriod,
  type InternalSale,
  type MobileMoneyProvider,
  type SaleMethod,
  type SellableOffer,
} from "@/lib/internalSales";
import { parseOptionalAmount } from "@/lib/input";
import { useAuth } from "@/lib/useAuth";

const CURRENCY_LABEL = "F CFA";

const money = (amount: number) => `${amount.toLocaleString("fr-FR")} ${CURRENCY_LABEL}`;

export default function InternalSalesPage() {
  const { tr, appearance } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();

  const [sales, setSales] = useState<InternalSale[]>([]);
  const [details, setDetails] = useState<InternalSale | null>(null);
  const [saleFilter, setSaleFilter] = useState<"all" | "valid" | "cancelled">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SellableOffer[]>([]);
  const [searching, setSearching] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [method, setMethod] = useState<SaleMethod>("cash");
  const [provider, setProvider] = useState<MobileMoneyProvider>("orange_money");
  const [reference, setReference] = useState("");
  const [tendered, setTendered] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<InternalSale | null>(null);
  const [till, setTill] = useState<TillPeriod | null>(null);
  const [closings, setClosings] = useState<CashClosing[]>([]);
  const [counted, setCounted] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [closing, setClosing] = useState(false);

  const refresh = useCallback(() => {
    if (!token) return;

    currentTill(token).then(setTill).catch(() => undefined);
    listClosings(token).then(setClosings).catch(() => undefined);

    listInternalSales(token)
      .then(setSales)
      .catch((caught) => setError(caught instanceof InternalSalesError ? caught.message : tr("Ventes indisponibles.")));
  }, [token, tr]);

  const visibleSales = sales.filter(
    (sale) =>
      inDateRange(sale.created_at, dateFrom, dateTo) &&
      (saleFilter === "all" || (saleFilter === "cancelled") === (sale.cancelled_at !== null)),
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (search.trim() === "") return;

    setSearching(true);
    setError(null);
    try {
      setResults(await searchSellableOffers(search.trim()));
    } catch (caught) {
      setError(caught instanceof InternalSalesError ? caught.message : tr("Recherche impossible."));
    } finally {
      setSearching(false);
    }
  }

  function showError(caught: unknown) {
    setError(caught instanceof Error ? caught.message : tr("Le PDF n'a pas pu être téléchargé."));
  }

  /** The A5 receipt is saved; the 80 mm ticket opens in a tab, ready to print on the roll. */
  function receipt(sale: InternalSale, format: ReceiptFormat = "a5") {
    if (!token) return;
    setError(null);
    const path = withLanguage(saleReceiptPath(sale.order_number, format), appearance.language);

    if (format === "ticket") {
      openPdf(token, path).catch(showError);
      return;
    }

    savePdf(token, path, `${sale.payment?.receipt_number ?? sale.order_number}.pdf`).catch(showError);
  }

  async function handleCancel(sale: InternalSale) {
    if (!token) return;
    const reason = window.prompt(tr("Motif de l'annulation (la vente sera intégralement remboursée) :"));
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setError(tr("Indiquez un motif d'au moins 3 caractères."));
      return;
    }

    setError(null);
    try {
      const updated = await cancelInternalSale(token, sale.order_number, reason.trim());
      setSales((current) => current.map((row) => (row.order_number === updated.order_number ? updated : row)));
      setCompleted((current) => (current?.order_number === updated.order_number ? updated : current));
      refresh();
    } catch (caught) {
      setError(caught instanceof InternalSalesError ? caught.message : tr("L'annulation a échoué."));
    }
  }

  const countedAmount = counted.trim() === "" ? null : /^\d+$/.test(counted.trim()) ? Number(counted.trim()) : null;

  async function handleClose(event: React.FormEvent) {
    event.preventDefault();
    if (!token || countedAmount === null) {
      setError(tr("Saisissez les espèces comptées (nombre entier)."));
      return;
    }

    setError(null);
    setClosing(true);
    try {
      const closed = await closeTill(token, countedAmount, closingNote.trim() || undefined);
      setCounted("");
      setClosingNote("");
      refresh();
      savePdf(token, withLanguage(closingPdfPath(closed.id), appearance.language), `${closed.number}.pdf`).catch(showError);
    } catch (caught) {
      setError(caught instanceof InternalSalesError ? caught.message : tr("La clôture a échoué."));
    } finally {
      setClosing(false);
    }
  }

  const total = cartTotal(cart);
  const tenderedAmount = parseOptionalAmount(tendered);
  const change = method === "cash" && typeof tenderedAmount === "number" ? changeDue(total, tenderedAmount) : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);

    if (cart.length === 0) {
      setError(tr("Ajoutez au moins un article."));
      return;
    }

    if (tenderedAmount === null) {
      setError(tr("Montant invalide : saisissez un entier positif."));
      return;
    }

    if (method === "cash" && tenderedAmount !== undefined && change === null) {
      setError(tr("Les espèces remises ne couvrent pas le total."));
      return;
    }

    setSubmitting(true);
    try {
      const sale = await recordInternalSale(token, {
        items: cart.map((line) => ({ offer_id: line.offer.offerId, quantity: line.quantity })),
        method,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        customer_email: customerEmail.trim() || undefined,
        coupon_code: couponCode.trim() || undefined,
        provider: method === "mobile_money" ? provider : undefined,
        provider_reference: method === "mobile_money" ? reference.trim() || undefined : undefined,
        tendered_amount: method === "cash" ? tenderedAmount : undefined,
        locale: appearance.language,
      });
      setCompleted(sale);
      setSales((current) => [sale, ...current]);
      resetSale();
    } catch (caught) {
      setError(caught instanceof InternalSalesError ? caught.message : tr("L'enregistrement de la vente a échoué."));
    } finally {
      setSubmitting(false);
    }
  }

  function resetSale() {
    setCart([]);
    setResults([]);
    setSearch("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCouponCode("");
    setReference("");
    setTendered("");
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux ventes internes.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Ventes internes")}</h1>
        <p className="text-sm text-ink-soft">
          {tr("Une vente au comptoir est une vraie commande : stock, facture et comptabilité suivent, et un reçu de paiement est délivré à la fin.")}
        </p>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {completed ? (
          <section className="flex flex-col gap-3 rounded-sm border border-line bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <h2 className="font-display text-lg font-semibold text-ink">{tr("Vente enregistrée")}</h2>
            <p className="text-sm text-ink">
              {tr("Commande")} {completed.order_number} - {money(completed.total_amount)}
              {completed.payment ? ` - ${tr("N° de reçu")} ${completed.payment.receipt_number}` : ""}
            </p>
            {completed.payment?.change_amount != null && completed.payment.change_amount > 0 ? (
              <p className="text-lg font-semibold text-ink">
                {tr("Monnaie à rendre :")} {money(completed.payment.change_amount)}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => receipt(completed)}>
                <ActionLabel text={tr("Télécharger le reçu (PDF)")} />
              </Button>
              <Button type="button" variant="secondary" onClick={() => receipt(completed, "ticket")}>
                <ActionLabel text={tr("Ticket 80 mm")} />
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCompleted(null)}>
                <ActionLabel text={tr("Nouvelle vente")} />
              </Button>
            </div>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* The found articles scroll inside their card: on large screens its height follows the basket's card
                (h-0 + min-h-full takes no part in sizing the row), so a long result list never stretches it. */}
            <section className="flex flex-col gap-4 rounded-sm border border-line bg-surface p-4 shadow-card border-b-4 border-b-gold lg:h-0 lg:min-h-full">
              <h2 className="font-display text-lg font-semibold text-ink">{tr("Articles")}</h2>

              <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
                <label className="field">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={tr("Galaxy A15")}
                    className="w-64 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                  <span className="field-label">{tr("Rechercher un produit")}</span>
                </label>
                <Button type="submit" variant="secondary" disabled={searching}>
                  <ActionLabel text={tr("Rechercher")} />
                </Button>
              </form>

              {results.length > 0 ? (
                <ul className="flex max-h-96 min-h-0 flex-col divide-y divide-line overflow-y-auto rounded-sm border border-line lg:max-h-none lg:flex-1">
                  {results.map((offer) => (
                    <li key={offer.offerId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="text-ink">
                        {offer.label}
                        <span className="block text-xs text-ink-soft">
                          {money(offer.unitPrice)} · {tr("Stock")} {offer.stock}
                        </span>
                      </span>
                      <Button type="button" variant="secondary" onClick={() => setCart((current) => addToCart(current, offer))}>
                        <ActionLabel text={tr("Ajouter")} />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : searching ? null : search.trim() !== "" ? (
                <p className="text-sm text-ink-soft">{tr("Aucun article en stock TechLium pour cette recherche.")}</p>
              ) : null}
            </section>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-sm border border-line bg-surface p-4 shadow-card border-b-4 border-b-gold lg:min-h-[28rem]">
              <h2 className="font-display text-lg font-semibold text-ink">{tr("Panier")}</h2>

              {cart.length === 0 ? (
                <p className="text-sm text-ink-soft">{tr("Le panier est vide.")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {cart.map((line) => (
                    <li key={line.offer.offerId} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-ink">{line.offer.label}</span>
                      <span className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={line.offer.stock}
                          value={line.quantity}
                          onChange={(event) => setCart((current) => setQuantity(current, line.offer.offerId, Number(event.target.value)))}
                          className="w-16 rounded-sm border border-line bg-surface px-2 py-1 text-sm text-ink"
                          aria-label={tr("Quantité")}
                        />
                        <span className="w-28 text-right text-ink">{money(line.offer.unitPrice * line.quantity)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-right text-lg font-semibold text-ink">
                {tr("Total")} : {money(total)}
              </p>

              <div className="flex flex-wrap gap-3">
                <label className="field">
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder={tr("Client comptoir")}
                    className="w-52 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                  <span className="field-label">{tr("Nom du client (facultatif)")}</span>
                </label>
                <label className="field">
                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="0700000000"
                    className="w-40 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                  <span className="field-label">{tr("Téléphone (facultatif)")}</span>
                </label>
                <label className="field">
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    placeholder="client@exemple.com"
                    className="w-52 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                  <span className="field-label">{tr("E-mail (facultatif)")}</span>
                </label>
                <label className="field">
                  <input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                    placeholder="BIENVENUE10"
                    className="w-36 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                  <span className="field-label">{tr("Code promo")}</span>
                </label>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <label className="field">
                  <SearchSelect
                    value={method}
                    onChange={(event) => setMethod(event.target.value as SaleMethod)}
                    className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
                  >
                    <option value="cash">{tr("Espèces")}</option>
                    <option value="mobile_money">{tr("Mobile money")}</option>
                  </SearchSelect>
                  <span className="field-label">{tr("Mode de paiement")}</span>
                </label>

                {method === "cash" ? (
                  <label className="field">
                    <input
                      type="number"
                      min={0}
                      value={tendered}
                      onChange={(event) => setTendered(event.target.value)}
                      placeholder="150000"
                      className="w-36 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
                    />
                    <span className="field-label">{tr("Espèces remises (F CFA)")}</span>
                  </label>
                ) : (
                  <>
                    <label className="field">
                      <SearchSelect
                        value={provider}
                        onChange={(event) => setProvider(event.target.value as MobileMoneyProvider)}
                        className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
                      >
                        <option value="orange_money">{tr("Orange Money")}</option>
                        <option value="mtn_money">{tr("MTN Money")}</option>
                        <option value="wave">{tr("Wave")}</option>
                      </SearchSelect>
                      <span className="field-label">{tr("Opérateur")}</span>
                    </label>
                    <label className="field">
                      <input
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        placeholder={tr("MM-12345678")}
                        className="w-40 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
                      />
                      <span className="field-label">{tr("Référence transaction")}</span>
                    </label>
                  </>
                )}
              </div>

              {method === "cash" && change !== null && tendered !== "" ? (
                <p className="text-sm text-ink">
                  {tr("Monnaie à rendre :")} <strong>{money(change)}</strong>
                </p>
              ) : null}

              <div>
                <Button type="submit" disabled={submitting || cart.length === 0}>
                  <ActionLabel text={tr("Encaisser et délivrer le reçu")} />
                </Button>
              </div>
            </form>
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-sm border border-line bg-surface p-4 shadow-card border-b-4 border-b-gold">
          <h2 className="font-display text-lg font-semibold text-ink">{tr("Clôture de caisse")}</h2>
          {till && (till.sales_count > 0 || till.cancellations_count > 0) ? (
            <>
              <ul className="grid gap-1 text-sm text-ink sm:grid-cols-2">
                <li>{tr("Ventes")} : {till.sales_count}</li>
                <li>{tr("Annulations")} : {till.cancellations_count}</li>
                <li>{tr("Ventes en espèces")} : {money(till.cash_sales)}</li>
                <li>{tr("Espèces remboursées")} : {money(till.cash_refunds)}</li>
                <li className="font-semibold">{tr("Espèces attendues en caisse")} : {money(till.expected_cash)}</li>
                <li>{tr("Mobile money (net)")} : {money(till.mobile_money_net)}</li>
              </ul>
              <form onSubmit={handleClose} className="flex flex-wrap items-end gap-3">
                <label className="field">
                  <input
                    type="number"
                    min={0}
                    value={counted}
                    onChange={(event) => setCounted(event.target.value)}
                    placeholder={String(Math.max(0, till.expected_cash))}
                    className="w-40 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                  <span className="field-label">{tr("Espèces comptées (F CFA)")}</span>
                </label>
                <label className="field">
                  <input
                    value={closingNote}
                    onChange={(event) => setClosingNote(event.target.value)}
                    placeholder={tr("Billet de 1 000 manquant")}
                    className="w-64 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                  <span className="field-label">{tr("Note (facultatif)")}</span>
                </label>
                <Button type="submit" disabled={closing}>
                  <ActionLabel text={tr("Clôturer la caisse")} />
                </Button>
              </form>
              {countedAmount !== null ? (
                <p className="text-sm text-ink">
                  {tr("Écart :")} <strong>{formatVariance(tillVariance(till.expected_cash, countedAmount))}</strong> {CURRENCY_LABEL}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ink-soft">{tr("Rien à clôturer : aucune vente depuis la dernière clôture.")}</p>
          )}

          {closings.length > 0 ? (
            <div className="overflow-x-auto">
              <DataTable
                name="clotures-caisse"
                rows={closings}
                headers={[tr("N°"), tr("Date"), tr("Caissier"), tr("Attendu"), tr("Compté"), tr("Écart"), tr("Action")]}
                actionColumns={[6]}
                renderRow={(row) => (
                  <tr key={row.id} className="border-b border-line">
                    <td className="py-3 pr-4 text-ink">{row.number}</td>
                    <td className="py-3 pr-4 text-ink-soft">{new Date(row.closed_at).toLocaleString(appearance.language === "en" ? "en-GB" : "fr-FR")}</td>
                    <td className="py-3 pr-4 text-ink-soft">{row.user_name}</td>
                    <td className="py-3 pr-4 text-ink">{money(row.expected_cash)}</td>
                    <td className="py-3 pr-4 text-ink">{money(row.counted_cash)}</td>
                    <td className={`py-3 pr-4 ${row.variance === 0 ? "text-ink-soft" : "text-danger"}`}>{formatVariance(row.variance)}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => token && savePdf(token, withLanguage(closingPdfPath(row.id), appearance.language), `${row.number}.pdf`).catch(showError)}
                        className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                      >
                        <ActionLabel text={tr("Rapport PDF")} />
                      </button>
                    </td>
                  </tr>
                )}
              />
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">{tr("Dernières ventes internes")}</h2>
          <nav className="flex flex-wrap gap-2">
            {([["all", "Toutes"], ["valid", "Validées"], ["cancelled", "Annulées"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSaleFilter(value)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  saleFilter === value ? "border-gold bg-gold text-on-primary font-medium" : "border-line text-ink hover:border-gold"
                }`}
              >
                {tr(label)}
              </button>
            ))}
          </nav>
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            onChange={(range) => {
              setDateFrom(range.from);
              setDateTo(range.to);
            }}
          />
          {visibleSales.length === 0 ? (
            <p className="text-sm text-ink-soft">{tr("Aucune vente interne.")}</p>
          ) : (
            <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
              <DataTable
                name="ventes-internes"
                rows={visibleSales}
                headers={[tr("Commande"), tr("Date"), tr("Client"), tr("Total"), tr("Paiement"), tr("N° de reçu"), tr("Action")]}
                actionColumns={[6]}
                renderRow={(sale) => (
                  <tr key={sale.order_number} className="border-b border-line">
                    <td className="py-3 pr-4 text-ink">{sale.order_number}</td>
                    <td className="py-3 pr-4 text-ink-soft">{sale.created_at ? new Date(sale.created_at).toLocaleString("fr-FR") : "-"}</td>
                    <td className="py-3 pr-4 text-ink-soft">{sale.customer_name}</td>
                    <td className="py-3 pr-4 text-ink">{money(sale.total_amount)}</td>
                    <td className="py-3 pr-4 text-ink-soft">{sale.payment?.method === "mobile_money" ? tr("Mobile money") : tr("Espèces")}</td>
                    <td className="py-3 pr-4 text-ink-soft">{sale.payment?.receipt_number ?? "-"}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setDetails(sale)}
                          className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                        >
                          <ActionLabel text={tr("Détails")} />
                        </button>
                        {sale.payment ? (
                          <>
                            <button
                              type="button"
                              onClick={() => receipt(sale)}
                              className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                            >
                              <ActionLabel text={tr("Reçu de paiement")} />
                            </button>
                            <button
                              type="button"
                              onClick={() => receipt(sale, "ticket")}
                              className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                            >
                              <ActionLabel text={tr("Ticket 80 mm")} />
                            </button>
                          </>
                        ) : null}
                        {sale.cancelled_at ? (
                          <span className="px-2 py-1 text-xs text-danger" title={sale.cancel_reason ?? undefined}>
                            {tr("Annulée")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCancel(sale)}
                            className="rounded-sm border border-danger px-2 py-1 text-xs text-danger transition-colors"
                          >
                            <ActionLabel text={tr("Annuler la vente")} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              />
            </div>
          )}
        </section>
      </main>

      <Modal
        open={details !== null}
        title={details ? `${tr("Vente")} ${details.order_number}` : ""}
        onClose={() => setDetails(null)}
        footer={
          <Button type="button" variant="secondary" onClick={() => setDetails(null)}>
            <ActionLabel text={tr("Fermer")} />
          </Button>
        }
      >
        {details ? <SaleDetails sale={details} /> : null}
      </Modal>
    </div>
  );
}

function SaleDetails({ sale }: { sale: InternalSale }) {
  const { tr } = useAppearance();
  const payment = sale.payment;
  const rows: [string, string][] = [
    [tr("Statut"), sale.cancelled_at ? tr("Annulée") : tr("Payée")],
    [tr("Client"), [sale.customer_name, sale.customer_phone].filter(Boolean).join(" - ") || "-"],
    [tr("Date"), sale.created_at ? new Date(sale.created_at).toLocaleString("fr-FR") : "-"],
    [tr("Paiement"), payment?.method === "mobile_money" ? tr("Mobile money") : tr("Espèces")],
  ];
  if (payment?.provider) rows.push([tr("Opérateur"), payment.provider]);
  if (payment) rows.push([tr("N° de reçu"), payment.receipt_number]);
  if (payment?.tendered_amount != null) rows.push([tr("Montant remis"), money(payment.tendered_amount)]);
  if (payment?.change_amount != null) rows.push([tr("Monnaie rendue"), money(payment.change_amount)]);
  if (sale.cancelled_at) {
    rows.push([tr("Annulée le"), new Date(sale.cancelled_at).toLocaleString("fr-FR")]);
    if (sale.cancel_reason) rows.push([tr("Motif"), sale.cancel_reason]);
  }

  return (
    <div className="grid gap-4 text-sm">
      <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-ink-soft">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </Fragment>
        ))}
      </dl>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line text-xs text-ink-soft">
            <th className="py-1 pr-2 font-medium">{tr("Produit")}</th>
            <th className="py-1 pr-2 font-medium">{tr("Qté")}</th>
            <th className="py-1 pr-2 font-medium">{tr("Prix unitaire")}</th>
            <th className="py-1 text-right font-medium">{tr("Total")}</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((line, index) => (
            <tr key={`${line.description}-${index}`} className="border-b border-line">
              <td className="py-1 pr-2 text-ink">{line.description}</td>
              <td className="py-1 pr-2 text-ink">{line.quantity}</td>
              <td className="py-1 pr-2 text-ink">{money(line.unit_price_amount)}</td>
              <td className="py-1 text-right text-ink">{money(line.line_total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-right font-medium text-ink">
        {tr("Total")} : {money(sale.total_amount)}
        {sale.discount_amount > 0 ? ` (${tr("Remise")} ${money(sale.discount_amount)}${sale.coupon_code ? `, ${sale.coupon_code}` : ""})` : ""}
      </p>
    </div>
  );
}
