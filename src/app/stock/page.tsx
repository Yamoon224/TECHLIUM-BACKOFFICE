"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { DataTable } from "@/components/DataTable";
import { useAppearance } from "@/components/AppearanceProvider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/useAuth";
import {
  InventoryError,
  listLowStock,
  listMovements,
  recordMovement,
  type LowStockOffer,
  type StockMovement,
} from "@/lib/inventory";

export default function StockPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lowStock, setLowStock] = useState<LowStockOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    Promise.all([listMovements(token), listLowStock(token)])
      .then(([movementList, lowStockList]) => {
        setMovements(movementList);
        setLowStock(lowStockList);
      })
      .catch((caught) => setError(caught instanceof InventoryError ? caught.message : tr("Stock indisponible.")))
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

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder au stock.")}</p>
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
        <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Stock")}</h1>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <NewMovementForm
          onSubmit={async (input) => {
            if (!token) return;
            const created = await recordMovement(token, input);
            setMovements((current) => [created, ...current]);
            refresh();
          }}
        />

        <section className="flex flex-col gap-3">
          <h2 className="section-title font-display text-lg font-semibold text-ink">{tr("Stock faible")}</h2>
          {loading ? (
            <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
          ) : lowStock.length === 0 ? (
            <p className="text-sm text-ink-soft">{tr("Aucune offre en stock faible.")}</p>
          ) : (
            <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
              <DataTable
  name="stock-faible"
  rows={lowStock}
  headers={[tr("Produit"), tr("SKU"), tr("Stock")]}
  renderRow={(offer) => (
                    <tr key={offer.offer_id} className="border-b border-line">
                      <td className="py-3 pr-4 text-ink">
                        {offer.brand} {offer.product_name}
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{offer.sku}</td>
                      <td className="py-3 text-danger">{offer.stock_quantity}</td>
                    </tr>
                  )}
/>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="section-title font-display text-lg font-semibold text-ink">{tr("Historique des mouvements")}</h2>
          {loading ? (
            <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-ink-soft">{tr("Aucun mouvement enregistré.")}</p>
          ) : (
            <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
              <DataTable
  name="mouvements-de-stock"
  rows={movements}
  headers={[tr("Offre"), tr("Variation"), tr("Stock après"), tr("Motif")]}
  renderRow={(movement) => (
                    <tr key={movement.id} className="border-b border-line">
                      <td className="py-3 pr-4 text-ink-soft">#{movement.offer_id}</td>
                      <td className={`py-3 pr-4 ${movement.quantity_delta >= 0 ? "text-gold" : "text-danger"}`}>
                        {movement.quantity_delta > 0 ? "+" : ""}
                        {movement.quantity_delta}
                      </td>
                      <td className="py-3 pr-4 text-ink">{movement.quantity_after}</td>
                      <td className="py-3 text-ink-soft">{movement.reason ?? "-"}</td>
                    </tr>
                  )}
/>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function NewMovementForm({
  onSubmit,
}: {
  onSubmit: (input: { offer_id: number; quantity_delta: number; reason?: string }) => Promise<void>;
}) {
  const { tr } = useAppearance();
  const [offerId, setOfferId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!offerId || !delta) {
      setFormError(tr("L'offre et la variation sont requises."));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ offer_id: Number(offerId), quantity_delta: Number(delta), reason: reason || undefined });
      setOfferId("");
      setDelta("");
      setReason("");
    } catch (caught) {
      setFormError(caught instanceof InventoryError ? caught.message : tr("Enregistrement impossible."));
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
          placeholder="15"
          type="number"
          value={offerId}
          onChange={(event) => setOfferId(event.target.value)}
          className="w-24 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
        <span className="field-label">{tr("ID offre")}</span>
      </label>

      <label className="field">
        <input
          type="number"
          value={delta}
          onChange={(event) => setDelta(event.target.value)}
          placeholder={tr("+20 ou -5")}
          className="w-28 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
        <span className="field-label">{tr("Variation (+/-)")}</span>
      </label>

      <label className="field">
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={tr("Réception fournisseur, casse…")}
          className="w-56 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
        <span className="field-label">{tr("Motif")}</span>
      </label>

      <Button type="submit" disabled={submitting}>
        <ActionLabel text={tr("Enregistrer")} />
      </Button>

      {formError ? <p className="w-full text-sm text-danger">{formError}</p> : null}
    </form>
  );
}
