"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { DataTable } from "@/components/DataTable";
import { useAppearance } from "@/components/AppearanceProvider";
import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { useAuth } from "@/lib/useAuth";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  SupportError,
  canReply,
  countOpen,
  getTicket,
  listTickets,
  replyToTicket,
  statusActions,
  updateTicket,
  type Ticket,
  type TicketFilters,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/support";

const STATUSES: TicketStatus[] = ["open", "pending_customer", "resolved", "closed"];

export default function SupportPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, user, logout } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filters, setFilters] = useState<TicketFilters>({});
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listTickets(token, { ...filters, q: query })
      .then(setTickets)
      .catch((caught) => setError(caught instanceof SupportError ? caught.message : tr("File indisponible.")))
      .finally(() => setLoading(false));
  }, [token, filters, query, tr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function toggle(ticket: Ticket) {
    if (!token) return;
    if (open?.id === ticket.id) {
      setOpen(null);
      return;
    }
    try {
      setOpen(await getTicket(token, ticket.id));
    } catch (caught) {
      setError(caught instanceof SupportError ? caught.message : tr("Ticket indisponible."));
    }
  }

  /** Applies the API's fresh copy of the ticket to the open panel and the list. */
  function applyUpdated(updated: Ticket) {
    setOpen(updated);
    setTickets((current) =>
      current.map((ticket) => (ticket.id === updated.id ? { ...ticket, ...updated, messages: undefined } : ticket)),
    );
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder au support.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition-colors ${
      active ? "border-gold bg-gold text-on-primary font-medium" : "border-line text-ink hover:border-gold"
    }`;

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} roles={user?.roles} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Support client")}</h1>
          <p className="text-sm text-ink-soft">
            {countOpen(tickets)} {tr("à traiter dans cette vue")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFilters({})} className={pill(Object.keys(filters).length === 0)}>
            <ActionLabel text={tr("Tous")} />
          </button>
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilters({ status })}
              className={pill(filters.status === status)}
            >
              {tr(STATUS_LABEL[status])}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilters({ overdue: true })}
            className={pill(filters.overdue === true)}
          >
            <ActionLabel text={tr("En retard")} />
          </button>
          <button
            type="button"
            onClick={() => setFilters({ assigned: "me" })}
            className={pill(filters.assigned === "me")}
          >
            <ActionLabel text={tr("Mes tickets")} />
          </button>
          <button
            type="button"
            onClick={() => setFilters({ assigned: "none" })}
            className={pill(filters.assigned === "none")}
          >
            <ActionLabel text={tr("Non assignés")} />
          </button>
          <label className="field w-56">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tr("Ex. livraison, paiement…")}
              className="rounded-sm border border-line bg-surface px-3 text-sm text-ink"
            />
            <span className="field-label">{tr("Rechercher un sujet")}</span>
          </label>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucun ticket.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="support"
  rows={tickets}
  headers={[tr("Ticket"), tr("Sujet"), tr("Catégorie"), tr("Priorité"), tr("Statut"), tr("Assigné")]}
  renderRow={(ticket) => (
                  <Fragment key={ticket.id}>
                    <tr onClick={() => toggle(ticket)} className="cursor-pointer border-b border-line hover:bg-surface">
                      <td className="py-3 pr-4 text-ink">{ticket.number}</td>
                      <td className="py-3 pr-4 text-ink">
                        {ticket.subject}
                        {ticket.overdue ? <span className="ml-2 text-xs text-danger">{tr("en retard")}</span> : null}
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">
                        {tr(CATEGORY_LABEL[ticket.category] ?? ticket.category)}
                      </td>
                      <td className={`py-3 pr-4 ${ticket.priority === "high" ? "text-gold-bright" : "text-ink-soft"}`}>
                        {tr(PRIORITY_LABEL[ticket.priority])}
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{tr(STATUS_LABEL[ticket.status])}</td>
                      <td className="py-3 text-ink-soft">
                        {ticket.assigned_to === null
                          ? "-"
                          : ticket.assigned_to === user?.id
                            ? "Moi"
                            : `#${ticket.assigned_to}`}
                      </td>
                    </tr>
                    {open?.id === ticket.id ? (
                      <tr className="border-b border-line bg-surface">
                        <td colSpan={6} className="px-3 py-4">
                          <TicketPanel token={token} ticket={open} onUpdated={applyUpdated} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )}
/>
          </div>
        )}
      </main>
    </div>
  );
}

