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
  CHANNEL_LABEL,
  NOTIFICATION_STATUS_LABEL,
  NotificationsError,
  canRetry,
  countByStatus,
  eventLabel,
  listNotifications,
  retryNotification,
  type Notification,
  type NotificationStatus,
} from "@/lib/notifications";

const STATUSES: NotificationStatus[] = ["pending", "sent", "failed"];

export default function NotificationsPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, user, logout } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<NotificationStatus | null>(null);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listNotifications(token, { status: filter ?? undefined, reference: reference.trim() || undefined })
      .then(setItems)
      .catch((caught) => setError(caught instanceof NotificationsError ? caught.message : tr("Journal indisponible.")))
      .finally(() => setLoading(false));
  }, [token, filter, reference, tr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function handleRetry(item: Notification) {
    if (!token) return;
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await retryNotification(token, item.id);
      setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
    } catch (caught) {
      setError(caught instanceof NotificationsError ? caught.message : tr("La relance a échoué."));
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
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux notifications.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  const counts = countByStatus(items);

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} roles={user?.roles} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Notifications clients")}</h1>
          <p className="text-sm text-ink-soft">
            {counts.sent} {tr("envoyé(s) ·")} {counts.pending} {tr("en attente ·")}{" "}
            <span className={counts.failed > 0 ? "text-danger" : undefined}>
              {counts.failed} {tr("en échec")}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap gap-2">
            {[null, ...STATUSES].map((value) => (
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
                {value === null ? <ActionLabel text={tr("Tous")} /> : NOTIFICATION_STATUS_LABEL[value]}
              </button>
            ))}
          </nav>
          <label className="field w-52">
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="TCH-20261025-XXXXXX"
              className="rounded-sm border border-line bg-surface px-3 text-sm text-ink"
            />
            <span className="field-label">{tr("N° de commande")}</span>
          </label>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucun message.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="notifications"
  rows={items}
  headers={[tr("Date"), tr("Événement"), tr("Canal"), tr("Langue"), tr("Destinataire"), tr("Message"), tr("Statut"), ""]}
  actionColumns={[7]}
  renderRow={(item) => (
                  <tr key={item.id} className="border-b border-line align-top">
                    <td className="py-3 pr-4 text-ink-soft">{item.created_at?.slice(0, 16).replace("T", " ")}</td>
                    <td className="py-3 pr-4 text-ink">
                      {eventLabel(item.event)}
                      {item.reference ? <span className="block text-xs text-ink-soft">{item.reference}</span> : null}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{tr(CHANNEL_LABEL[item.channel] ?? item.channel)}</td>
                    <td className="py-3 pr-4 text-ink-soft">{(item.locale ?? "fr").toUpperCase()}</td>
                    <td className="py-3 pr-4 text-ink-soft">{item.recipient}</td>
                    <td className="max-w-md py-3 pr-4 text-xs text-ink-soft">{item.body}</td>
                    <td className="py-3 pr-4">
                      <span className={item.status === "failed" ? "text-danger" : "text-ink-soft"}>
                        {tr(NOTIFICATION_STATUS_LABEL[item.status])}
                      </span>
                      {item.attempts > 1 ? (
                        <span className="block text-xs text-ink-soft">
                          {item.attempts} {tr("essais")}
                        </span>
                      ) : null}
                      {item.error ? <span className="block text-xs text-danger">{item.error}</span> : null}
                    </td>
                    <td className="py-3">
                      {canRetry(item) ? (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => handleRetry(item)}
                          className="rounded-sm border border-gold px-2 py-1 text-xs text-gold transition-colors disabled:opacity-50"
                        >
                          <ActionLabel text={tr("Relancer")} />
                        </button>
                      ) : null}
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
