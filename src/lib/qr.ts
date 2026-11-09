/**
 * QR codes that identify a product, an order, an invoice or a supply (backend Qr module). The
 * server decides what the code says and who may ask; the image is drawn here, with an optional
 * logo at its centre. Pure helpers first, then the two renderers (canvas PNG, SVG).
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type QrKind = "product" | "order" | "invoice" | "supply";

export const QR_KINDS: { value: QrKind; label: string; hint: string }[] = [
  { value: "product", label: "Produit", hint: "Référence (SKU) de la variante, ex. MON-27-BK" },
  { value: "order", label: "Commande", hint: "Numéro de commande, ex. TCH-20261025-AB12CD" },
  { value: "invoice", label: "Facture", hint: "Numéro de facture, ex. F-2026-0042" },
  { value: "supply", label: "Approvisionnement", hint: "Numéro du bon d'achat, ex. BC-000012" },
];

export interface QrPayload {
  kind: QrKind;
  reference: string;
  caption: string;
  payload: string;
}

export class QrError extends Error {}

/** Logo share of the code's width: small enough for error correction level H to read through it. */
export const LOGO_RATIO = { min: 0.1, max: 0.28, default: 0.2 } as const;

/** Image types accepted as a custom logo (no SVG: a logo is only ever drawn, never injected). */
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const DEFAULT_LOGO = "/icon-192.png";

export function clampLogoRatio(value: number): number {
  if (!Number.isFinite(value)) return LOGO_RATIO.default;
  return Math.min(LOGO_RATIO.max, Math.max(LOGO_RATIO.min, value));
}

/** Pixel sizes a code can be exported at; the code is always a square of side × side. */
export const QR_EXPORT_SIZES = [
  { value: 256, label: "Petit (256 px) : écran, e-mail" },
  { value: 512, label: "Moyen (512 px) : page web, document" },
  { value: 1024, label: "Grand (1024 px) : impression, affiche" },
] as const;

/** Side of a printed code, in centimetres: a label-sized square, whatever the paper. */
export const QR_PRINT_SIDE_CM = 6;

/** Square placed in the middle of a `size`-unit code, in the same (possibly fractional) unit. */
export function logoBoxExact(size: number, ratio: number): { x: number; y: number; side: number } {
  const side = size * clampLogoRatio(ratio);
  return { x: (size - side) / 2, y: (size - side) / 2, side };
}

/** Square placed in the middle of a `size`-pixel code. */
export function logoBox(size: number, ratio: number): { x: number; y: number; side: number } {
  const side = Math.round(size * clampLogoRatio(ratio));
  const offset = Math.round((size - side) / 2);

  return { x: offset, y: offset, side };
}

export function isLogoFileAllowed(file: Pick<File, "type" | "size">, maxBytes = 2 * 1024 * 1024): boolean {
  return (LOGO_TYPES as readonly string[]).includes(file.type) && file.size > 0 && file.size <= maxBytes;
}

