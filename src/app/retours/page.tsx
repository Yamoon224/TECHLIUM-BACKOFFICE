"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/Modal";
import { useAppearance } from "@/components/AppearanceProvider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/useAuth";
import { parseOptionalAmount, parseReturnItems } from "@/lib/input";
import { formatMoney } from "@/lib/money";
import {
  RETURN_ACTION_LABEL,
  RETURN_STATUS_LABEL,
  ReturnsError,
  availableActions,
  decideReturn,
  listReturns,
  openReturn,
  type ReturnAction,
  type ReturnRequest,
  type ReturnStatus,
} from "@/lib/returns";

const FILTERS: ReturnStatus[] = ["requested", "accepted", "received", "refunded", "rejected"];

export default function ReturnsPage() {
  const { tr, trf } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [filter, setFilter] = useState<ReturnStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listReturns(token, { status: filter ?? undefined })
      .then(setReturns)
      .catch((caught) => setError(caught instanceof ReturnsError ? caught.message : tr("Retours indisponibles.")))
      .finally(() => setLoading(false));
  }, [token, filter, tr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function handleAction(item: ReturnRequest, action: ReturnAction) {
    if (!token) return;

    const body: { note?: string; amount?: number; restock?: boolean } = {};

    if (action === "reject") {
      const note = window.prompt(tr("Motif du refus ?"));
      if (!note) return;
      body.note = note;
    }

    if (action === "receive" && item.items.length > 0) {
      // The inspector decides: resellable articles go back on sale, damaged ones do not.
      body.restock = window.confirm(
        tr("Articles revendables en l'état ? OK = remettre en stock, Annuler = ne pas remettre en stock."),
      );
    }

    if (action === "refund") {
      const input = window.prompt(
        trf("Montant à rembourser (demandé : {amount}). Laisser vide pour le montant demandé. Le paiement correspondant est remboursé automatiquement.", { amount: item.requested_amount }),
      );
      if (input === null) return;
      const amount = parseOptionalAmount(input);
      if (amount === null) {
        setError(tr("Montant invalide : saisissez un entier positif."));
        return;
      }
      if (amount !== undefined) body.amount = amount;
    }

    setBusyId(item.id);
    setError(null);
    try {
      await decideReturn(token, item.id, action, body);
      refresh();
    } catch (caught) {
      setError(caught instanceof ReturnsError ? caught.message : tr("L'action a échoué."));
    } finally {
      setBusyId(null);
    }
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux retours.")}</p>
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
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Retours et SAV")}</h1>
          <Button onClick={() => setShowNew(true)}><ActionLabel text={tr("Nouveau retour")} /></Button>
        </div>

        {showNew ? (
          <NewReturnForm
            onClose={() => setShowNew(false)}
            onSubmit={async (input) => {
              if (!token) return;
              await openReturn(token, input);
              refresh();
            }}
          />
        ) : null}

        <nav className="flex flex-wrap gap-2">
          {[null, ...FILTERS].map((value) => (
            <button
              key={value ?? "all"}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                filter === value
                  ? "border-gold bg-gold text-on-primary font-medium"
                  : "border-line text-ink hover:border-gold"
              }`}
            >
              {value === null ? <ActionLabel text={tr("Tous")} /> : RETURN_STATUS_LABEL[value]}
            </button>
          ))}
        </nav>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : returns.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucun retour.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="retours"
  rows={returns}
  headers={[tr("RMA"), tr("Commande"), tr("Motif"), tr("Demandé"), tr("Remboursé"), tr("Statut"), tr("Actions")]}
  actionColumns={[6]}
  renderRow={(item) => {
                  const money = (amount: number) => formatMoney({ amount, currency: item.currency });
                  return (
                    <tr key={item.id} className="border-b border-line">
                      <td className="py-3 pr-4 text-ink">{item.number}</td>
                      <td className="py-3 pr-4 text-ink-soft">{item.order_number}</td>
                      <td className="py-3 pr-4 text-ink-soft">
                        {item.reason}
                        {item.decision_note ? ` - ${item.decision_note}` : ""}
                        {item.items.length > 0 ? (
                          <span className="block text-xs">
                            {item.items.map((line) => `offre ${line.offer_id} × ${line.quantity}`).join(", ")}
                            {item.restocked ? tr(" · remis en stock") : ""}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 text-ink">{money(item.requested_amount)}</td>
                      <td className="py-3 pr-4 text-ink">
                        {item.refunded_amount !== null ? money(item.refunded_amount) : "-"}
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{tr(RETURN_STATUS_LABEL[item.status])}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {availableActions(item.status).map((action) => (
                            <button
                              key={action}
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => handleAction(item, action)}
                              className={`rounded-sm border px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
                                action === "reject"
                                  ? "border-danger text-danger"
                                  : action === "refund"
                                    ? "border-gold text-gold"
                                    : "border-line text-ink hover:border-gold"
                              }`}
                            >
                              {tr(RETURN_ACTION_LABEL[action])}
                            </button>
                          ))}
                        </div>
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

function NewReturnForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: {
    order_number: string;
    reason: string;
    amount?: number;
    items?: { offer_id: number; quantity: number }[];
  }) => Promise<void>;
}) {
  const { tr } = useAppearance();
  const [orderNumber, setOrderNumber] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [articles, setArticles] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit() {
    setFormError(null);

    if (!orderNumber || !reason) {
      setFormError(tr("La commande et le motif sont requis."));
      return;
    }

    const items = parseReturnItems(articles);
    if (items === null) {
      setFormError(
        tr("Articles invalides : saisissez des paires offre:quantité séparées par des virgules (ex. 12:2, 15)."),
      );
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        order_number: orderNumber,
        reason,
        amount: amount ? Number(amount) : undefined,
        items: items.length > 0 ? items : undefined,
      });
      onClose();
    } catch (caught) {
      setFormError(caught instanceof ReturnsError ? caught.message : tr("Ouverture impossible."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      open
      size="md"
      title={tr("Nouveau retour")}
      onClose={onClose}
      submitLabel={tr("Ouvrir le retour")}
      submitting={submitting}
      error={formError}
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder={tr("TCH-20261025-XXXXXX")} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
          <span className="field-label">{tr("N° commande livrée")}</span>
        </label>

        <label className="field">
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={tr("Produit défectueux")} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
          <span className="field-label">{tr("Motif")}</span>
        </label>

        <label className="field">
          <input value={articles} onChange={(event) => setArticles(event.target.value)} placeholder="12:2, 15" className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
          <span className="field-label">{tr("Articles (offre:qté, optionnel)")}</span>
        </label>

        <label className="field">
          <input type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={tr("Total de la commande")} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
          <span className="field-label">{tr("Montant (optionnel)")}</span>
        </label>
      </div>
    </FormModal>
  );
}
