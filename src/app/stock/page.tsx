"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { Button } from "@/components/Button";
import { DataTable } from "@/components/DataTable";
import { useAppearance } from "@/components/AppearanceProvider";
import { BackofficeNav } from "@/components/BackofficeNav";
import { FormModal, Modal } from "@/components/Modal";
import { Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { exportTable, type ExportFormat } from "@/lib/exporters";
import { useAuth } from "@/lib/useAuth";
import {
  InventoryError,
  listActiveStock,
  listMovements,
  recordMovement,
  type StockMovement,
  type StockProduct,
} from "@/lib/inventory";

/** At or under this quantity a product is shown as running low. */
const LOW_STOCK = 5;

type Adjustment = { product: StockProduct; direction: 1 | -1 };

const BUTTON = "rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line";

export default function StockPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<Adjustment | null>(null);
  const [history, setHistory] = useState<StockProduct | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listActiveStock(token)
      .then(setProducts)
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

  const lowCount = products.filter((product) => product.stock_quantity <= LOW_STOCK).length;

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Stock")}</h1>
          {products.length > 0 ? (
            <p className="text-sm text-ink-soft">
              {products.length} {tr("produits actifs")}
              {lowCount > 0 ? <span className="text-danger"> - {lowCount} {tr("en stock faible ou en rupture")}</span> : null}
            </p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading && products.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucun produit actif.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
              name="stock"
              title={tr("Stock des produits actifs")}
              rows={products}
              headers={[tr("Produit"), tr("SKU"), tr("Stock"), tr("Action")]}
              actionColumns={[3]}
              renderRow={(product) => (
                <tr key={product.offer_id} className="border-b border-line">
                  <td className="py-3 pr-4 text-ink">
                    {product.brand} {product.product_name}
                  </td>
                  <td className="py-3 pr-4 text-ink-soft">{product.sku}</td>
                  <td className={`py-3 pr-4 font-medium ${product.stock_quantity === 0 ? "text-danger" : product.stock_quantity <= LOW_STOCK ? "text-gold-bright" : "text-ink"}`}>
                    {product.stock_quantity}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setAdjusting({ product, direction: 1 })} className={BUTTON}>
                        <ActionLabel text={tr("Augmenter")} />
                      </button>
                      <button type="button" onClick={() => setAdjusting({ product, direction: -1 })} disabled={product.stock_quantity <= 0} className={BUTTON}>
                        <ActionLabel text={tr("Diminuer")} />
                      </button>
                      <button type="button" onClick={() => setHistory(product)} className={BUTTON}>
                        <ActionLabel text={tr("Historique")} />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            />
          </div>
        )}
      </main>

      {adjusting ? (
        <AdjustModal
          key={`${adjusting.product.offer_id}-${adjusting.direction}`}
          adjustment={adjusting}
          onClose={() => setAdjusting(null)}
          onSubmit={async (quantity, reason) => {
            const movement = await recordMovement(token, {
              offer_id: adjusting.product.offer_id,
              quantity_delta: adjusting.direction * quantity,
              reason: reason || undefined,
            });
            setProducts((current) => current.map((row) => (row.offer_id === movement.offer_id ? { ...row, stock_quantity: movement.quantity_after } : row)));
            setAdjusting(null);
          }}
        />
      ) : null}

      {history ? <HistoryModal token={token} product={history} onClose={() => setHistory(null)} /> : null}
    </div>
  );
}

