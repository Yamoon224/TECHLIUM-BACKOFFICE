"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { useAppearance } from "@/components/AppearanceProvider";
import { useAuth } from "@/lib/useAuth";
import {
  ShopError,
  firstError,
  getShopSettings,
  parseCoordinate,
  saveShopSettings,
  type PaymentMethodId,
  type ShopSettings,
  type TopbarMessage,
} from "@/lib/shop";

const FIELD_CLASS = "rounded-sm border border-line bg-surface px-3 text-sm text-ink focus:border-gold focus:outline-none";
const MAX_MESSAGES = 8;

const PAYMENT_LABEL: Record<PaymentMethodId, string> = {
  mtn: "MTN Mobile Money",
  wave: "Wave",
  cash: "Espèces",
  visa: "Visa",
  mastercard: "Mastercard",
  orange: "Orange Money",
};

/** The form's working copy: every field as text, so a half-typed value is never lost. */
interface Draft {
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
  address: string;
  latitude: string;
  longitude: string;
  tiktok_url: string;
  delivery_info: string;
  delivery_info_en: string;
  topbar_messages: { fr: string; en: string }[];
  payment_methods: PaymentMethodId[];
}

function toDraft(settings: ShopSettings): Draft {
  return {
    phone: settings.phone ?? "",
    whatsapp: settings.whatsapp ?? "",
    email: settings.email ?? "",
    hours: settings.hours ?? "",
    address: settings.address ?? "",
    latitude: settings.latitude === null ? "" : String(settings.latitude),
    longitude: settings.longitude === null ? "" : String(settings.longitude),
    tiktok_url: settings.tiktok_url ?? "",
    delivery_info: settings.delivery_info ?? "",
    delivery_info_en: settings.delivery_info_en ?? "",
    topbar_messages: settings.topbar_messages.map((message) => ({ fr: message.fr, en: message.en ?? "" })),
    payment_methods: settings.payment_methods,
  };
}

