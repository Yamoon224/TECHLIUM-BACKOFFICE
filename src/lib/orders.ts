import type { OrderStatus } from "./orderStatus";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface OrderItem {
  offer_id: number;
  product_name: string;
  brand: string;
  quantity: number;
  unit_price: { amount: number; currency: string };
  line_total: { amount: number; currency: string };
}

/** One seller's share of an order (vendor_id null = TechLium's own stock). */
export interface SubOrder {
  id: number;
  vendor_id: number | null;
  status: OrderStatus;
  subtotal: { amount: number; currency: string };
  delivered_at: string | null;
}

export interface Order {
  order_number: string;
  status: OrderStatus;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_city: string | null;
  notes: string | null;
  /** What the customer owes, after any coupon. */
  subtotal: { amount: number; currency: string };
  discount?: { amount: number; currency: string };
  coupon_code?: string | null;
  items: OrderItem[];
  sub_orders?: SubOrder[];
  /** True when the sub-orders are at different stages (partially shipped / delivered). */
  partial?: boolean;
  /** When each status was reached, oldest first. */
  status_history?: { status: string; at: string }[];
  created_at: string | null;
}

export class OrdersError extends Error {}

export function sellerLabel(subOrder: Pick<SubOrder, "vendor_id">): string {
  return subOrder.vendor_id === null ? "TechLium" : `Vendeur #${subOrder.vendor_id}`;
}

/** Only worth showing the per-seller breakdown when more than one seller is involved. */
export function hasSplit(order: Pick<Order, "sub_orders">): boolean {
  return (order.sub_orders?.length ?? 0) > 1;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `Erreur inattendue (${response.status}).`;
  } catch {
    return `Erreur inattendue (${response.status}).`;
  }
}

export async function listOrders(token: string, status?: OrderStatus): Promise<Order[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(`${API_BASE_URL}/orders${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new OrdersError(await parseErrorMessage(response));
  }

  const body = (await response.json()) as { data: Order[] };
  return body.data;
}

export async function transitionOrder(token: string, orderNumber: string, status: OrderStatus): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderNumber)}/transition`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new OrdersError(await parseErrorMessage(response));
  }

  return response.json() as Promise<Order>;
}

export async function transitionSubOrder(
  token: string,
  orderNumber: string,
  subOrderId: number,
  status: OrderStatus,
): Promise<Order> {
  const response = await fetch(
    `${API_BASE_URL}/orders/${encodeURIComponent(orderNumber)}/sub-orders/${subOrderId}/transition`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    },
  );

  if (!response.ok) {
    throw new OrdersError(await parseErrorMessage(response));
  }

  return response.json() as Promise<Order>;
}

const HISTORY_LABEL: Record<string, string> = {
  pending: "Reçue",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const HISTORY_DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

/** "Reçue 27/10 · Confirmée 28/10" - empty when there is no history. */
export function historyLine(history: Order["status_history"]): string {
  return (history ?? [])
    .map((event) => {
      const date = new Date(event.at);
      const when = Number.isNaN(date.getTime()) ? "" : ` ${HISTORY_DATE.format(date)}`;
      return `${HISTORY_LABEL[event.status] ?? event.status}${when}`;
    })
    .join(" · ");
}
