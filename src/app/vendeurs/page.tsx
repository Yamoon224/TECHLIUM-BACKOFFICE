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
  VendorsError,
  approveVendor,
  listVendors,
  reactivateVendor,
  suspendVendor,
  type Vendor,
  type VendorStatus,
} from "@/lib/vendors";

const STATUS_LABEL: Record<VendorStatus, string> = {
  pending: "En attente",
  active: "Actif",
  suspended: "Suspendu",
};

export default function VendorsPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filter, setFilter] = useState<VendorStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listVendors(token, filter ?? undefined)
      .then(setVendors)
      .catch((caught) => setError(caught instanceof VendorsError ? caught.message : tr("Vendeurs indisponibles.")))
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

  async function handleAction(id: number, action: "approve" | "suspend" | "reactivate") {
    if (!token) return;
    setPendingId(id);
    setError(null);
    try {
      const fn = action === "approve" ? approveVendor : action === "suspend" ? suspendVendor : reactivateVendor;
      const updated = await fn(token, id);
      setVendors((current) => current.map((vendor) => (vendor.id === id ? updated : vendor)));
    } catch (caught) {
      setError(caught instanceof VendorsError ? caught.message : tr("L'action a échoué."));
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
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux vendeurs.")}</p>
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
        <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Vendeurs tiers")}</h1>

        <nav className="flex flex-wrap gap-2">
          <FilterPill active={filter === null} onClick={() => setFilter(null)}>
            {tr("Tous")}
          </FilterPill>
          {(["pending", "active", "suspended"] as const).map((value) => (
            <FilterPill key={value} active={filter === value} onClick={() => setFilter(value)}>
              {tr(STATUS_LABEL[value])}
            </FilterPill>
          ))}
        </nav>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : vendors.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucun vendeur.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="vendeurs"
  rows={vendors}
  headers={[tr("Entreprise"), tr("Téléphone"), tr("Statut"), tr("Action")]}
  actionColumns={[3]}
  renderRow={(vendor) => (
                  <tr key={vendor.id} className="border-b border-line">
                    <td className="py-3 pr-4 text-ink">{vendor.company_name}</td>
                    <td className="py-3 pr-4 text-ink-soft">{vendor.phone}</td>
                    <td className="py-3 pr-4 text-ink-soft">{tr(STATUS_LABEL[vendor.status])}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {vendor.status === "pending" ? (
                          <button
                            type="button"
                            disabled={pendingId === vendor.id}
                            onClick={() => handleAction(vendor.id, "approve")}
                            className="rounded-sm border border-gold px-2 py-1 text-xs text-gold transition-colors disabled:opacity-50"
                          >
                            <ActionLabel text={tr("Approuver")} />
                          </button>
                        ) : null}
                        {vendor.status === "active" ? (
                          <button
                            type="button"
                            disabled={pendingId === vendor.id}
                            onClick={() => handleAction(vendor.id, "suspend")}
                            className="rounded-sm border border-danger px-2 py-1 text-xs text-danger transition-colors disabled:opacity-50"
                          >
                            <ActionLabel text={tr("Suspendre")} />
                          </button>
                        ) : null}
                        {vendor.status === "suspended" ? (
                          <button
                            type="button"
                            disabled={pendingId === vendor.id}
                            onClick={() => handleAction(vendor.id, "reactivate")}
                            className="rounded-sm border border-gold px-2 py-1 text-xs text-gold transition-colors disabled:opacity-50"
                          >
                            <ActionLabel text={tr("Réactiver")} />
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
