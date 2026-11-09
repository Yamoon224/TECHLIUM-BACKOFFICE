"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/Modal";
import { useAppearance } from "@/components/AppearanceProvider";
import { deliveryNoteFilename, savePdf, withLanguage } from "@/lib/download";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/useAuth";
import {
  ShippingError,
  assignShipment,
  createShipment,
  deliverShipment,
  codeAttemptsLeft,
  failShipment,
  listShipments,
  retryShipment,
  returnShipment,
  startShipment,
  type Shipment,
  type ShipmentStatus,
} from "@/lib/shipping";

const STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending: "En attente",
  in_transit: "En cours",
  delivered: "Livrée",
  failed_attempt: "Échec de livraison",
  returned: "Retournée",
};

export default function ShipmentsPage() {
  const { tr, trf, appearance } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filter, setFilter] = useState<ShipmentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listShipments(token, filter ?? undefined)
      .then(setShipments)
      .catch((caught) => setError(caught instanceof ShippingError ? caught.message : tr("Livraisons indisponibles.")))
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

  async function handleAction(id: number, run: () => Promise<Shipment>) {
    setPendingId(id);
    setError(null);
    try {
      const updated = await run();
      setShipments((current) => current.map((shipment) => (shipment.id === id ? updated : shipment)));
    } catch (caught) {
      setError(caught instanceof ShippingError ? caught.message : tr("L'action a échoué."));
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
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux livraisons.")}</p>
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
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Livraisons")}</h1>
          <Button onClick={() => setShowNew(true)}><ActionLabel text={tr("Nouvelle livraison")} /></Button>
        </div>

        {showNew ? (
          <NewShipmentForm
            onClose={() => setShowNew(false)}
            onCreate={async (orderNumber, assignedTo) => {
              if (!token) return;
              const created = await createShipment(token, orderNumber, assignedTo);
              setShipments((current) => [created, ...current]);
            }}
          />
        ) : null}

        <nav className="flex flex-wrap gap-2">
          <FilterPill active={filter === null} onClick={() => setFilter(null)}>
            {tr("Toutes")}
          </FilterPill>
          {(["pending", "in_transit", "delivered", "failed_attempt", "returned"] as const).map((value) => (
            <FilterPill key={value} active={filter === value} onClick={() => setFilter(value)}>
              {tr(STATUS_LABEL[value])}
            </FilterPill>
          ))}
        </nav>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : shipments.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucune livraison.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="livraisons"
  rows={shipments}
  headers={[tr("Commande"), tr("Client"), tr("Adresse"), tr("Livreur"), tr("Tentatives"), tr("Statut"), tr("Action")]}
  actionColumns={[6]}
  renderRow={(shipment) => (
                  <tr key={shipment.id} className="border-b border-line">
                    <td className="py-3 pr-4 text-ink">{shipment.order_number}</td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {shipment.customer_name}
                      <br />
                      <span className="text-xs">{shipment.customer_phone}</span>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {shipment.delivery_address}
                      {shipment.delivery_city ? `, ${shipment.delivery_city}` : ""}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {shipment.assigned_to ? (
                        `#${shipment.assigned_to}`
                      ) : (
                        <AssignForm
                          onAssign={(assignedTo) =>
                            handleAction(shipment.id, () => {
                              if (!token) throw new ShippingError("Session expirée.");
                              return assignShipment(token, shipment.id, assignedTo);
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="py-3 pr-4 text-ink">{shipment.attempts}</td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {tr(STATUS_LABEL[shipment.status])}
                      {shipment.notes ? <div className="text-xs text-ink-soft">{shipment.notes}</div> : null}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <ActionButton
                          disabled={false}
                          onClick={() => {
                            if (!token) return;
                            setError(null);
                            savePdf(token, withLanguage(`/admin/shipments/${shipment.id}/delivery-note`, appearance.language), deliveryNoteFilename(shipment.id)).catch((caught) =>
                              setError(caught instanceof Error ? caught.message : tr("Le PDF n'a pas pu être téléchargé.")),
                            );
                          }}
                        >
                          {tr("Bon de livraison")}
                        </ActionButton>
                        {shipment.status === "pending" ? (
                          <ActionButton
                            disabled={pendingId === shipment.id}
                            onClick={() =>
                              handleAction(shipment.id, () => {
                                if (!token) throw new ShippingError("Session expirée.");
                                return startShipment(token, shipment.id);
                              })
                            }
                          >
                            {tr("Dispatcher")}
                          </ActionButton>
                        ) : null}
                        {shipment.status === "in_transit" ? (
                          <>
                            <ActionButton
                              disabled={pendingId === shipment.id || shipment.code_locked}
                              onClick={() => {
                                const code = window.prompt(
                                  trf("Code de confirmation remis au client ({count} essai(s) restant(s)) :", { count: codeAttemptsLeft(shipment) }),
                                );
                                if (!code) return;
                                void handleAction(shipment.id, () => {
                                  if (!token) throw new ShippingError("Session expirée.");
                                  return deliverShipment(token, shipment.id, code.trim());
                                });
                              }}
                            >
                              {shipment.code_locked ? tr("Verrouillée") : tr("Confirmer la livraison")}
                            </ActionButton>
                            <FailForm
                              onFail={(notes) =>
                                handleAction(shipment.id, () => {
                                  if (!token) throw new ShippingError("Session expirée.");
                                  return failShipment(token, shipment.id, notes);
                                })
                              }
                            />
                          </>
                        ) : null}
                        {shipment.status === "failed_attempt" ? (
                          <>
                            <ActionButton
                              disabled={pendingId === shipment.id}
                              onClick={() =>
                                handleAction(shipment.id, () => {
                                  if (!token) throw new ShippingError("Session expirée.");
                                  return retryShipment(token, shipment.id);
                                })
                              }
                            >
                              {tr("Réessayer")}
                            </ActionButton>
                            <ActionButton
                              danger
                              disabled={pendingId === shipment.id}
                              onClick={() =>
                                handleAction(shipment.id, () => {
                                  if (!token) throw new ShippingError("Session expirée.");
                                  return returnShipment(token, shipment.id);
                                })
                              }
                            >
                              {tr("Retourner")}
                            </ActionButton>
                          </>
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

function ActionButton({
  onClick,
  disabled,
  danger = false,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-sm border px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
        danger ? "border-danger text-danger" : "border-gold text-gold"
      }`}
    >
      {children}
    </button>
  );
}

function AssignForm({ onAssign }: { onAssign: (assignedTo: number) => void }) {
  const { tr } = useAppearance();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValue("");
          setOpen(true);
        }}
        className="rounded-sm border border-line px-2 py-1 text-xs text-ink hover:border-gold"
      >
        <ActionLabel text={tr("Assigner")} />
      </button>
      {open ? (
        <FormModal
          open
          size="md"
          title={tr("Assigner un livreur")}
          onClose={() => setOpen(false)}
          submitLabel={tr("Assigner")}
          disabled={!value}
          onSubmit={() => {
            onAssign(Number(value));
            setOpen(false);
          }}
        >
          <div className="grid gap-4">
            <label className="field">
              <input type="number" value={value} onChange={(event) => setValue(event.target.value)} placeholder="7" className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
              <span className="field-label">{tr("ID livreur")}</span>
            </label>
          </div>
        </FormModal>
      ) : null}
    </>
  );
}

function FailForm({ onFail }: { onFail: (notes?: string) => void }) {
  const { tr } = useAppearance();
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setNotes("");
          setOpen(true);
        }}
        className="rounded-sm border border-danger px-2 py-1 text-xs text-danger"
      >
        <ActionLabel text={tr("Échec de livraison")} />
      </button>
      {open ? (
        <FormModal
          open
          size="md"
          title={tr("Échec de livraison")}
          onClose={() => setOpen(false)}
          submitLabel={tr("Confirmer")}
          onSubmit={() => {
            onFail(notes || undefined);
            setOpen(false);
          }}
        >
          <div className="grid gap-4">
            <label className="field">
              <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={tr("Ex. Client absent")} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
              <span className="field-label">{tr("Motif (optionnel)")}</span>
            </label>
          </div>
        </FormModal>
      ) : null}
    </>
  );
}

function NewShipmentForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (orderNumber: string, assignedTo?: number) => Promise<void>;
}) {
  const { tr } = useAppearance();
  const [orderNumber, setOrderNumber] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit() {
    setFormError(null);

    if (!orderNumber) {
      setFormError(tr("Le numéro de commande est requis."));
      return;
    }

    setSubmitting(true);
    try {
      await onCreate(orderNumber, assignedTo ? Number(assignedTo) : undefined);
      onClose();
    } catch (caught) {
      setFormError(caught instanceof ShippingError ? caught.message : tr("Création impossible."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      open
      size="md"
      title={tr("Nouvelle livraison")}
      onClose={onClose}
      submitLabel={tr("Créer la livraison")}
      submitting={submitting}
      error={formError}
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4">
        <label className="field">
          <input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder={tr("TCH-20261025-XXXXXX")} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
          <span className="field-label">{tr("N° commande")}</span>
        </label>
        <label className="field">
          <input placeholder="7" type="number" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
          <span className="field-label">{tr("Livreur (ID, optionnel)")}</span>
        </label>
      </div>
    </FormModal>
  );
}
