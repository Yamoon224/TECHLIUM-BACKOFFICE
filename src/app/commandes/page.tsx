"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { QrLink } from "@/components/QrLink";
import { DataTable } from "@/components/DataTable";
import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormModal, Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { useAppearance } from "@/components/AppearanceProvider";
import { BackofficeNav } from "@/components/BackofficeNav";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/useAuth";
import {
  OrdersError,
  hasSplit,
  listOrders,
  sellerLabel,
  transitionOrder,
  transitionSubOrder,
  type Order,
  type Courier,
  historyLine,
} from "@/lib/orders";
import { ORDER_STATUSES, ORDER_STATUS_TRANSITIONS, type OrderStatus } from "@/lib/orderStatus";

/** Marker for "could not load the list": the message is translated at render time. */
const LIST_FAILED = "list-failed";

export default function OrdersPage() {
  const router = useRouter();
  const { t, tr } = useAppearance();
  const { status: sessionStatus, token, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrderNumber, setPendingOrderNumber] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [details, setDetails] = useState<Order | null>(null);
  const [shipping, setShipping] = useState<Order | null>(null);
  const [courierName, setCourierName] = useState("");
  const [courierPhone, setCourierPhone] = useState("");
  const [shipError, setShipError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listOrders(token, filter ?? undefined, { from: dateFrom || undefined, to: dateTo || undefined })
      .then(setOrders)
      .catch((caught) => setError(caught instanceof OrdersError ? caught.message : LIST_FAILED))
      .finally(() => setLoading(false));
  }, [token, filter, dateFrom, dateTo]);

  useEffect(() => {
    // Fetching on mount/filter change and flagging loading state
    // synchronously before the request starts is the standard pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  function askTransition(order: Order, target: OrderStatus) {
    if (target === "shipped") {
      setCourierName("");
      setCourierPhone("");
      setShipError(null);
      setShipping(order);
      return;
    }
    void handleTransition(order.order_number, target);
  }

  async function confirmShipping() {
    if (!shipping) return;
    const done = await handleTransition(shipping.order_number, "shipped", { name: courierName.trim(), phone: courierPhone.trim() });
    if (done) setShipping(null);
  }

  async function handleTransition(orderNumber: string, target: OrderStatus, courier?: Courier): Promise<boolean> {
    if (!token) return false;

    setPendingOrderNumber(orderNumber);
    try {
      const updated = await transitionOrder(token, orderNumber, target, courier);
      setOrders((current) => current.map((order) => (order.order_number === orderNumber ? updated : order)));
      return true;
    } catch (caught) {
      const message = caught instanceof OrdersError ? caught.message : "";
      if (courier) setShipError(message || t("orders.updateFailed"));
      else setError(message);
      return false;
    } finally {
      setPendingOrderNumber(null);
    }
  }

  async function handleSubOrderTransition(orderNumber: string, subOrderId: number, target: OrderStatus) {
    if (!token) return;

    setPendingOrderNumber(orderNumber);
    try {
      const updated = await transitionSubOrder(token, orderNumber, subOrderId, target);
      setOrders((current) => current.map((order) => (order.order_number === orderNumber ? updated : order)));
    } catch (caught) {
      setError(caught instanceof OrdersError ? caught.message : "");
    } finally {
      setPendingOrderNumber(null);
    }
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{t("login.checking")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{t("orders.signIn")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {t("login.submit")}
        </Link>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="page-title font-display text-2xl font-semibold text-ink">{t("orders.title")}</h1>

        <nav className="flex flex-wrap gap-2">
          <FilterPill active={filter === null} onClick={() => setFilter(null)}>
            {t("orders.all")}
          </FilterPill>
          {ORDER_STATUSES.map((value) => (
            <FilterPill key={value} active={filter === value} onClick={() => setFilter(value)}>
              {t(`status.${value}`)}
            </FilterPill>
          ))}
        </nav>

        <div className="flex flex-wrap items-end gap-3">
          <label className="field">
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
            <span className="field-label">{tr("Date de début")}</span>
          </label>
          <label className="field">
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
            <span className="field-label">{tr("Date de fin")}</span>
          </label>
          {dateFrom || dateTo ? (
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="rounded-sm border border-line px-3 py-2 text-sm text-ink transition-colors hover:border-gold"
            >
              <ActionLabel text={tr("Réinitialiser les dates")} />
            </button>
          ) : null}
        </div>

        {error !== null ? <p className="text-sm text-danger">{error === LIST_FAILED ? t("orders.unavailable") : error || t("orders.updateFailed")}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{t("orders.loading")}</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("orders.empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="commandes"
  rows={orders}
  headers={[t("orders.colOrder"), tr("Date"), t("orders.colCustomer"), t("orders.colPhone"), t("orders.colTotal"), t("orders.colStatus"), t("orders.colAction")]}
  actionColumns={[6]}
  renderRow={(order) => (
                  <Fragment key={order.order_number}>
                  <tr className="border-b border-line">
                    <td className="py-3 pr-4 text-ink">{order.order_number}</td>
                    <td className="py-3 pr-4 text-ink-soft">{order.created_at ? new Date(order.created_at).toLocaleDateString("fr-FR") : "-"}</td>
                    <td className="py-3 pr-4 text-ink">{order.customer_name}</td>
                    <td className="py-3 pr-4 text-ink-soft">{order.customer_phone}</td>
                    <td className="py-3 pr-4 text-ink">
                      {order.subtotal.amount.toLocaleString("fr-FR")} {order.subtotal.currency}
                      {order.discount && order.discount.amount > 0 ? (
                        <span className="block text-xs text-ink-soft">
                          {t("orders.discount")} {order.discount.amount.toLocaleString("fr-FR")}
                          {order.coupon_code ? ` (${order.coupon_code})` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={order.status} />
                      {order.partial ? <span className="ml-2 text-xs text-ink-soft">{t("orders.partial")}</span> : null}
                      {order.status_history?.length ? (
                        <span className="mt-1 block text-xs text-ink-soft">{historyLine(order.status_history)}</span>
                      ) : null}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setDetails(order)}
                          className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                        >
                          <ActionLabel text={tr("Détails")} />
                        </button>
                        <QrLink kind="order" reference={order.order_number} />
                        {ORDER_STATUS_TRANSITIONS[order.status].map((target) => (
                          <button
                            key={target}
                            type="button"
                            disabled={pendingOrderNumber === order.order_number}
                            onClick={() => askTransition(order, target)}
                            className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ActionLabel text={t(`action.${target}`)} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {hasSplit(order)
                    ? order.sub_orders?.map((subOrder) => (
                        <tr key={subOrder.id} className="border-b border-line bg-surface">
                          <td className="py-2 pl-6 pr-4 text-xs text-ink-soft" colSpan={4}>
                            {sellerLabel(subOrder)}
                          </td>
                          <td className="py-2 pr-4 text-xs text-ink-soft">
                            {subOrder.subtotal.amount.toLocaleString("fr-FR")} {subOrder.subtotal.currency}
                          </td>
                          <td className="py-2 pr-4">
                            <StatusBadge status={subOrder.status} />
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-2">
                              {ORDER_STATUS_TRANSITIONS[subOrder.status].map((target) => (
                                <button
                                  key={target}
                                  type="button"
                                  disabled={pendingOrderNumber === order.order_number}
                                  onClick={() => handleSubOrderTransition(order.order_number, subOrder.id, target)}
                                  className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <ActionLabel text={t(`action.${target}`)} />
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    : null}
                  </Fragment>
                )}
/>
          </div>
        )}
      </main>

      {shipping ? (
        <FormModal
          open
          title={`${tr("Confirmer l'expédition")} - ${shipping.order_number}`}
          onClose={() => setShipping(null)}
          onSubmit={confirmShipping}
          submitLabel={tr("Confirmer l'expédition")}
          submitting={pendingOrderNumber === shipping.order_number}
          disabled={courierName.trim() === "" || courierPhone.trim() === ""}
          error={shipError}
        >
          <div className="grid gap-4">
            <label className="field">
              <input type="text" value={courierName} onChange={(event) => setCourierName(event.target.value)} required autoComplete="off" className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
              <span className="field-label">{tr("Nom complet du livreur")}</span>
            </label>
            <label className="field">
              <input type="tel" value={courierPhone} onChange={(event) => setCourierPhone(event.target.value)} required autoComplete="off" className="rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink" />
              <span className="field-label">{tr("N° Téléphone du livreur")}</span>
            </label>
          </div>
        </FormModal>
      ) : null}

      <Modal
        open={details !== null}
        title={details ? `${tr("Commande")} ${details.order_number}` : ""}
        onClose={() => setDetails(null)}
        footer={
          <Button type="button" variant="secondary" onClick={() => setDetails(null)}>
            <ActionLabel text={t("modal.close")} />
          </Button>
        }
      >
        {details ? <OrderDetails order={details} /> : null}
      </Modal>
    </div>
  );
}

function OrderDetails({ order }: { order: Order }) {
  const { t, tr } = useAppearance();
  const money = (m: { amount: number; currency: string }) => `${m.amount.toLocaleString("fr-FR")} ${m.currency}`;
  const rows: [string, React.ReactNode][] = [
    [tr("Statut"), <StatusBadge key="s" status={order.status} />],
    [tr("Client"), `${order.customer_name} - ${order.customer_phone}`],
    [tr("Adresse"), [order.delivery_address, order.delivery_city].filter(Boolean).join(", ")],
    [tr("Paiement"), order.payment_method],
    [tr("Date"), order.created_at ? new Date(order.created_at).toLocaleString("fr-FR") : "-"],
  ];
  if (order.notes) rows.push([tr("Notes"), order.notes]);
  if (order.courier_name) rows.push([tr("Livreur"), `${order.courier_name} - ${order.courier_phone ?? ""}`]);

  return (
    <div className="grid gap-4 text-sm">
      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-ink-soft">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </Fragment>
        ))}
      </dl>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line text-xs text-ink-soft">
            <th className="py-1 pr-2 font-medium">{tr("Produit")}</th>
            <th className="py-1 pr-2 font-medium">{tr("Qté")}</th>
            <th className="py-1 text-right font-medium">{t("orders.colTotal")}</th>
          </tr>
        </thead>
        <tbody>
          {(order.items ?? []).map((item) => (
            <tr key={`${item.offer_id}-${item.product_name}`} className="border-b border-line">
              <td className="py-1 pr-2 text-ink">{item.brand} {item.product_name}</td>
              <td className="py-1 pr-2 text-ink">{item.quantity}</td>
              <td className="py-1 text-right text-ink">{money(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-right font-medium text-ink">
        {t("orders.colTotal")} : {money(order.subtotal)}
        {order.discount && order.discount.amount > 0 ? ` (${t("orders.discount")} ${money(order.discount)})` : ""}
      </p>
      {order.status_history?.length ? <p className="text-xs text-ink-soft">{historyLine(order.status_history)}</p> : null}
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
