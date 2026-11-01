"use client";

import { Dropzone } from "@/components/Dropzone";
import { Download, ImageOff, QrCode } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isHexColor } from "@/lib/appearance";
import {
  buildQrSvg,
  DEFAULT_LOGO,
  DEFAULT_STYLE,
  drawQr,
  fetchAsDataUrl,
  fetchQrPayload,
  isLogoFileAllowed,
  LOGO_RATIO,
  QR_EXPORT_SIZES,
  QR_KINDS,
  qrFileName,
  QrError,
  readAsDataUrl,
  type QrKind,
  type QrPayload,
} from "@/lib/qr";
import { useAppearance } from "./AppearanceProvider";
import { Button } from "./Button";

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Builds the QR code of a product, order, invoice or supply, with the logo at its centre (the
 * TechniLium logo, or a picture of your own), and saves it as PNG or SVG. The server checks that the
 * record exists and that the account may use it; the picture is drawn here.
 */
export function QrGenerator({
  token,
  initialKind = "order",
  initialReference = "",
  autoGenerate = false,
}: {
  token: string;
  initialKind?: QrKind;
  initialReference?: string;
  autoGenerate?: boolean;
}) {
  const { tr } = useAppearance();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kind, setKind] = useState<QrKind>(initialKind);
  const [reference, setReference] = useState(initialReference);
  const [result, setResult] = useState<QrPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [withLogo, setWithLogo] = useState(true);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [defaultLogo, setDefaultLogo] = useState<string | null>(null);
  const [ratio, setRatio] = useState<number>(LOGO_RATIO.default);
  const [dark, setDark] = useState(DEFAULT_STYLE.dark);
  const [size, setSize] = useState<number>(DEFAULT_STYLE.size);

  useEffect(() => {
    // The default logo as a data URL, so the SVG export carries it with it.
    let cancelled = false;
    fetchAsDataUrl(DEFAULT_LOGO)
      .then((data) => !cancelled && setDefaultLogo(data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const logo = withLogo ? (customLogo ?? defaultLogo) : null;
  const style = { ...DEFAULT_STYLE, size, dark, logo, logoRatio: ratio };

  const generate = useCallback(
    async (nextKind: QrKind, nextReference: string) => {
      setBusy(true);
      setError(null);
      try {
        setResult(await fetchQrPayload(token, nextKind, nextReference));
      } catch (caught) {
        setResult(null);
        setError(caught instanceof QrError ? caught.message : tr("Génération impossible."));
      } finally {
        setBusy(false);
      }
    },
    [token, tr],
  );

  useEffect(() => {
    if (autoGenerate && initialReference) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void generate(initialKind, initialReference);
    }
  }, [autoGenerate, initialKind, initialReference, generate]);

  const text = result?.payload ?? null;
  const logoKey = style.logo;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !text) return;

    drawQr(canvas, text, { ...DEFAULT_STYLE, size, dark, logo: logoKey, logoRatio: ratio }).catch(() =>
      setError(tr("Logo illisible : le code est affiché sans logo.")),
    );
  }, [text, size, dark, logoKey, ratio, tr]);

  async function onLogoFile(file: File | undefined) {
    if (!file) return;
    if (!isLogoFileAllowed(file)) {
      setError(tr("Choisissez une image PNG, JPEG ou WebP de 2 Mo maximum."));
      return;
    }
    setError(null);
    setCustomLogo(await readAsDataUrl(file));
    setWithLogo(true);
  }

  function downloadPng() {
    canvasRef.current?.toBlob((blob) => blob && result && save(blob, qrFileName(result.kind, result.reference, "png")));
  }

  async function downloadSvg() {
    if (!result) return;
    save(new Blob([await buildQrSvg(result.payload, style)], { type: "image/svg+xml" }), qrFileName(result.kind, result.reference, "svg"));
  }

  const hint = QR_KINDS.find((item) => item.value === kind)?.hint ?? "";

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void generate(kind, reference);
          }}
        >
          <label className="field">
            <select value={kind} onChange={(event) => setKind(event.target.value as QrKind)}>
              {QR_KINDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {tr(item.label)}
                </option>
              ))}
            </select>
            <span className="field-label">{tr("Type de document")}</span>
          </label>

          <label className="field">
            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={tr(hint)} required maxLength={100} />
            <span className="field-label">{tr("Référence")}</span>
          </label>

          <Button type="submit" disabled={busy || reference.trim() === ""} className="gap-2 self-start">
            <QrCode className="h-4 w-4" aria-hidden /> {busy ? tr("Génération…") : tr("Générer le code QR")}
          </Button>
        </form>

        <fieldset className="flex flex-col gap-3 rounded-sm border border-line p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{tr("Logo au centre")}</legend>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={withLogo} onChange={(event) => setWithLogo(event.target.checked)} />
            {tr("Afficher un logo au centre du code")}
          </label>

          <div className={`flex flex-col gap-3 ${withLogo ? "" : "pointer-events-none opacity-50"}`}>
            <Dropzone
              accept="image/png,image/jpeg,image/webp"
              label={tr("Votre propre logo (PNG, JPEG ou WebP)")}
              hint={tr("Votre propre logo (PNG, JPEG ou WebP)")}
              onFiles={(files) => void onLogoFile(files[0])}
            />

            {customLogo ? (
              <button type="button" onClick={() => setCustomLogo(null)} className="flex items-center gap-1 self-start text-xs text-ink-soft hover:text-ink">
                <ImageOff className="h-3.5 w-3.5" aria-hidden /> {tr("Revenir au logo TechniLium")}
              </button>
            ) : null}

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">
                {tr("Taille du logo")} - {Math.round(ratio * 100)} %
              </span>
              <input
                type="range"
                min={LOGO_RATIO.min * 100}
                max={LOGO_RATIO.max * 100}
                step={1}
                value={Math.round(ratio * 100)}
                onChange={(event) => setRatio(Number(event.target.value) / 100)}
              />
            </label>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <span className="text-ink-soft">{tr("Couleur du code")}</span>
            <input
              type="color"
              value={dark}
              onChange={(event) => isHexColor(event.target.value) && setDark(event.target.value)}
              aria-label={tr("Couleur du code")}
              className="h-8 w-12 cursor-pointer rounded-sm border border-line bg-transparent"
            />
          </label>
          <p className="text-xs text-ink-soft">{tr("Gardez un code sombre sur fond clair : c'est ce que les lecteurs lisent le mieux.")}</p>

          <label className="field">
            <select value={size} onChange={(event) => setSize(Number(event.target.value))}>
              {QR_EXPORT_SIZES.map((option) => (
                <option key={option.value} value={option.value}>
                  {tr(option.label)}
                </option>
              ))}
            </select>
            <span className="field-label">{tr("Taille du fichier (PNG et SVG)")}</span>
          </label>
        </fieldset>
      </div>

      <div className="qr-print-area flex flex-col items-center gap-3 self-start rounded-sm border border-line bg-surface p-4 shadow-card border-b-4 border-b-gold">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        {result ? (
          <>
            <canvas ref={canvasRef} aria-label={tr("Code QR")} className="aspect-square h-auto w-full max-w-[18rem] rounded-sm bg-white" />
            <p className="text-center text-sm font-medium text-ink">{result.caption}</p>
            <p className="break-all text-center text-xs text-ink-soft">{result.payload}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="secondary" onClick={downloadPng} className="gap-2">
                <Download className="h-4 w-4" aria-hidden /> PNG
              </Button>
              <Button type="button" variant="secondary" onClick={() => void downloadSvg()} className="gap-2">
                <Download className="h-4 w-4" aria-hidden /> SVG
              </Button>
              <Button type="button" variant="ghost" onClick={() => window.print()}>
                {tr("Imprimer")}
              </Button>
            </div>
          </>
        ) : (
          <p className="py-16 text-center text-sm text-ink-soft">{tr("Saisissez une référence pour afficher son code QR.")}</p>
        )}
      </div>
    </div>
  );
}
