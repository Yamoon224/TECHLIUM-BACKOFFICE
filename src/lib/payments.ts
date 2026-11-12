/**
 * Client-side access to the Payments module's admin endpoints
 * (backend/app/Modules/Payments/Http/Controllers). Plain `fetch`,
 * mirroring lib/catalog.ts and lib/vendors.ts.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type PaymentMethod = "cash" | "cod" | "mobile_money";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type MobileMoneyProvider = "orange_money" | "mtn_money" | "wave";

export interface Payment {
  id: number;
  order_number: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount_amount: number;
  /** Running total of refunds; the payment is "refunded" once it reaches amount_amount. */
  refunded_amount: number;
  /** What can still be refunded (0 unless completed). */
  refundable_amount: number;
  currency: string;
  provider: MobileMoneyProvider | null;
  provider_reference: string | null;
  paid_at: string | null;
  created_at: string | null;
}

export class PaymentsError extends Error {}

async function parseError(response: Response): Promise<PaymentsError> {
  try {
    const body = (await response.json()) as { message?: string };
    return new PaymentsError(body.message ?? `Erreur inattendue (${response.status}).`);
  } catch {
    return new PaymentsError(`Erreur inattendue (${response.status}).`);
  }
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
}

export async function listPayments(token: string, filters: { orderNumber?: string; status?: PaymentStatus; from?: string; to?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.orderNumber) params.set("order_number", filters.orderNumber);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.size > 0 ? `?${params.toString()}` : "";

  const response = await fetch(`${API_BASE_URL}/admin/payments${query}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: Payment[] };
  return body.data;
}

export interface RecordPaymentInput {
  order_number: string;
  method: PaymentMethod;
  amount_amount: number;
  provider?: MobileMoneyProvider;
  provider_reference?: string;
}

export async function recordPayment(token: string, input: RecordPaymentInput): Promise<Payment> {
  const response = await fetch(`${API_BASE_URL}/admin/payments`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Payment>;
}

async function transition(token: string, id: number, action: "confirm" | "fail"): Promise<Payment> {
  const response = await fetch(`${API_BASE_URL}/admin/payments/${id}/${action}`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Payment>;
}

export const confirmPayment = (token: string, id: number) => transition(token, id, "confirm");
export const failPayment = (token: string, id: number) => transition(token, id, "fail");
/** Refunds all (amount omitted) or part of a collected payment. */
export async function refundPayment(token: string, id: number, amount?: number): Promise<Payment> {
  const response = await fetch(`${API_BASE_URL}/admin/payments/${id}/refund`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(amount === undefined ? {} : { amount }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Payment>;
}
