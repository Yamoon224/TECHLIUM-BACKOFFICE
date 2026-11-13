/**
 * Client-side access to the Catalog module's admin endpoints
 * (backend/app/Modules/Catalog/Http/Controllers/Admin). Plain `fetch`,
 * mirroring lib/orders.ts and lib/auth.ts.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  /** English wording; null falls back to the French name on the storefront. */
  name_en?: string | null;
  slug: string;
  description: string | null;
  position: number;
  is_active: boolean;
  product_count: number | null;
}

export interface CategoryInput {
  name: string;
  name_en?: string;
  slug?: string;
  description?: string;
  parent_id?: number | null;
  position?: number;
  is_active?: boolean;
}

export type ProductStatus = "draft" | "published" | "archived";
export type ConditionState = "neuf" | "reconditionne" | "occasion";

export interface ProductImage {
  id: number;
  url: string;
}

export const MAX_GALLERY_IMAGES = 8;

export interface ProductColor {
  name: string;
  /** #rrggbb */
  hex: string;
}

export interface Product {
  id: number;
  category_id: number;
  brand: string;
  name: string;
  /** English texts; empty means the storefront shows the French ones. */
  name_en?: string | null;
  slug: string;
  description: string | null;
  description_en?: string | null;
  /** Colour choices offered on the storefront. */
  colors?: ProductColor[];
  image_url: string | null;
  /** The whole gallery, cover first. */
  images?: ProductImage[];
  condition_state: ConditionState;
  status: ProductStatus;
  sku: string | null;
  price_amount: number | null;
  currency: string | null;
  stock_quantity: number | null;
  warranty_months: number | null;
}

export interface ProductInput {
  category_id: number;
  brand: string;
  name: string;
  slug?: string;
  description?: string;
  condition_state?: ConditionState;
  colors?: ProductColor[];
  sku?: string;
  price_amount: number;
  currency?: string;
  stock_quantity: number;
  warranty_months?: number;
}