<<<<<<< HEAD
/** Reads back `TechLium:<KIND>:<REFERENCE>` (what a scanner types), or null for anything else. */
export function parseQrPayload(text: string): { kind: QrKind; reference: string } | null {
  const match = /^TechLium:(PRODUCT|ORDER|INVOICE|SUPPLY):([A-Za-z0-9][A-Za-z0-9._/-]*)$/.exec(text.trim());
=======
/** Reads back `TechniLium:<KIND>:<REFERENCE>` (what a scanner types), or null for anything else. */
export function parseQrPayload(text: string): { kind: QrKind; reference: string } | null {
  const match = /^TechniLium:(PRODUCT|ORDER|INVOICE|SUPPLY):([A-Za-z0-9][A-Za-z0-9._/-]*)$/.exec(text.trim());
>>>>>>> 0376d01425630b79cfcc80c036cb7a4206e89841

  return match ? { kind: match[1].toLowerCase() as QrKind, reference: match[2] } : null;
}

/** A file name that is safe on every system: letters, digits, dash and underscore. */
export function qrFileName(kind: QrKind, reference: string, extension: "png" | "svg"): string {
  const safe = reference.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "code";

  return `qr-${kind}-${safe}.${extension}`;
}

export async function fetchQrPayload(token: string, kind: QrKind, reference: string): Promise<QrPayload> {
  const query = new URLSearchParams({ kind, reference: reference.trim() });
  const response = await fetch(`${API_BASE_URL}/admin/qrcodes/payload?${query}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (!response.ok) {
    let message = `Erreur inattendue (${response.status}).`;
    try {
      const body = (await response.json()) as { message?: string; errors?: Record<string, string[]> };
      message = body.errors ? Object.values(body.errors)[0]?.[0] ?? message : body.message ?? message;
    } catch {
      // keep the generic message
    }
    throw new QrError(message);
  }

  return response.json() as Promise<QrPayload>;
}

export interface QrStyle {
  size: number;
  dark: string;
  light: string;
  /** Data URL of the logo, or null for a plain code. */
  logo: string | null;
  logoRatio: number;
}

export const DEFAULT_STYLE: QrStyle = { size: 512, dark: "#000000", light: "#ffffff", logo: DEFAULT_LOGO, logoRatio: LOGO_RATIO.default };

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new QrError("Logo illisible."));
    image.src = source;
  });
}

/** Draws the code on a canvas: error correction H, the logo on a plain rounded backing. */
export async function drawQr(canvas: HTMLCanvasElement, text: string, style: QrStyle): Promise<void> {
  const QRCode = (await import("qrcode")).default;
  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: style.size,
    color: { dark: style.dark, light: style.light },
  });

  // The library pins an inline size in pixels, which would override the layout's CSS and stretch the code:
  // the canvas keeps its square resolution and is sized by CSS only.
  canvas.style.width = "";
  canvas.style.height = "";

  if (!style.logo) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const image = await loadImage(style.logo);
  const { x, y, side } = logoBox(canvas.width, style.logoRatio);
  const pad = Math.max(4, Math.round(side * 0.1));
  const radius = Math.round(side * 0.18);

  context.fillStyle = style.light;
  context.beginPath();
  context.roundRect(x - pad, y - pad, side + pad * 2, side + pad * 2, radius);
  context.fill();

  const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
  const width = ratio >= 1 ? side : Math.round(side * ratio);
  const height = ratio >= 1 ? Math.round(side / ratio) : side;
  context.drawImage(image, x + Math.round((side - width) / 2), y + Math.round((side - height) / 2), width, height);
}

/** The same code as a standalone SVG (vector, for print), with the logo embedded. */
export async function buildQrSvg(text: string, style: QrStyle): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  const svg = await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    width: style.size,
    color: { dark: style.dark, light: style.light },
  });

  if (!style.logo) return svg;

  // The drawing is laid out in module units (viewBox "0 0 25 25"), not in pixels.
  const units = Number(/viewBox="0 0 (\d+(?:\.\d+)?) /.exec(svg)?.[1]) || style.size;
  const { x, y, side } = logoBoxExact(units, style.logoRatio);
  const pad = Math.max(units * 0.008, side * 0.1);
  const backing = `<rect x="${x - pad}" y="${y - pad}" width="${side + pad * 2}" height="${side + pad * 2}" rx="${side * 0.18}" fill="${style.light}"/>`;
  const logo = `<image href="${style.logo}" x="${x}" y="${y}" width="${side}" height="${side}" preserveAspectRatio="xMidYMid meet"/>`;

  return svg.replace("</svg>", `${backing}${logo}</svg>`);
}

/** Reads a file or a picture into a data URL, so an exported SVG carries its logo with it. */
export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new QrError("Fichier illisible."));
    reader.readAsDataURL(blob);
  });
}

export async function fetchAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new QrError("Logo introuvable.");

  return readAsDataUrl(await response.blob());
}
