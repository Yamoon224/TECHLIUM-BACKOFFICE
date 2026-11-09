"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { DataTable } from "@/components/DataTable";
import { useAppearance } from "@/components/AppearanceProvider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { useAuth } from "@/lib/useAuth";
import { CatalogError, approveOffer, listOffersForModeration, rejectOffer, type ModeratedOffer } from "@/lib/catalog";

export default function OfferModerationPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [offers, setOffers] = useState<ModeratedOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listOffersForModeration(token)
      .then(setOffers)
      .catch((caught) => setError(caught instanceof CatalogError ? caught.message : tr("Offres indisponibles.")))
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

  async function handleDecision(id: number, decision: "approve" | "reject") {
    if (!token) return;
    setPendingId(id);
    setError(null);
    try {
      await (decision === "approve" ? approveOffer(token, id) : rejectOffer(token, id));
      setOffers((current) => current.filter((offer) => offer.id !== id));
    } catch (caught) {
      setError(caught instanceof CatalogError ? caught.message : tr("La décision a échoué."));
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
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder à la modération.")}</p>
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
        <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Modération des offres vendeurs")}</h1>
        <p className="text-sm text-ink-soft">{tr("Offres soumises par des vendeurs tiers, en attente de publication.")}</p>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : offers.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucune offre en attente.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="offres"
  rows={offers}
  headers={[tr("Produit"), tr("Vendeur"), tr("Prix"), tr("Stock"), tr("Décision")]}
  actionColumns={[4]}
  renderRow={(offer) => (
                  <tr key={offer.id} className="border-b border-line">
                    <td className="py-3 pr-4 text-ink">
                      {offer.brand} {offer.product_name}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{tr("Vendeur #")}{offer.vendor_id}</td>
                    <td className="py-3 pr-4 text-ink">
                      {offer.price_amount.toLocaleString("fr-FR")} {offer.currency}
                    </td>
                    <td className="py-3 pr-4 text-ink">{offer.stock_quantity}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pendingId === offer.id}
                          onClick={() => handleDecision(offer.id, "approve")}
                          className="rounded-sm border border-gold px-2 py-1 text-xs text-gold transition-colors disabled:opacity-50"
                        >
                          <ActionLabel text={tr("Approuver")} />
                        </button>
                        <button
                          type="button"
                          disabled={pendingId === offer.id}
                          onClick={() => handleDecision(offer.id, "reject")}
                          className="rounded-sm border border-danger px-2 py-1 text-xs text-danger transition-colors disabled:opacity-50"
                        >
                          <ActionLabel text={tr("Rejeter")} />
                        </button>
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