export interface ProductUpdateInput {
  category_id?: number;
  brand?: string;
  name?: string;
  slug?: string;
  description?: string;
  name_en?: string;
  description_en?: string;
  colors?: ProductColor[];
  condition_state?: ConditionState;
  status?: ProductStatus;
  price_amount?: number;
  stock_quantity?: number;
  warranty_months?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export class CatalogError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function parseError(response: Response): Promise<CatalogError> {
  try {
    const body = (await response.json()) as { message?: string; errors?: Record<string, string[]> };
    return new CatalogError(body.message ?? `Erreur inattendue (${response.status}).`, body.errors);
  } catch {
    return new CatalogError(`Erreur inattendue (${response.status}).`);
  }
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
}

export async function listCategories(token: string): Promise<Category[]> {
  const response = await fetch(`${API_BASE_URL}/admin/categories`, { headers: authHeaders(token), cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Category[]>;
}

export async function createCategory(token: string, input: CategoryInput): Promise<Category> {
  const response = await fetch(`${API_BASE_URL}/admin/categories`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Category>;
}

export async function updateCategory(token: string, id: number, input: Partial<CategoryInput>): Promise<Category> {
  const response = await fetch(`${API_BASE_URL}/admin/categories/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Category>;
}

export async function deleteCategory(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/categories/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok) throw await parseError(response);
}

export async function listProducts(token: string, page = 1): Promise<Paginated<Product>> {
  const response = await fetch(`${API_BASE_URL}/admin/products?page=${page}&per_page=50`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Paginated<Product>>;
}

/** Every product, page after page, so the table's search and sort cover the whole catalogue. */
export async function listAllProducts(token: string): Promise<Product[]> {
  const first = await listProducts(token, 1);
  const products = [...first.data];
  for (let page = 2; page <= first.meta.last_page; page += 1) {
    products.push(...(await listProducts(token, page)).data);
  }
  return products;
}

export async function createProduct(token: string, input: ProductInput): Promise<Product> {
  const response = await fetch(`${API_BASE_URL}/admin/products`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Product>;
}

export async function updateProduct(token: string, id: number, input: ProductUpdateInput): Promise<Product> {
  const response = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Product>;
}

export async function archiveProduct(token: string, id: number): Promise<Product> {
  const response = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Product>;
}

export interface ModeratedOffer {
  id: number;
  vendor_id: number | null;
  product_name: string;
  brand: string;
  sku: string;
  price_amount: number;
  currency: string;
  stock_quantity: number;
  warranty_months: number;
  status: string;
  created_at: string | null;
}

export async function listOffersForModeration(token: string, status = "pending_review"): Promise<ModeratedOffer[]> {
  const response = await fetch(`${API_BASE_URL}/admin/offers?status=${encodeURIComponent(status)}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<ModeratedOffer[]>;
}

export async function approveOffer(token: string, id: number): Promise<ModeratedOffer> {
  const response = await fetch(`${API_BASE_URL}/admin/offers/${id}/approve`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<ModeratedOffer>;
}

export async function rejectOffer(token: string, id: number): Promise<ModeratedOffer> {
  const response = await fetch(`${API_BASE_URL}/admin/offers/${id}/reject`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<ModeratedOffer>;
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Early, friendly refusal; the server validates the real content again. */
export function imageProblem(file: Pick<File, "type" | "size">): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Format non accepté : utilisez JPG, PNG ou WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "L'image dépasse 2 Mo.";
  return null;
}

export async function addProductImage(token: string, id: number, file: File): Promise<Product> {
  const body = new FormData();
  body.append("image", file);

  // No Content-Type: the browser sets the multipart boundary itself.
  const response = await fetch(`${API_BASE_URL}/admin/products/${id}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    body,
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Product>;
}

export async function setProductCover(token: string, id: number, imageId: number): Promise<Product> {
  const response = await fetch(`${API_BASE_URL}/admin/products/${id}/images/${imageId}/cover`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Product>;
}

export async function removeProductImage(token: string, id: number, imageId: number): Promise<Product> {
  const response = await fetch(`${API_BASE_URL}/admin/products/${id}/images/${imageId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Product>;
}

// ------------------------------------------------------------------ banners

export type BannerPlacement = "hero" | "footer" | "left" | "right";

export interface Banner {
  id: number;
  placement: BannerPlacement;
  image_url: string;
  title: string | null;
  link_url: string | null;
  position: number;
  is_active: boolean;
}

export const MAX_BANNER_IMAGES = 10;
export const MAX_BANNER_BYTES = 4 * 1024 * 1024;

/** Early, friendly refusal; the server validates the real content again. */
export function bannerImageProblem(file: Pick<File, "type" | "size">): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Format non accepté : utilisez JPG, PNG ou WebP.";
  if (file.size > MAX_BANNER_BYTES) return "L'image dépasse 4 Mo.";
  return null;
}

export async function listBanners(token: string): Promise<Banner[]> {
  const response = await fetch(`${API_BASE_URL}/admin/banners`, { headers: authHeaders(token), cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Banner[]>;
}

export async function addBanner(
  token: string,
  input: { placement: BannerPlacement; file: File; title?: string; link_url?: string },
): Promise<Banner> {
  const body = new FormData();
  body.append("placement", input.placement);
  body.append("image", input.file);
  if (input.title) body.append("title", input.title);
  if (input.link_url) body.append("link_url", input.link_url);

  // No Content-Type: the browser sets the multipart boundary itself.
  const response = await fetch(`${API_BASE_URL}/admin/banners`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    body,
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Banner>;
}

export async function updateBanner(
  token: string,
  id: number,
  input: Partial<Pick<Banner, "title" | "link_url" | "is_active" | "position">>,
): Promise<Banner> {
  const response = await fetch(`${API_BASE_URL}/admin/banners/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<Banner>;
}

export async function deleteBanner(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/banners/${id}`, { method: "DELETE", headers: authHeaders(token) });
  if (!response.ok) throw await parseError(response);
}
