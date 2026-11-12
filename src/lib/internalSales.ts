/**
 * Client-side access to the Sales module (counter sales, backend/app/Modules/Sales) plus the
 * pure till logic: cart, total and change. A counter sale is a real order that is paid and handed
 * over on the spot, so it ends with a payment receipt.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type SaleMethod = "cash" | "mobile_money";
export type MobileMoneyProvider = "orange_money" | "mtn_money" | "wave";

export interface SaleLine {
  description: string;
  quantity: number;
  unit_price_amount: number;
  line_total_amount: number;
}

export interface SalePayment {
  id: number;
  receipt_number: string;
  method: SaleMethod | "cod";
  provider: MobileMoneyProvider | null;
  amount_amount: number;
  tendered_amount: number | null;
  change_amount: number | null;
  paid_at: string | null;
}

export interface InternalSale {
  order_number: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  currency: string;
  total_amount: number;
  discount_amount: number;
  coupon_code: string | null;
  created_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  lines: SaleLine[];
  payment: SalePayment | null;
}

export interface SaleInput {
  items: { offer_id: number; quantity: number }[];
  method: SaleMethod;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  provider?: MobileMoneyProvider;
  provider_reference?: string;
  tendered_amount?: number;
  coupon_code?: string;
  locale?: "fr" | "en";
}

export class InternalSalesError extends Error {}

async function parseError(response: Response): Promise<InternalSalesError> {
  try {
    const body = (await response.json()) as { message?: string };
    return new InternalSalesError(body.message ?? `Erreur inattendue (${response.status}).`);
  } catch {
    return new InternalSalesError(`Erreur inattendue (${response.status}).`);
  }
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
}

export async function listInternalSales(token: string): Promise<InternalSale[]> {
  const response = await fetch(`${API_BASE_URL}/admin/internal-sales?limit=200`, { headers: authHeaders(token), cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  return ((await response.json()) as { data: InternalSale[] }).data;
}

export async function recordInternalSale(token: string, input: SaleInput): Promise<InternalSale> {
  const response = await fetch(`${API_BASE_URL}/admin/internal-sales`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<InternalSale>;
}

/** An item of TechLium's own stock that can be rung up. */
export interface SellableOffer {
  offerId: number;
  label: string;
  unitPrice: number;
  currency: string;
  stock: number;
}

interface CatalogProduct {
  brand: string;
  name: string;
  variants?: {
    sku?: string | null;
    offers?: {
      id: number;
      seller: "TechLium" | "vendor";
      price: { amount: number; currency: string };
      stock_quantity: number;
      in_stock: boolean;
    }[];
  }[];
}

/** Flattens catalogue products into what the till can sell: own stock only, and only what is in stock. */
export function sellableOffers(products: CatalogProduct[]): SellableOffer[] {
  return products.flatMap((product) =>
    (product.variants ?? []).flatMap((variant) =>
      (variant.offers ?? [])
        .filter((offer) => offer.seller === "TechLium" && offer.in_stock && offer.stock_quantity > 0)
        .map((offer) => ({
          offerId: offer.id,
          label: `${product.brand} ${product.name}`.trim() + (variant.sku ? ` (${variant.sku})` : ""),
          unitPrice: offer.price.amount,
          currency: offer.price.currency,
          stock: offer.stock_quantity,
        })),
    ),
  );
}

export async function searchSellableOffers(search: string): Promise<SellableOffer[]> {
  const params = new URLSearchParams({ search, per_page: "20" });
  const response = await fetch(`${API_BASE_URL}/catalog/products?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw await parseError(response);
  return sellableOffers(((await response.json()) as { data: CatalogProduct[] }).data);
}

export interface CartLine {
  offer: SellableOffer;
  quantity: number;
}

/** Adds one unit, never beyond the stock on the shelf. */
export function addToCart(cart: CartLine[], offer: SellableOffer): CartLine[] {
  const existing = cart.find((line) => line.offer.offerId === offer.offerId);

  if (!existing) return [...cart, { offer, quantity: 1 }];

  return cart.map((line) => (line === existing ? { ...line, quantity: Math.min(line.quantity + 1, offer.stock) } : line));
}

/** Sets a quantity (clamped to 1..stock); 0 or less removes the line. */
export function setQuantity(cart: CartLine[], offerId: number, quantity: number): CartLine[] {
  if (!Number.isFinite(quantity) || quantity < 1) return cart.filter((line) => line.offer.offerId !== offerId);

  return cart.map((line) => (line.offer.offerId === offerId ? { ...line, quantity: Math.min(Math.floor(quantity), line.offer.stock) } : line));
}

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.offer.unitPrice * line.quantity, 0);
}

/** Change to give back; null while the cash handed over does not cover the total. */
export function changeDue(total: number, tendered: number): number | null {
  return tendered >= total ? tendered - total : null;
}

/** The A5 sheet, or the 80 mm roll of a thermal printer. */
export type ReceiptFormat = "a5" | "ticket";

export function saleReceiptPath(orderNumber: string, format: ReceiptFormat = "a5"): string {
  const path = `/admin/internal-sales/${encodeURIComponent(orderNumber)}/receipt`;

  return format === "ticket" ? `${path}?format=ticket` : path;
}

export async function cancelInternalSale(token: string, orderNumber: string, reason: string): Promise<InternalSale> {
  const response = await fetch(`${API_BASE_URL}/admin/internal-sales/${encodeURIComponent(orderNumber)}/cancel`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<InternalSale>;
}

/** What the cashier's drawer should hold since their last closing. */
export interface TillPeriod {
  sales_count: number;
  cancellations_count: number;
  cash_sales: number;
  cash_refunds: number;
  expected_cash: number;
  mobile_money_net: number;
  period_start: string | null;
  currency: string;
}

export interface CashClosing {
  id: number;
  number: string;
  user_name: string;
  currency: string;
  period_start: string | null;
  closed_at: string;
  sales_count: number;
  cancellations_count: number;
  cash_sales: number;
  cash_refunds: number;
  expected_cash: number;
  counted_cash: number;
  variance: number;
  mobile_money_net: number;
  note: string | null;
}

export async function currentTill(token: string): Promise<TillPeriod> {
  const response = await fetch(`${API_BASE_URL}/admin/cash-closings/current`, { headers: authHeaders(token), cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<TillPeriod>;
}

export async function listClosings(token: string): Promise<CashClosing[]> {
  const response = await fetch(`${API_BASE_URL}/admin/cash-closings`, { headers: authHeaders(token), cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  return ((await response.json()) as { data: CashClosing[] }).data;
}

export async function closeTill(token: string, countedCash: number, note?: string): Promise<CashClosing> {
  const response = await fetch(`${API_BASE_URL}/admin/cash-closings`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ counted_cash: countedCash, note }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<CashClosing>;
}

export const closingPdfPath = (id: number): string => `/admin/cash-closings/${id}/pdf`;

/** counted - expected: negative = money missing, positive = surplus, 0 = balanced. */
export function tillVariance(expected: number, counted: number): number {
  return counted - expected;
}

/** "+1 000", "−1 000" or "0": signed, with a real minus sign. */
export function formatVariance(variance: number): string {
  const digits = Math.abs(variance).toLocaleString("fr-FR");

  return variance > 0 ? `+${digits}` : variance < 0 ? `−${digits}` : "0";
}
