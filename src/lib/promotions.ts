/**
 * Client-side access to the Promotions module's admin endpoints
 * (backend/app/Modules/Promotions). Discounts are borne by TechniLium:
 * vendors are paid on the list price.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type CouponType = "percent" | "fixed";

export interface Coupon {
  id: number;
  code: string;
  type: CouponType;
  value: number;
  min_order_amount: number;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  created_at: string | null;
}

export type CouponState = "active" | "inactive" | "scheduled" | "expired" | "exhausted";

export const COUPON_STATE_LABEL: Record<CouponState, string> = {
  active: "Actif",
  inactive: "Désactivé",
  scheduled: "Programmé",
  expired: "Expiré",
  exhausted: "Épuisé",
};

export class PromotionsError extends Error {}

/**
 * The state a coupon is in right now, in the order the backend checks it
 * (EloquentCouponGateway): disabled first, then not started, expired, used up.
 */
export function couponState(coupon: Coupon, now: Date): CouponState {
  if (!coupon.active) return "inactive";
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return "scheduled";
  if (coupon.ends_at && new Date(coupon.ends_at) < now) return "expired";
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) return "exhausted";
  return "active";
}

/** "10 %" or "5 000 F CFA". */
export function describeDiscount(coupon: Pick<Coupon, "type" | "value">): string {
  return coupon.type === "percent"
    ? `${coupon.value} %`
    : `${coupon.value.toLocaleString("fr-FR")} F CFA`;
}

/** "3 / 100", or "3 / ∞" when uncapped. */
export function usageLabel(coupon: Pick<Coupon, "used_count" | "max_uses">): string {
  return `${coupon.used_count} / ${coupon.max_uses ?? "∞"}`;
}

export interface NewCouponInput {
  code: string;
  type: CouponType;
  value: number;
  min_order_amount?: number;
  max_uses?: number;
  max_uses_per_customer?: number;
  starts_at?: string;
  ends_at?: string;
}

async function parseError(response: Response): Promise<PromotionsError> {
  try {
    const body = (await response.json()) as { message?: string; errors?: Record<string, string[]> };
    const first = body.errors ? Object.values(body.errors)[0]?.[0] : undefined;
    return new PromotionsError(first ?? body.message ?? `Erreur inattendue (${response.status}).`);
  } catch {
    return new PromotionsError(`Erreur inattendue (${response.status}).`);
  }
}

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
}

export async function listCoupons(token: string): Promise<Coupon[]> {
  const response = await fetch(`${API_BASE_URL}/admin/coupons`, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  return ((await response.json()) as { data: Coupon[] }).data;
}

export async function createCoupon(token: string, input: NewCouponInput): Promise<Coupon> {
  const response = await fetch(`${API_BASE_URL}/admin/coupons`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Coupon>;
}

export async function setCouponActive(token: string, id: number, active: boolean): Promise<Coupon> {
  const response = await fetch(`${API_BASE_URL}/admin/coupons/${id}/${active ? "activate" : "deactivate"}`, {
    method: "POST",
    headers: headers(token),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Coupon>;
}