/** Increase or decrease the stock of one product by a quantity, with an optional reason. */
function AdjustModal({
  adjustment,
  onClose,
  onSubmit,
}: {
  adjustment: Adjustment;
  onClose: () => void;
  onSubmit: (quantity: number, reason: string) => Promise<void>;
}) {
  const { tr } = useAppearance();
  const { product, direction } = adjustment;
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(quantity);
  const valid = Number.isInteger(amount) && amount >= 1 && (direction === 1 || amount <= product.stock_quantity);
  const after = valid ? product.stock_quantity + direction * amount : product.stock_quantity;
  const label = direction === 1 ? tr("Augmenter le stock") : tr("Diminuer le stock");

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(amount, reason.trim());
    } catch (caught) {
      setError(caught instanceof InventoryError ? caught.message : tr("Enregistrement impossible."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      open
      size="md"
      title={`${label} - ${product.brand} ${product.product_name}`}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={direction === 1 ? tr("Augmenter") : tr("Diminuer")}
      submitting={submitting}
      disabled={!valid}
      error={error}
    >
      <div className="grid gap-4">
        <p className="text-sm text-ink-soft">
          {tr("Stock actuel")} : <span className="font-medium text-ink">{product.stock_quantity}</span>
          {" → "}
          <span className={`font-medium ${after === 0 ? "text-danger" : "text-ink"}`}>{after}</span>
        </p>
        <label className="field">
          <input
            type="number"
            min={1}
            max={direction === -1 ? product.stock_quantity : undefined}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
          <span className="field-label">{direction === 1 ? tr("Quantité à ajouter") : tr("Quantité à retirer")}</span>
        </label>
        <label className="field">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder={direction === 1 ? tr("Réception fournisseur, retour…") : tr("Casse, perte, correction d'inventaire…")}
            className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
          <span className="field-label">{tr("Motif")}</span>
        </label>
      </div>
    </FormModal>
  );
}

/** Every stock movement of one product, newest first. */
function HistoryModal({ token, product, onClose }: { token: string; product: StockProduct; onClose: () => void }) {
  const { tr } = useAppearance();
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport(format: ExportFormat) {
    if (!movements) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportTable(format, {
        name: `historique-stock-${product.sku}`,
        title: `${tr("Historique du stock")} - ${product.brand} ${product.product_name} (${product.sku})`,
        headers: [tr("Date"), tr("Variation"), tr("Stock après"), tr("Motif")],
        rows: movements.map((movement) => [
          movement.created_at ? new Date(movement.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "-",
          `${movement.quantity_delta > 0 ? "+" : ""}${movement.quantity_delta}`,
          String(movement.quantity_after),
          movement.reason ?? "-",
        ]),
      });
    } catch {
      setExportError(tr("Export impossible."));
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    listMovements(token, product.offer_id)
      .then((list) => !cancelled && setMovements(list))
      .catch((caught) => !cancelled && setError(caught instanceof InventoryError ? caught.message : tr("Historique indisponible.")));
    return () => {
      cancelled = true;
    };
  }, [token, product.offer_id, tr]);

  return (
    <Modal
      open
      size="lg"
      title={`${tr("Historique du stock")} - ${product.brand} ${product.product_name}`}
      onClose={onClose}
      footer={
        <>
          {exportError ? (
            <p role="alert" className="mr-auto text-sm text-danger">
              {exportError}
            </p>
          ) : movements && movements.length > 0 ? (
            <div className="mr-auto flex flex-wrap items-center gap-1.5" role="group" aria-label={tr("Exporter")}>
              <span className="mr-1 flex items-center gap-1 text-xs text-ink-soft">
                <Download className="h-3.5 w-3.5" aria-hidden /> {tr("Exporter")}
              </span>
              {(
                [
                  ["pdf", "PDF"],
                  ["xlsx", "Excel"],
                  ["csv", "CSV"],
                  ["txt", "TXT"],
                  ["sql", "SQL"],
                ] as [ExportFormat, string][]
              ).map(([format, label]) => (
                <button
                  key={format}
                  type="button"
                  disabled={exporting}
                  onClick={() => void handleExport(format)}
                  className="rounded-sm border border-line px-2 py-1 text-xs font-medium text-ink transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose}>
            <ActionLabel text={tr("Fermer")} />
          </Button>
        </>
      }
    >
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : movements === null ? (
        <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
      ) : movements.length === 0 ? (
        <p className="text-sm text-ink-soft">{tr("Aucun mouvement enregistré.")}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-soft">
              <th className="py-1.5 pr-3 font-medium">{tr("Date")}</th>
              <th className="py-1.5 pr-3 font-medium">{tr("Variation")}</th>
              <th className="py-1.5 pr-3 font-medium">{tr("Stock après")}</th>
              <th className="py-1.5 font-medium">{tr("Motif")}</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id} className="border-b border-line">
                <td className="py-2 pr-3 text-ink-soft">{movement.created_at ? new Date(movement.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "-"}</td>
                <td className={`py-2 pr-3 font-medium ${movement.quantity_delta >= 0 ? "text-gold-bright" : "text-danger"}`}>
                  {movement.quantity_delta > 0 ? "+" : ""}
                  {movement.quantity_delta}
                </td>
                <td className="py-2 pr-3 text-ink">{movement.quantity_after}</td>
                <td className="py-2 text-ink-soft">{movement.reason ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
