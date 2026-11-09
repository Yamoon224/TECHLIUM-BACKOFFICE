"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "@/lib/auth";
import { AuthLayout } from "./AuthLayout";
import { useAppearance } from "./AppearanceProvider";
import { LogoMark } from "./LogoMark";

/** Step 1: the address. The answer never says whether an account exists. */
export function ForgotPasswordForm() {
  const { tr } = useAppearance();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();

    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      setError(tr("L'envoi n'a pas pu être fait. Vérifiez l'adresse et réessayez."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="flex w-full max-w-md flex-col gap-4 rounded-sm border border-line bg-surface p-8 shadow-card border-b-4 border-b-gold">
        <div className="flex justify-center">
          <LogoMark />
        </div>

        <h1 className="text-center text-lg font-medium text-ink">{tr("Mot de passe oublié")}</h1>

        {sent ? (
          <div className="flex flex-col gap-3 text-sm text-ink-soft" role="status">
            <p className="flex items-start gap-2 text-ink">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
              {tr("Si un compte correspond à cette adresse, un e-mail de réinitialisation vient d'être envoyé. Le lien est valable une heure.")}
            </p>
            <p>{tr("Pensez à regarder dans vos courriers indésirables.")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-ink-soft">
              {tr("Saisissez l'adresse e-mail de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe.")}
            </p>

            <label className="field">
              <input name="email" type="email" required autoComplete="email" placeholder="prenom.nom@TechLium.app" className="text-ink" />
              <span className="field-label">{tr("Adresse e-mail")}</span>
            </label>

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-sm bg-gold px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? tr("Un instant…") : tr("Envoyer le lien")}
            </button>
          </form>
        )}

        <Link href="/" className="text-center text-sm text-gold-bright underline-offset-4 hover:underline">
          {tr("Retour à la connexion")}
        </Link>
      </div>
    </AuthLayout>
  );
}