function TicketPanel({
  token,
  ticket,
  onUpdated,
}: {
  token: string;
  ticket: Ticket;
  onUpdated: (ticket: Ticket) => void;
}) {
  const { tr, trf } = useAppearance();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<Ticket>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await action());
    } catch (caught) {
      setError(caught instanceof SupportError ? caught.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    await run(() => replyToTicket(token, ticket.id, body.trim(), internal), tr("Envoi impossible."));
    setBody("");
  }

  const small =
    "rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold disabled:opacity-50";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          className={small}
          onClick={() =>
            run(
              () => updateTicket(token, ticket.id, { assigned_to_me: ticket.assigned_to === null }),
              tr("Assignation impossible."),
            )
          }
        >
          {ticket.assigned_to === null ? <ActionLabel text={tr("Prendre")} /> : <ActionLabel text={tr("Libérer")} />}
        </button>

        <label className="field items-center">
          <select
            value={ticket.priority}
            disabled={busy}
            onChange={(event) =>
              run(
                () => updateTicket(token, ticket.id, { priority: event.target.value as TicketPriority }),
                tr("Changement impossible."),
              )
            }
            className="rounded-sm border border-line bg-surface px-2 py-1 text-xs text-ink"
          >
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="field-label">{tr("Priorité")}</span>
        </label>

        {statusActions(ticket.status).map((action) => (
          <button
            key={action.target}
            type="button"
            disabled={busy}
            className={small}
            onClick={() =>
              run(() => updateTicket(token, ticket.id, { status: action.target }), tr("Changement impossible."))
            }
          >
            {tr(action.label)}
          </button>
        ))}

        <span className="text-xs text-ink-soft">
          {tr("Client #")}
          {ticket.customer_id}
          {ticket.order_number ? trf(" · commande {number}", { number: ticket.order_number }) : ""}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {(ticket.messages ?? []).map((message) => (
          <li
            key={message.id}
            className={`max-w-[80%] rounded-sm border p-3 text-sm ${
              message.internal
                ? "self-end border-gold-deep"
                : message.from === "customer"
                  ? "self-start border-line"
                  : "self-end border-line bg-bg"
            }`}
          >
            <p className="mb-1 text-xs text-ink-soft">
              {message.internal
                ? tr("Note interne")
                : message.from === "customer"
                  ? "Client"
                  : `${tr("Équipe")} #${message.author_id}`}
            </p>
            <p className="whitespace-pre-wrap text-ink">{message.body}</p>
          </li>
        ))}
      </ul>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {canReply(ticket.status) ? (
        <form onSubmit={handleSend} className="flex flex-col gap-2">
          <label className="field">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              maxLength={5000}
              placeholder={tr("Écrivez votre réponse au client…")}
              className="rounded-sm border border-line bg-bg px-3 text-sm text-ink"
            />
            <span className="field-label">
              {internal ? tr("Note visible de l'équipe uniquement…") : tr("Réponse envoyée au client…")}
            </span>
          </label>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className="rounded-sm border border-gold px-3 py-1.5 text-sm text-gold transition-colors disabled:opacity-50"
            >
              {internal ? <ActionLabel text={tr("Ajouter la note")} /> : <ActionLabel text={tr("Répondre")} />}
            </button>
            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
              {tr("Note interne (invisible du client)")}
            </label>
          </div>
        </form>
      ) : (
        <p className="text-sm text-ink-soft">{tr("Ticket clos : aucune réponse possible.")}</p>
      )}
    </div>
  );
}
