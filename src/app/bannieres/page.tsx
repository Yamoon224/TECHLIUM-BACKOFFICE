"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { Dropzone } from "@/components/Dropzone";
import { FormModal } from "@/components/Modal";
import { useAppearance } from "@/components/AppearanceProvider";
import { useAuth } from "@/lib/useAuth";
import {
  CatalogError,
  MAX_BANNER_IMAGES,
  addBanner,
  bannerImageProblem,
  deleteBanner,
  listBanners,
  updateBanner,
  type Banner,
  type BannerPlacement,
} from "@/lib/catalog";

const PLACEMENTS: { value: BannerPlacement; title: string; help: string }[] = [
  { value: "hero", title: "Bannière du haut de l'accueil", help: "Les images défilent à la place du bloc orange, en haut de la page d'accueil." },
  { value: "footer", title: "Bannière avant le pied de page", help: "Les images défilent sur toutes les pages, juste avant le pied de page." },
  { value: "left", title: "Bannière verticale gauche", help: "Affichée dans la marge gauche des grands écrans (2xl et plus), sur toutes les pages. Format vertical conseillé : 300 × 900 px." },
  { value: "right", title: "Bannière verticale droite", help: "Affichée dans la marge droite des grands écrans (2xl et plus), sur toutes les pages. Format vertical conseillé : 300 × 900 px." },
];

export default function BannersPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, user, logout } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<BannerPlacement | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    setLoading(true);
    listBanners(token)
      .then(setBanners)
      .catch((caught) => setError(caught instanceof CatalogError ? caught.message : tr("Bannières indisponibles.")))
      .finally(() => setLoading(false));
  }, [token, tr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  /** Runs a change, then reloads the list (positions move together). */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setError(null);
    try {
      await action();
      refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof CatalogError ? caught.message : tr("L'action a échoué."));
      return false;
    }
  }

  async function swap(slides: Banner[], index: number, other: number) {
    if (!token) return;
    const [first, second] = index < other ? [slides[index], slides[other]] : [slides[other], slides[index]];
    // Positions can tie after deletions: the pair gets distinct, swapped ranks.
    const base = Math.min(first.position, second.position);
    await run(async () => {
      await updateBanner(token, second.id, { position: base });
      await updateBanner(token, first.id, { position: base + 1 });
    });
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux bannières.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} roles={user?.roles} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Bannières")}</h1>
        {error && adding === null && editingId === null ? <p className="text-sm text-danger">{error}</p> : null}
        {loading && banners.length === 0 ? <p className="text-sm text-ink-soft">{tr("Chargement…")}</p> : null}

        {PLACEMENTS.map(({ value, title, help }) => {
          const slides = banners.filter((banner) => banner.placement === value);

          return (
            <section key={value} className="flex flex-col gap-4 rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">{tr(title)}</h2>
                  <p className="text-sm text-ink-soft">{tr(help)}</p>
                </div>
                {slides.length < MAX_BANNER_IMAGES ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setAdding(value);
                    }}
                  >
                    <ActionLabel text={tr("Ajouter")} />
                  </Button>
                ) : null}
              </div>

              {slides.length === 0 ? <p className="text-sm text-ink-soft">{tr("Aucune image.")}</p> : null}

              <ul className="flex flex-col gap-3">
                {slides.map((slide, index) => (
                  <SlideRow
                    key={slide.id}
                    slide={slide}
                    first={index === 0}
                    last={index === slides.length - 1}
                    onMove={(direction) => swap(slides, index, index + direction)}
                    onToggle={() => run(() => updateBanner(token, slide.id, { is_active: !slide.is_active }))}
                    onEdit={() => {
                      setError(null);
                      setEditingId(slide.id);
                    }}
                    onDelete={() => run(() => deleteBanner(token, slide.id))}
                  />
                ))}
              </ul>

              {slides.length >= MAX_BANNER_IMAGES ? (
                <p className="text-xs text-ink-soft">
                  {tr("Bannière pleine (")}
                  {MAX_BANNER_IMAGES} {tr("images).")}
                </p>
              ) : null}

              {adding === value ? (
                <AddSlidesModal
                  room={MAX_BANNER_IMAGES - slides.length}
                  error={error}
                  onClose={() => setAdding(null)}
                  onAdd={async (files) => {
                    // Each picked image becomes its own slide, in the order picked.
                    const done = await run(async () => {
                      for (const file of files) await addBanner(token, { placement: value, file });
                    });
                    if (done) setAdding(null);
                  }}
                />
              ) : null}

              {editingId !== null && slides.some((slide) => slide.id === editingId) ? (
                <EditSlideModal
                  key={editingId}
                  slide={slides.find((slide) => slide.id === editingId)!}
                  error={error}
                  onClose={() => setEditingId(null)}
                  onSave={async (values) => {
                    const done = await run(() => updateBanner(token, editingId, values));
                    if (done) setEditingId(null);
                  }}
                />
              ) : null}
            </section>
          );
        })}
      </main>
    </div>
  );
}

