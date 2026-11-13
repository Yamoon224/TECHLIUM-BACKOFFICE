/**
 * Client-side access to the shop's public information (`/admin/shop`, backend Customers module): the
 * contacts, address and map point, TikTok page, delivery wording, the scrolling bar and the means of
 * payment the storefront shows.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type PaymentMethodId = "mtn" | "wave" | "cash" | "visa" | "mastercard" | "orange";

export interface TopbarMessage {
  fr: string;
  en: string | null;
}

export interface ShopSettings {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  hours: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  tiktok_url: string | null;
  delivery_info: string | null;
  delivery_info_en: string | null;
  topbar_messages: TopbarMessage[];
  payment_methods: PaymentMethodId[];
  /** Every means of payment the footer can draw. */
  available_payment_methods: PaymentMethodId[];
}

export type ShopSettingsInput = Omit<ShopSettings, "available_payment_methods">;

export class ShopError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function parseError(response: Response): Promise<ShopError> {
  try {
    const body = (await response.json()) as { message?: string; errors?: Record<string, string[]> };
    return new ShopError(body.message ?? `Erreur inattendue (${response.status}).`, body.errors);
  } catch {
    return new ShopError(`Erreur inattendue (${response.status}).`);
  }
}

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
}

export async function getShopSettings(token: string): Promise<ShopSettings> {
  const response = await fetch(`${API_BASE_URL}/admin/shop`, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<ShopSettings>;
}

export async function saveShopSettings(token: string, input: ShopSettingsInput): Promise<ShopSettings> {
  const response = await fetch(`${API_BASE_URL}/admin/shop`, { method: "PUT", headers: headers(token), body: JSON.stringify(input) });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<ShopSettings>;
}

/** "5,3013244" or "5.3013244" -> 5.3013244; empty -> null; anything else -> NaN (the form reports it). */
export function parseCoordinate(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** The first line of the first error the API reported, for a field. */
export function firstError(error: ShopError | null, field: string): string | null {
  return error?.fieldErrors?.[field]?.[0] ?? null;
}
