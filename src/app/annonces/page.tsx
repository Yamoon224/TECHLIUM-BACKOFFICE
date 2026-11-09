"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { DataTable } from "@/components/DataTable";
import { Dropzone } from "@/components/Dropzone";
import { FormModal } from "@/components/Modal";
import { useAppearance } from "@/components/AppearanceProvider";
import { useAuth } from "@/lib/useAuth";
import {
  ANNOUNCEMENT_STATE_LABEL,
  AnnouncementError,
  announcementImageProblem,
  announcementState,
  archiveAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  restoreAnnouncement,
  toLocalInput,
  updateAnnouncement,
  type Announcement,
  type AnnouncementInput,
} from "@/lib/announcements";

const FIELD_CLASS = "rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink";
const BUTTON_CLASS = "rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold";

function formatPeriodDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "…";
}

export default function AnnouncementsPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, user, logout } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<"new" | number | null>(null);
  const [tab, setTab] = useState<"current" | "archived">("current");
  // Evaluated on mount, not during render: the clock must not be frozen by the prerender.
  const [now, setNow] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    setLoading(true);
    listAnnouncements(token)
      .then(setAnnouncements)
      .catch((caught) => setError(caught instanceof AnnouncementError ? caught.message : tr("Annonces indisponibles.")))
      .finally(() => setLoading(false));
  }, [token, tr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    refresh();
  }, [refresh]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  function messageOf(caught: unknown, fallback: string): string {
    return caught instanceof AnnouncementError ? caught.message : tr(fallback);
  }

  async function handleSubmit(input: AnnouncementInput) {
    if (!token) return;
    setError(null);
    try {
      if (typeof form === "number") {
        const updated = await updateAnnouncement(token, form, input);
        setAnnouncements((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await createAnnouncement(token, input);
        setAnnouncements((current) => [created, ...current]);
      }
      setForm(null);
    } catch (caught) {
      setError(messageOf(caught, "Enregistrement impossible."));
      throw caught;
    }
  }

  async function handleToggle(announcement: Announcement) {
    if (!token) return;
    setError(null);
    try {
      const updated = await updateAnnouncement(token, announcement.id, {
        title: announcement.title,
        image: null,
        link_url: announcement.link_url ?? "",
        width: announcement.width,
        height: announcement.height,
        delay_seconds: announcement.delay_seconds,
        max_displays: announcement.max_displays,
        starts_at: toLocalInput(announcement.starts_at),
        ends_at: toLocalInput(announcement.ends_at),
        is_active: !announcement.is_active,
      });
      setAnnouncements((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (caught) {
      setError(messageOf(caught, "L'action a échoué."));
    }
  }

  async function handleArchive(announcement: Announcement, archive: boolean) {
    if (!token) return;
    setError(null);
    try {
      const updated = archive ? await archiveAnnouncement(token, announcement.id) : await restoreAnnouncement(token, announcement.id);
      setAnnouncements((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (caught) {
      setError(messageOf(caught, "L'action a échoué."));
    }
  }

  async function handleDelete(announcement: Announcement) {
    if (!token || !window.confirm(tr("Supprimer cette annonce ?"))) return;
    setError(null);
    try {
      await deleteAnnouncement(token, announcement.id);
      setAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
    } catch (caught) {
      setError(messageOf(caught, "Suppression impossible."));
    }
  }

  const shown = useMemo(() => announcements.filter((item) => (item.archived_at !== null) === (tab === "archived")), [announcements, tab]);
  const editing = useMemo(() => (typeof form === "number" ? announcements.find((item) => item.id === form) : undefined), [form, announcements]);

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux annonces.")}</p>
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
        <div className="flex items-center justify-between">
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Annonces flash")}</h1>
          <Button
            onClick={() => {
              setError(null);
              setForm("new");
            }}
          >
            <ActionLabel text={tr("Nouvelle annonce")} />
          </Button>
        </div>

        <p className="text-sm text-ink-soft">
          {tr("Une annonce s'affiche en fenêtre sur l'accueil de la boutique, après le délai choisi, tant que sa période n'est pas expirée. Le visiteur peut la fermer avec la croix : elle ne revient plus pour lui, sauf si vous la modifiez.")}
        </p>

        {error && form === null ? <p className="text-sm text-danger">{error}</p> : null}

        {form !== null && (form === "new" || editing) ? (
          <AnnouncementFormModal key={form} announcement={editing} onClose={() => setForm(null)} onSubmit={handleSubmit} error={error} />
        ) : null}

        <div className="flex gap-2" role="group" aria-label={tr("Affichage")}>
          {(["current", "archived"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={tab === mode}
              onClick={() => setTab(mode)}
              className={`rounded-sm border px-3 py-1 text-xs transition-colors ${tab === mode ? "border-gold text-gold" : "border-line text-ink hover:border-gold"}`}
            >
              {mode === "current" ? <ActionLabel text={tr("Annonces")} /> : <ActionLabel text={tr("Historique (archivées)")} />} ({announcements.filter((item) => (item.archived_at !== null) === (mode === "archived")).length})
            </button>
          ))}
        </div>

        {loading && announcements.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-ink-soft">{tab === "archived" ? tr("Aucune annonce archivée.") : tr("Aucune annonce.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
              name="annonces"
              rows={shown}
              headers={[tr("Image"), tr("Titre"), tr("Dimensions"), tr("Délai"), tr("Affichages"), tr("Période"), tr("État"), tr("Action")]}
              actionColumns={[0, 7]}
              renderRow={(announcement) => (
                <tr key={announcement.id} className="border-b border-line">
                  <td className="py-3 pr-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={announcement.image_url} alt={announcement.title} className="h-12 w-20 rounded-sm border border-line object-cover" />
                  </td>
                  <td className="py-3 pr-4 text-ink">{announcement.title}</td>
                  <td className="py-3 pr-4 text-ink-soft">
                    {announcement.width} × {announcement.height}
                  </td>
                  <td className="py-3 pr-4 text-ink-soft">{announcement.delay_seconds} s</td>
                  <td className="py-3 pr-4 text-ink-soft">{announcement.max_displays === null ? tr("Jusqu'à la fermeture") : announcement.max_displays}</td>
                  <td className="py-3 pr-4 text-ink-soft">
                    {formatPeriodDate(announcement.starts_at)} → {formatPeriodDate(announcement.ends_at)}
                  </td>
                  <td className="py-3 pr-4 text-ink-soft">{now ? tr(ANNOUNCEMENT_STATE_LABEL[announcementState(announcement, now)]) : ""}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {announcement.archived_at ? (
                        <button type="button" className={BUTTON_CLASS} onClick={() => handleArchive(announcement, false)}>
                          <ActionLabel text={tr("Restaurer")} />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={BUTTON_CLASS}
                            onClick={() => {
                              setError(null);
                              setForm(announcement.id);
                            }}
                          >
                            <ActionLabel text={tr("Modifier")} />
                          </button>
                          <button type="button" className={BUTTON_CLASS} onClick={() => handleToggle(announcement)}>
                            {announcement.is_active ? <ActionLabel text={tr("Désactiver")} /> : <ActionLabel text={tr("Réactiver")} />}
                          </button>
                          <button type="button" className={BUTTON_CLASS} onClick={() => handleArchive(announcement, true)}>
                            <ActionLabel text={tr("Archiver")} />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(announcement)}
                        className="rounded-sm border border-line px-2 py-1 text-xs text-danger transition-colors hover:border-danger"
                      >
                        <ActionLabel text={tr("Supprimer")} />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function AnnouncementFormModal({
  announcement,
  onClose,
  onSubmit,
  error,
}: {
  announcement?: Announcement;
  onClose: () => void;
  onSubmit: (input: AnnouncementInput) => Promise<void>;
  error: string | null;
}) {
  const { tr } = useAppearance();
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [image, setImage] = useState<File | null>(null);
  const [link, setLink] = useState(announcement?.link_url ?? "");
  const [width, setWidth] = useState(String(announcement?.width ?? 600));
  const [height, setHeight] = useState(String(announcement?.height ?? 400));
  const [delay, setDelay] = useState(String(announcement?.delay_seconds ?? 3));
  const [maxDisplays, setMaxDisplays] = useState(announcement?.max_displays ? String(announcement.max_displays) : "");
  const [startsAt, setStartsAt] = useState(toLocalInput(announcement?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(announcement?.ends_at ?? null));
  const [active, setActive] = useState(announcement?.is_active ?? true);
  const [problem, setProblem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Local preview of the picked file, else the current image.
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : (announcement?.image_url ?? null)), [image, announcement]);

  useEffect(() => {
    return () => {
      if (image && preview) URL.revokeObjectURL(preview);
    };
  }, [image, preview]);

  const missing = !title.trim() || (!announcement && !image) || !width || !height || delay === "";

  return (
    <FormModal
      open
      size="lg"
      title={announcement ? tr("Modifier l'annonce") : tr("Nouvelle annonce")}
      onClose={onClose}
      submitLabel={announcement ? tr("Enregistrer") : tr("Créer")}
      submitting={submitting}
      disabled={missing}
      error={problem ?? error}
      onSubmit={async () => {
        setSubmitting(true);
        try {
          await onSubmit({
            title: title.trim(),
            image,
            link_url: link.trim(),
            width: Number(width),
            height: Number(height),
            delay_seconds: Number(delay),
            max_displays: maxDisplays === "" ? null : Number(maxDisplays),
            starts_at: startsAt,
            ends_at: endsAt,
            is_active: active,
          });
        } catch {
          // error surfaced by the page, shown in the footer
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Dropzone
            accept="image/jpeg,image/png,image/webp"
            label={tr("Image de l'annonce")}
            hint={tr("Image de l'annonce") + " · " + tr("JPG, PNG, WebP, 4 Mo")}
            selected={image ? [image.name] : undefined}
            onFiles={([file]) => {
              const refused = announcementImageProblem(file);
              setProblem(refused ? tr(refused) : null);
              if (!refused) setImage(file);
            }}
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-48 self-start rounded-sm border border-line object-contain" />
          ) : null}
        </div>

        <label className="field sm:col-span-2">
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder={tr("Ex. Soldes de fin d'année")} className={FIELD_CLASS} />
          <span className="field-label">{tr("Titre")}</span>
        </label>
        <label className="field sm:col-span-2">
          <input value={link} onChange={(event) => setLink(event.target.value)} maxLength={500} placeholder="/?category=smartphones" className={FIELD_CLASS} />
          <span className="field-label">{tr("Lien de redirection")}</span>
        </label>

        <label className="field">
          <input type="number" min={100} max={2000} value={width} onChange={(event) => setWidth(event.target.value)} className={FIELD_CLASS} />
          <span className="field-label">{tr("Largeur (px)")}</span>
        </label>
        <label className="field">
          <input type="number" min={100} max={2000} value={height} onChange={(event) => setHeight(event.target.value)} className={FIELD_CLASS} />
          <span className="field-label">{tr("Hauteur (px)")}</span>
        </label>

        <label className="field">
          <input type="number" min={0} max={600} value={delay} onChange={(event) => setDelay(event.target.value)} className={FIELD_CLASS} />
          <span className="field-label">{tr("Délai d'apparition (secondes)")}</span>
        </label>
        <label className="field">
          <input
            type="number"
            min={1}
            max={100}
            value={maxDisplays}
            onChange={(event) => setMaxDisplays(event.target.value)}
            placeholder={tr("Jusqu'à la fermeture")}
            className={FIELD_CLASS}
          />
          <span className="field-label">{tr("Nombre d'affichages (visites)")}</span>
        </label>

        <label className="field">
          <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className={FIELD_CLASS} />
          <span className="field-label">{tr("Début d'affichage")}</span>
        </label>
        <label className="field">
          <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className={FIELD_CLASS} />
          <span className="field-label">{tr("Expiration")}</span>
        </label>

        <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          {tr("Active")}
        </label>
      </div>
    </FormModal>
  );
}