function SlideRow({
  slide,
  first,
  last,
  onMove,
  onToggle,
  onEdit,
  onDelete,
}: {
  slide: Banner;
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { tr } = useAppearance();
  const iconButton = "rounded-sm border border-line p-1.5 text-ink transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-sm border border-line p-3 ${slide.is_active ? "" : "opacity-60"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={slide.image_url} alt={slide.title ?? ""} className="h-24 w-48 rounded-sm border border-line object-cover" />

      <div className="min-w-48 flex-1 text-sm">
        <p className="text-ink">{slide.title || <span className="text-ink-soft">{tr("Sans texte alternatif")}</span>}</p>
        {slide.link_url ? <p className="break-all text-xs text-ink-soft">{slide.link_url}</p> : null}
      </div>

      <div className="flex items-center gap-1.5">
        <button type="button" className={iconButton} onClick={onEdit} title={tr("Modifier")} aria-label={tr("Modifier")}>
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={iconButton} disabled={first} onClick={() => onMove(-1)} title={tr("Monter")} aria-label={tr("Monter")}>
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={iconButton} disabled={last} onClick={() => onMove(1)} title={tr("Descendre")} aria-label={tr("Descendre")}>
          <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={onToggle}
          title={slide.is_active ? tr("Désactiver") : tr("Activer")}
          aria-label={slide.is_active ? tr("Désactiver") : tr("Activer")}
        >
          {slide.is_active ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
        </button>
        <span className={`rounded-full px-2 py-0.5 text-xs ${slide.is_active ? "bg-gold/15 text-ink" : "bg-line text-ink-soft"}`}>
          {slide.is_active ? tr("Active") : tr("Inactive")}
        </span>
        <button type="button" className={`${iconButton} text-danger`} onClick={onDelete} title={tr("Supprimer")} aria-label={tr("Supprimer")}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

/** Edit the alt text, link and visibility of a slide in a dialog. */
function EditSlideModal({
  slide,
  error,
  onClose,
  onSave,
}: {
  slide: Banner;
  error: string | null;
  onClose: () => void;
  onSave: (values: { title: string | null; link_url: string | null; is_active: boolean }) => Promise<void>;
}) {
  const { tr } = useAppearance();
  const [title, setTitle] = useState(slide.title ?? "");
  const [link, setLink] = useState(slide.link_url ?? "");
  const [isActive, setIsActive] = useState(slide.is_active);
  const [busy, setBusy] = useState(false);
  const fieldClass = "rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink";

  return (
    <FormModal
      open
      size="md"
      title={tr("Modifier l'image")}
      onClose={onClose}
      submitLabel={tr("Enregistrer")}
      submitting={busy}
      error={error}
      onSubmit={async () => {
        setBusy(true);
        try {
          await onSave({ title: title.trim() || null, link_url: link.trim() || null, is_active: isActive });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.image_url} alt={slide.title ?? ""} className="h-40 w-full rounded-sm border border-line object-cover" />
        <label className="field">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={tr("Texte alternatif (facultatif)")} maxLength={160} className={fieldClass} />
          <span className="field-label">{tr("Texte alternatif")}</span>
        </label>
        <label className="field">
          <input value={link} onChange={(event) => setLink(event.target.value)} placeholder={tr("Lien au clic, ex. /?category=smartphones")} maxLength={500} className={fieldClass} />
          <span className="field-label">{tr("Lien")}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          {tr("Active")}
        </label>
      </div>
    </FormModal>
  );
}

/** Pick one or more images to add to a banner, in a dialog. */
function AddSlidesModal({
  room,
  error,
  onClose,
  onAdd,
}: {
  room: number;
  error: string | null;
  onClose: () => void;
  onAdd: (files: File[]) => Promise<void>;
}) {
  const { tr } = useAppearance();
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <FormModal
      open
      size="md"
      title={tr("Ajouter des images")}
      onClose={onClose}
      submitLabel={busy ? tr("Envoi…") : tr("Ajouter")}
      submitting={busy}
      disabled={files.length === 0}
      error={problem ?? error}
      onSubmit={async () => {
        setBusy(true);
        try {
          await onAdd(files);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-4">
        <Dropzone
          multiple
          maxFiles={room}
          accept="image/jpeg,image/png,image/webp"
          hint={tr("Ajouter des images (JPG, PNG, WebP, 4 Mo, 600 px de large au moins)")}
          selected={files.map((file) => file.name)}
          onFiles={(dropped) => {
            const refused = dropped.map(bannerImageProblem).find(Boolean) ?? null;
            setProblem(refused ? tr(refused) : null);
            setFiles(refused ? [] : dropped);
          }}
        />
      </div>
    </FormModal>
  );
}
