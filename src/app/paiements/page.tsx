"use client";

import { SearchSelect } from "@/components/SearchSelect";
import { ActionLabel } from "@/components/ActionLabel";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/Modal";
import { useAppearance } from "@/components/AppearanceProvider";
import { receiptFilename, savePdf, withLanguage } from "@/lib/download";
import { useCallback, useEffect, useState } from "react";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/useAuth";
import { parseOptionalAmount } from "@/lib/input";
import {
  PaymentsError,
  confirmPayment,
  failPayment,
  recordPayment,
  refundPayment,
  listPayments,
  type MobileMoneyProvider,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/payments";

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "En attente",
  completed: "Confirmé",
  failed: "Échoué",
  refunded: "Remboursé",
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Espèces",
  cod: "Paiement à la livraison",
  mobile_money: "Mobile money",
};

export default function PaymentsPage() {
  const { tr, trf, appearance } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listPayments(token, { status: filter ?? undefined, from: dateFrom || undefined, to: dateTo || undefined })
      .then(setPayments)
      .catch((caught) => setError(caught instanceof PaymentsError ? caught.message : tr("Paiements indisponibles.")))
      .finally(() => setLoading(false));
  }, [token, filter, dateFrom, dateTo, tr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function handleAction(id: number, action: "confirm" | "fail" | "refund") {
    if (!token) return;
    setPendingId(id);
    setError(null);
    try {
      let updated: Payment;
      if (action === "refund") {
        const current = payments.find((payment) => payment.id === id);
        const raw = window.prompt(
          trf("Montant à rembourser (reste remboursable : {left}). Laisser vide pour tout rembourser.", { left: current?.refundable_amount ?? "?" }),
        );
        if (raw === null) return;
        const amount = parseOptionalAmount(raw);
        if (amount === null) {
          setError(tr("Montant invalide : saisissez un entier positif."));
          return;
        }
        updated = await refundPayment(token, id, amount);
      } else {
        updated = await (action === "confirm" ? confirmPayment : failPayment)(token, id);
      }
      setPayments((current) => current.map((payment) => (payment.id === id ? updated : payment)));
    } catch (caught) {
      setError(caught instanceof PaymentsError ? caught.message : tr("L'action a échoué."));
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
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux paiements.")}</p>
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
        <div className="flex items-center justify-between">
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Paiements")}</h1>
          <Button onClick={() => setShowNew(true)}><ActionLabel text={tr("Nouveau paiement")} /></Button>
        </div>

        {showNew ? (
          <NewPaymentForm
            onClose={() => setShowNew(false)}
            onSubmit={async (input) => {
              if (!token) return;
              const created = await recordPayment(token, input);
              setPayments((current) => [created, ...current]);
            }}
          />
        ) : null}

        <nav className="flex flex-wrap gap-2">
          <FilterPill active={filter === null} onClick={() => setFilter(null)}>
            {tr("Tous")}
          </FilterPill>
          {(["pending", "completed", "failed", "refunded"] as const).map((value) => (
            <FilterPill key={value} active={filter === value} onClick={() => setFilter(value)}>
              {tr(STATUS_LABEL[value])}
            </FilterPill>
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

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucun paiement.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="paiements"
  rows={payments}
  headers={[tr("Commande"), tr("Date"), tr("Méthode"), tr("Montant"), tr("Référence"), tr("Statut"), tr("Action")]}
  actionColumns={[6]}
  renderRow={(payment) => (
                  <tr key={payment.id} className="border-b border-line">
                    <td className="py-3 pr-4 text-ink">{payment.order_number}</td>
                    <td className="py-3 pr-4 text-ink-soft">{(payment.paid_at ?? payment.created_at) ? new Date((payment.paid_at ?? payment.created_at) as string).toLocaleString("fr-FR") : "-"}</td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {tr(METHOD_LABEL[payment.method])}
                      {payment.provider ? ` (${payment.provider})` : ""}
                    </td>
                    <td className="py-3 pr-4 text-ink">
                      {payment.amount_amount.toLocaleString("fr-FR")} {payment.currency}
                      {payment.refunded_amount > 0 ? (
                        <span className="block text-xs text-ink-soft">
                          {tr("dont remboursé :")} {payment.refunded_amount.toLocaleString("fr-FR")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{payment.provider_reference ?? "-"}</td>
                    <td className="py-3 pr-4 text-ink-soft">{tr(STATUS_LABEL[payment.status])}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {payment.status === "pending" || payment.status === "failed" ? (
                          <button
                            type="button"
                            disabled={pendingId === payment.id}
                            onClick={() => handleAction(payment.id, "confirm")}
                            className="rounded-sm border border-gold px-2 py-1 text-xs text-gold transition-colors disabled:opacity-50"
                          >
                            <ActionLabel text={tr("Confirmer")} />
                          </button>
                        ) : null}
                        {payment.status === "pending" ? (
                          <button
                            type="button"
                            disabled={pendingId === payment.id}
                            onClick={() => handleAction(payment.id, "fail")}
                            className="rounded-sm border border-danger px-2 py-1 text-xs text-danger transition-colors disabled:opacity-50"
                          >
                            <ActionLabel text={tr("Marquer échoué")} />
                          </button>
                        ) : null}
                        {payment.status === "completed" || payment.status === "refunded" ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!token) return;
                              setError(null);
                              savePdf(token, withLanguage(`/admin/payments/${payment.id}/receipt`, appearance.language), receiptFilename(payment.id)).catch((caught) =>
                                setError(caught instanceof Error ? caught.message : tr("Le PDF n'a pas pu être téléchargé.")),
                              );
                            }}
                            className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                          >
                            <ActionLabel text={tr("Reçu")} />
                          </button>
                        ) : null}
                        {payment.status === "completed" && payment.refundable_amount > 0 ? (
                          <button
                            type="button"
                            disabled={pendingId === payment.id}
                            onClick={() => handleAction(payment.id, "refund")}
                            className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors disabled:opacity-50"
                          >
                            <ActionLabel text={tr("Rembourser")} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )}
/>
          </div>
        )}
      </main>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active ? "border-gold bg-gold text-on-primary font-medium" : "border-line text-ink hover:border-gold"
      }`}
    >
      {children}
    </button>
  );
}

function NewPaymentForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: {
    order_number: string;
    method: PaymentMethod;
    amount_amount: number;
    provider?: MobileMoneyProvider;
    provider_reference?: string;
  }) => Promise<void>;
}) {
  const { tr } = useAppearance();
  const [orderNumber, setOrderNumber] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState<MobileMoneyProvider>("orange_money");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit() {
    setFormError(null);

    if (!orderNumber || !amount) {
      setFormError(tr("La commande et le montant sont requis."));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        order_number: orderNumber,
        method,
        amount_amount: Number(amount),
        provider: method === "mobile_money" ? provider : undefined,
        provider_reference: reference || undefined,
      });
      onClose();
    } catch (caught) {
      setFormError(caught instanceof PaymentsError ? caught.message : tr("Enregistrement impossible."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      open
      size="md"
      title={tr("Nouveau paiement")}
      onClose={onClose}
      submitLabel={tr("Enregistrer")}
      submitting={submitting}
      error={formError}
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder={tr("TCH-20261025-XXXXXX")} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
          <span className="field-label">{tr("N° commande")}</span>
        </label>

        <label className="field">
          <SearchSelect value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink">
            <option value="cash">{tr("Espèces")}</option>
            <option value="cod">{tr("Paiement à la livraison")}</option>
            <option value="mobile_money">{tr("Mobile money")}</option>
          </SearchSelect>
          <span className="field-label">{tr("Méthode")}</span>
        </label>

        {method === "mobile_money" ? (
          <>
            <label className="field">
              <SearchSelect value={provider} onChange={(event) => setProvider(event.target.value as MobileMoneyProvider)} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink">
                <option value="orange_money">{tr("Orange Money")}</option>
                <option value="mtn_money">{tr("MTN Money")}</option>
                <option value="wave">{tr("Wave")}</option>
              </SearchSelect>
              <span className="field-label">{tr("Opérateur")}</span>
            </label>

            <label className="field">
              <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={tr("MM-12345678")} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
              <span className="field-label">{tr("Référence transaction")}</span>
            </label>
          </>
        ) : null}

        <label className="field">
          <input placeholder="118000" type="number" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
          <span className="field-label">{tr("Montant (F CFA)")}</span>
        </label>
      </div>
    </FormModal>
  );
}
