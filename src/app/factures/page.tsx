"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { QrLink } from "@/components/QrLink";
import { DataTable } from "@/components/DataTable";
import { useAppearance } from "@/components/AppearanceProvider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/useAuth";
import {
  INVOICE_TYPE_LABEL,
  downloadInvoicePdf,
  InvoicingError,
  isCreditable,
  issueCreditNote,
  issueInvoice,
  listInvoices,
  type Invoice,
} from "@/lib/invoicing";
import { formatMoney } from "@/lib/money";

export default function InvoicesPage() {
  const { tr, trf } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listInvoices(token)
      .then(setInvoices)
      .catch((caught) => setError(caught instanceof InvoicingError ? caught.message : tr("Factures indisponibles.")))
      .finally(() => setLoading(false));
  }, [token, tr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function handleDownload(invoice: Invoice) {
    if (!token) return;
    setError(null);
    try {
      await downloadInvoicePdf(token, invoice);
    } catch (caught) {
      setError(caught instanceof InvoicingError ? caught.message : tr("Le PDF n'a pas pu être téléchargé."));
    }
  }

  async function handleCredit(invoice: Invoice) {
    if (!token) return;
    const reason = window.prompt(trf("Motif de l'avoir pour {number} ?", { number: invoice.number }));
    if (!reason) return;

    setPendingId(invoice.id);
    setError(null);
    try {
      await issueCreditNote(token, invoice.id, reason);
      refresh();
    } catch (caught) {
      setError(caught instanceof InvoicingError ? caught.message : tr("L'avoir n'a pas pu être émis."));
    } finally {
      setPendingId(null);
    }
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux factures.")}</p>
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
        <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Factures et avoirs")}</h1>

        <NewInvoiceForm
          onSubmit={async (orderNumber) => {
            if (!token) return;
            await issueInvoice(token, orderNumber);
            refresh();
          }}
        />

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucun document.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="factures"
  rows={invoices}
  headers={[tr("Numéro"), tr("Type"), tr("Commande"), tr("Client"), tr("HT"), tr("TVA"), tr("TTC"), tr("Action")]}
  actionColumns={[7]}
  renderRow={(invoice) => {
                  const money = (amount: number) => formatMoney({ amount, currency: invoice.currency });
                  return (
                    <tr key={invoice.id} className="border-b border-line">
                      <td className="py-3 pr-4 text-ink">{invoice.number}</td>
                      <td className="py-3 pr-4 text-ink-soft">
                        {tr(INVOICE_TYPE_LABEL[invoice.type])}
                        {invoice.reason ? ` - ${invoice.reason}` : ""}
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{invoice.order_number}</td>
                      <td className="py-3 pr-4 text-ink-soft">{invoice.customer_name}</td>
                      <td className="py-3 pr-4 text-ink">{money(invoice.net_amount)}</td>
                      <td className="py-3 pr-4 text-ink-soft">
                        {money(invoice.vat_amount)} ({invoice.vat_rate_percent} %)
                      </td>
                      <td className="py-3 pr-4 text-ink">
                        {money(invoice.total_amount)}
                        {invoice.discount_amount > 0 ? (
                          <span className="block text-xs text-ink-soft">
                            {tr("remise")} {money(invoice.discount_amount)}
                            {invoice.coupon_code ? ` (${invoice.coupon_code})` : ""}
                          </span>
                        ) : null}
                      </td>
                      <td className="flex flex-wrap gap-2 py-3">
                        <QrLink kind="invoice" reference={invoice.number} />
                        <button
                          type="button"
                          onClick={() => handleDownload(invoice)}
                          className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                        >
                          <ActionLabel text={tr("PDF")} />
                        </button>
                        {isCreditable(invoice, invoices) ? (
                          <button
                            type="button"
                            disabled={pendingId === invoice.id}
                            onClick={() => handleCredit(invoice)}
                            className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold disabled:opacity-50"
                          >
                            <ActionLabel text={tr("Émettre un avoir")} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                }}
/>
          </div>
        )}
      </main>
    </div>
  );
}

function NewInvoiceForm({ onSubmit }: { onSubmit: (orderNumber: string) => Promise<void> }) {
  const { tr } = useAppearance();
  const [orderNumber, setOrderNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!orderNumber) {
      setFormError(tr("Le numéro de commande est requis."));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(orderNumber);
      setOrderNumber("");
    } catch (caught) {
      setFormError(caught instanceof InvoicingError ? caught.message : tr("Émission impossible."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-sm border border-line p-4 bg-surface shadow-card border-b-4 border-b-gold"
    >
      <label className="field">
        <input
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value)}
          placeholder={tr("TCH-20261025-XXXXXX")}
          className="w-56 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
        <span className="field-label">{tr("N° commande à facturer")}</span>
      </label>

      <Button type="submit" disabled={submitting}>
        <ActionLabel text={tr("Émettre la facture")} />
      </Button>

      {formError ? <p className="w-full text-sm text-danger">{formError}</p> : null}
    </form>
  );
}