export default function ShopPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, user, logout } = useAuth();
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<ShopError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    getShopSettings(token)
      .then((loaded) => {
        setSettings(loaded);
        setDraft(toDraft(loaded));
      })
      .catch((caught) => setError(caught instanceof ShopError ? caught : new ShopError(tr("Informations indisponibles."))));
  }, [token, tr]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setSaved(false);
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSave() {
    if (!token || !draft) return;
    setError(null);
    setSaved(false);

    const latitude = parseCoordinate(draft.latitude);
    const longitude = parseCoordinate(draft.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setError(new ShopError(tr("Les coordonnées doivent être des nombres, par exemple 5.3013244."), { latitude: [] }));
      return;
    }

    const messages: TopbarMessage[] = draft.topbar_messages
      .map((message) => ({ fr: message.fr.trim(), en: message.en.trim() || null }))
      .filter((message) => message.fr !== "");

    setSaving(true);
    try {
      const next = await saveShopSettings(token, {
        phone: draft.phone,
        whatsapp: draft.whatsapp,
        email: draft.email,
        hours: draft.hours,
        address: draft.address,
        latitude,
        longitude,
        tiktok_url: draft.tiktok_url,
        delivery_info: draft.delivery_info,
        delivery_info_en: draft.delivery_info_en,
        topbar_messages: messages,
        payment_methods: draft.payment_methods,
      });
      setSettings(next);
      setDraft(toDraft(next));
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ShopError ? caught : new ShopError(tr("Enregistrement impossible.")));
    } finally {
      setSaving(false);
    }
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux informations de la boutique.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} roles={user?.roles} />

      <main className="flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Boutique")}</h1>
          <p className="text-sm text-ink-soft">
            {tr("Ces informations s'affichent sur le site : barre du haut, pied de page, carte, assistant et centre d'aide. Un champ vide n'est pas affiché.")}
          </p>
        </div>

        {!draft || !settings ? (
          <p className="text-sm text-ink-soft">{error ? error.message : tr("Chargement…")}</p>
        ) : (
          <form
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <Card title="Contacts">
              <Field label="Téléphone" error={firstError(error, "phone")}>
                <input value={draft.phone} onChange={(event) => change("phone", event.target.value)} maxLength={40} placeholder="+225 07 00 00 00 00" className={FIELD_CLASS} />
              </Field>
              <Field label="WhatsApp" error={firstError(error, "whatsapp")}>
                <input value={draft.whatsapp} onChange={(event) => change("whatsapp", event.target.value)} maxLength={40} placeholder="+225 01 73 95 58 43" className={FIELD_CLASS} />
              </Field>
              <Field label="E-mail" error={firstError(error, "email")}>
                <input type="email" value={draft.email} onChange={(event) => change("email", event.target.value)} className={FIELD_CLASS} />
              </Field>
              <Field label="Horaires" error={firstError(error, "hours")}>
                <input value={draft.hours} onChange={(event) => change("hours", event.target.value)} maxLength={255} placeholder="Lun-Sam 8h-19h" className={FIELD_CLASS} />
              </Field>
            </Card>

            <Card title="Adresse et carte" help="Le point sert à la carte et à l'itinéraire. Dans Google Maps, un clic droit sur le lieu donne les deux nombres (latitude, longitude).">
              <Field label="Adresse" wide error={firstError(error, "address")}>
                <input value={draft.address} onChange={(event) => change("address", event.target.value)} maxLength={255} className={FIELD_CLASS} />
              </Field>
              <Field label="Latitude" error={firstError(error, "latitude")}>
                <input inputMode="decimal" value={draft.latitude} onChange={(event) => change("latitude", event.target.value)} placeholder="5.3013244" className={FIELD_CLASS} />
              </Field>
              <Field label="Longitude" error={firstError(error, "longitude")}>
                <input inputMode="decimal" value={draft.longitude} onChange={(event) => change("longitude", event.target.value)} placeholder="-4.0021515" className={FIELD_CLASS} />
              </Field>
            </Card>

            <Card title="Réseaux">
              <Field label="Page TikTok" wide error={firstError(error, "tiktok_url")}>
                <input type="url" value={draft.tiktok_url} onChange={(event) => change("tiktok_url", event.target.value)} placeholder="https://www.tiktok.com/@..." className={FIELD_CLASS} />
              </Field>
            </Card>

            <Card title="Livraison" help="Délais, tarifs, zones : c'est ce que l'assistant répond aux questions sur la livraison. Sans texte anglais, la version française est utilisée.">
              <Field label="Livraison (français)" wide error={firstError(error, "delivery_info")}>
                <textarea value={draft.delivery_info} onChange={(event) => change("delivery_info", event.target.value)} rows={3} maxLength={1000} className={FIELD_CLASS} />
              </Field>
              <Field label="Livraison (anglais)" wide error={firstError(error, "delivery_info_en")}>
                <textarea value={draft.delivery_info_en} onChange={(event) => change("delivery_info_en", event.target.value)} rows={3} maxLength={1000} className={FIELD_CLASS} />
              </Field>
            </Card>

            <Card title="Barre défilante" help="Les messages qui défilent tout en haut du site. Sans message, le site affiche les siens (paiement à la livraison, produits vérifiés, garantie). Le lien vers la boutique, WhatsApp et l'aide s'ajoutent automatiquement.">
              <div className="flex flex-col gap-2 sm:col-span-2">
                {draft.topbar_messages.map((message, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      value={message.fr}
                      onChange={(event) => change("topbar_messages", draft.topbar_messages.map((m, i) => (i === index ? { ...m, fr: event.target.value } : m)))}
                      maxLength={120}
                      placeholder={tr("Message en français")}
                      aria-label={tr("Message en français")}
                      className={`${FIELD_CLASS} h-10`}
                    />
                    <input
                      value={message.en}
                      onChange={(event) => change("topbar_messages", draft.topbar_messages.map((m, i) => (i === index ? { ...m, en: event.target.value } : m)))}
                      maxLength={120}
                      placeholder={tr("Message en anglais (facultatif)")}
                      aria-label={tr("Message en anglais (facultatif)")}
                      className={`${FIELD_CLASS} h-10`}
                    />
                    <button
                      type="button"
                      onClick={() => change("topbar_messages", draft.topbar_messages.filter((_, i) => i !== index))}
                      aria-label={tr("Retirer le message")}
                      className="rounded-sm border border-line p-2 text-ink-soft transition-colors hover:border-danger hover:text-danger"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
                {firstError(error, "topbar_messages.0.fr") ? <p className="text-xs text-danger">{firstError(error, "topbar_messages.0.fr")}</p> : null}
                {draft.topbar_messages.length < MAX_MESSAGES ? (
                  <button
                    type="button"
                    onClick={() => change("topbar_messages", [...draft.topbar_messages, { fr: "", en: "" }])}
                    className="inline-flex w-fit items-center gap-1 rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden /> {tr("Ajouter un message")}
                  </button>
                ) : null}
              </div>
            </Card>

            <Card title="Paiements acceptés" help="Les moyens affichés dans le pied de page. Cochez ceux que vous acceptez vraiment.">
              <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-2">
                {settings.available_payment_methods.map((method) => (
                  <label key={method} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={draft.payment_methods.includes(method)}
                      onChange={(event) =>
                        change(
                          "payment_methods",
                          event.target.checked ? [...draft.payment_methods, method] : draft.payment_methods.filter((m) => m !== method),
                        )
                      }
                    />
                    {PAYMENT_LABEL[method]}
                  </label>
                ))}
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? tr("Enregistrement…") : tr("Enregistrer")}
              </Button>
              {saved ? <p role="status" className="text-sm text-ink-soft">{tr("Enregistré. Le site est à jour.")}</p> : null}
              {error ? <p role="alert" className="text-sm text-danger">{error.message}</p> : null}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function Card({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  const { tr } = useAppearance();

  return (
    <section className="flex flex-col gap-4 rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">{tr(title)}</h2>
        {help ? <p className="text-sm text-ink-soft">{tr(help)}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, wide = false, error, children }: { label: string; wide?: boolean; error?: string | null; children: ReactNode }) {
  const { tr } = useAppearance();

  return (
    <label className={`field ${wide ? "sm:col-span-2" : ""}`}>
      {children}
      <span className="field-label">{tr(label)}</span>
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  );
}
