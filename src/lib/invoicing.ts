/**
 * Client-side access to the Invoicing module's admin endpoints
 * (backend/app/Modules/Invoicing/Http/Controllers). Plain `fetch`,
 * mirroring lib/payments.ts.
 */

import type { CurrencyCode } from "./money";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type InvoiceType = "invoice" | "credit_note";

export const INVOICE_TYPE_LABEL: Record<InvoiceType, string> = {
  invoice: "Facture",
  credit_note: "Avoir",
};

export interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price_amount: number;
  line_total_amount: number;
}

export interface Invoice {
  id: number;
  number: string;
  type: InvoiceType;
  order_number: string;
  credited_invoice_id: number | null;
  customer_name: string;
  currency: CurrencyCode;
  vat_rate_percent: number;
  net_amount: number;
  vat_amount: number;
  total_amount: number;
  /** Coupon discount already taken off the lines' list price (borne by TechLium). */
  discount_amount: number;
  coupon_code: string | null;
  reason: string | null;
  issued_at: string;
  lines: InvoiceLine[] | null;
}

export class InvoicingError extends Error {}

/**
 * What credit notes (full or partial) may still cancel on an invoice; 0 for a
 * credit note. Mirrors Invoice::remainingCreditable() on the backend - the
 * server remains the authority.
 */
export function remainingCreditable(invoice: Invoice, all: readonly Invoice[]): number {
  if (invoice.type !== "invoice") return 0;
  const credited = all
    .filter((other) => other.credited_invoice_id === invoice.id)
    .reduce((sum, other) => sum + other.total_amount, 0);
  return Math.max(0, invoice.total_amount - credited);
}

export function isCreditable(invoice: Invoice, all: readonly Invoice[]): boolean {
  return remainingCreditable(invoice, all) > 0;
}

async function parseError(response: Response): Promise<InvoicingError> {
  try {
    const body = (await response.json()) as { message?: string };
    return new InvoicingError(body.message ?? `Erreur inattendue (${response.status}).`);
  } catch {
    return new InvoicingError(`Erreur inattendue (${response.status}).`);
  }
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
}

export async function listInvoices(token: string, filters: { type?: InvoiceType } = {}): Promise<Invoice[]> {
  const params = new URLSearchParams({ per_page: "100" });
  if (filters.type) params.set("type", filters.type);

  const response = await fetch(`${API_BASE_URL}/admin/invoices?${params.toString()}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: Invoice[] };
  return body.data;
}

export async function issueInvoice(token: string, orderNumber: string): Promise<Invoice> {
  const response = await fetch(`${API_BASE_URL}/admin/invoices`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ order_number: orderNumber }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Invoice>;
}

/** The PDF needs the bearer token, so it is fetched and saved as a blob rather than linked. */
export async function downloadInvoicePdf(token: string, invoice: Pick<Invoice, "id" | "number">): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/invoices/${invoice.id}/pdf`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
  });
  if (!response.ok) throw await parseError(response);

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = pdfFilename(invoice);
  link.click();
  URL.revokeObjectURL(url);
}

/** "FAC-2026-000042" -> "FAC-2026-000042.pdf", matching the server's Content-Disposition. */
export function pdfFilename(invoice: Pick<Invoice, "number">): string {
  return `${invoice.number}.pdf`;
}

export async function issueCreditNote(token: string, invoiceId: number, reason: string): Promise<Invoice> {
  const response = await fetch(`${API_BASE_URL}/admin/invoices/${invoiceId}/credit-note`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Invoice>;
}
