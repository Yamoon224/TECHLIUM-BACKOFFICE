/**
 * Client-side access to the Inventory module's admin endpoints
 * (backend/app/Modules/Inventory/Http/Controllers). Plain `fetch`,
 * mirroring lib/catalog.ts and lib/vendors.ts.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface StockMovement {
  id: number;
  offer_id: number;
  created_by: number | null;
  quantity_delta: number;
  quantity_after: number;
  reason: string | null;
  created_at: string | null;
}

export interface LowStockOffer {
  offer_id: number;
  product_name: string;
  brand: string;
  sku: string;
  stock_quantity: number;
  vendor_id: number | null;
}

export class InventoryError extends Error {}

async function parseError(response: Response): Promise<InventoryError> {
  try {
    const body = (await response.json()) as { message?: string };
    return new InventoryError(body.message ?? `Erreur inattendue (${response.status}).`);
  } catch {
    return new InventoryError(`Erreur inattendue (${response.status}).`);
  }
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
}

/** One offer of an active product with its stock level (same shape as the low-stock list). */
export type StockProduct = LowStockOffer;

/** The published offers of the active products, with their stock. */
export async function listActiveStock(token: string): Promise<StockProduct[]> {
  const response = await fetch(`${API_BASE_URL}/admin/stock/products`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<StockProduct[]>;
}

/** YYYY-MM-DD bounds, inclusive; either may be empty. */
export interface MovementPeriod {
  from?: string;
  to?: string;
}

export async function listMovements(token: string, offerId?: number, period: MovementPeriod = {}): Promise<StockMovement[]> {
  const query = new URLSearchParams({ per_page: "200" });
  if (offerId) query.set("offer_id", String(offerId));
  if (period.from) query.set("from", period.from);
  if (period.to) query.set("to", period.to);
  const params = `?${query.toString()}`;
  const response = await fetch(`${API_BASE_URL}/admin/stock/movements${params}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: StockMovement[] };
  return body.data;
}

export interface RecordMovementInput {
  offer_id: number;
  quantity_delta: number;
  reason?: string;
}

export async function recordMovement(token: string, input: RecordMovementInput): Promise<StockMovement> {
  const response = await fetch(`${API_BASE_URL}/admin/stock/movements`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<StockMovement>;
}

export async function listLowStock(token: string, threshold = 5): Promise<LowStockOffer[]> {
  const response = await fetch(`${API_BASE_URL}/admin/stock/low-stock?threshold=${threshold}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<LowStockOffer[]>;
}
