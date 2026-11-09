"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { DataTable } from "@/components/DataTable";
import { useAppearance } from "@/components/AppearanceProvider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { useAuth } from "@/lib/useAuth";
import {
  REVIEW_STATUS_LABEL,
  ReviewsError,
  canPublish,
  canReject,
  listReviews,
  pendingCount,
  publishReview,
  rejectReview,
  stars,
  type Review,
  type ReviewStatus,
} from "@/lib/reviews";

const STATUSES: ReviewStatus[] = ["pending", "published", "rejected"];

export default function ReviewsPage() {
  const { tr, trf } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, user, logout } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | null>("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listReviews(token, filter ?? undefined)
      .then(setReviews)
      .catch((caught) => setError(caught instanceof ReviewsError ? caught.message : tr("Avis indisponibles.")))
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

  async function decide(review: Review, action: "publish" | "reject") {
    if (!token) return;

    let reason: string | undefined;
    if (action === "reject") {
      const input = window.prompt(tr("Motif du rejet (montré à l'auteur) :"));
      if (input === null) return;
      reason = input.trim() || undefined;
    }

    setBusyId(review.id);
    setError(null);
    try {
      await (action === "publish" ? publishReview(token, review.id) : rejectReview(token, review.id, reason));
      refresh();
    } catch (caught) {
      setError(caught instanceof ReviewsError ? caught.message : tr("La décision a échoué."));
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
        <p className="text-ink-soft">{tr("Connectez-vous pour modérer les avis.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} roles={user?.roles} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Avis clients")}</h1>
          <p className="text-sm text-ink-soft">{pendingCount(reviews)} {tr("à modérer dans cette vue")}</p>
        </div>

        <nav className="flex flex-wrap gap-2">
          {[null, ...STATUSES].map((value) => (
            <button
              key={value ?? "all"}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                filter === value ? "border-gold bg-gold text-on-primary font-medium" : "border-line text-ink hover:border-gold"
              }`}
            >
              {value === null ? <ActionLabel text={tr("Tous")} /> : REVIEW_STATUS_LABEL[value]}
            </button>
          ))}
        </nav>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucun avis.")}</p>
        ) : (
          <div className="rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
              name="avis"
              title={tr("Avis clients")}
              rows={reviews}
              headers={[tr("Note"), tr("Avis"), tr("Auteur"), tr("Statut"), tr("Action")]}
              actionColumns={[4]}
              renderRow={(review) => (
                <tr key={review.id} className="border-b border-line align-top">
                  <td className="py-3 text-gold-bright">{stars(review.rating)}</td>
                  <td className="py-3">
                    {review.title ? <p className="font-medium text-ink">{review.title}</p> : null}
                    {review.body ? <p className="whitespace-pre-wrap text-ink-soft">{review.body}</p> : null}
                  </td>
                  <td className="py-3 text-xs text-ink-soft">
                    {review.author_name} {tr("· client #")}
                    {review.customer_id} {tr("· produit #")}
                    {review.product_id} {tr("· commande")} {review.order_number}
                    {review.rejection_reason ? trf(" · motif du rejet : {reason}", { reason: review.rejection_reason }) : ""}
                  </td>
                  <td className={`py-3 ${review.status === "pending" ? "text-gold-bright" : "text-ink-soft"}`}>
                    {tr(REVIEW_STATUS_LABEL[review.status])}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      {canPublish(review) ? (
                        <button
                          type="button"
                          disabled={busyId === review.id}
                          onClick={() => decide(review, "publish")}
                          className="rounded-sm border border-gold px-2 py-1 text-xs text-gold transition-colors disabled:opacity-50"
                        >
                          {review.status === "rejected" ? <ActionLabel text={tr("Rétablir")} /> : <ActionLabel text={tr("Publier")} />}
                        </button>
                      ) : null}
                      {canReject(review) ? (
                        <button
                          type="button"
                          disabled={busyId === review.id}
                          onClick={() => decide(review, "reject")}
                          className="rounded-sm border border-danger px-2 py-1 text-xs text-danger transition-colors disabled:opacity-50"
                        >
                          {review.status === "published" ? <ActionLabel text={tr("Retirer")} /> : <ActionLabel text={tr("Rejeter")} />}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )}
            />
          </div>
        )}

        <p className="text-xs text-ink-soft">
          {tr("Un avis ne peut venir que d'un acheteur ayant reçu le produit. Les avis propres sont publiés automatiquement ; ceux qui contiennent un lien, un e-mail, un numéro de téléphone ou un mot interdit attendent ici.")}
        </p>
      </main>
    </div>
  );
}
