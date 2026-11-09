"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { resetPassword } from "@/lib/auth";
import { passwordProblem, type PasswordProblem } from "@/lib/passwordRules";
import { AuthLayout } from "./AuthLayout";
import { useAppearance } from "./AppearanceProvider";
import { LogoMark } from "./LogoMark";
import { PasswordInput } from "./PasswordInput";

const PROBLEM_TEXT: Record<PasswordProblem, string> = {
  short: "Le mot de passe doit faire au moins 8 caractères.",
  letter: "Le mot de passe doit contenir au moins une lettre.",
  digit: "Le mot de passe doit contenir au moins un chiffre.",
  mismatch: "Les deux mots de passe ne sont pas identiques.",
};

const EXPIRED = "Ce lien est invalide ou a expiré. Demandez-en un nouveau.";

/** Step 2: the page the e-mail link opens (token and address come in the URL). */
export function ResetPasswordForm() {
  const { tr } = useAppearance();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const problem = passwordProblem(password, String(form.get("confirmation") ?? ""));
    if (problem) {
      setError(tr(PROBLEM_TEXT[problem]));
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ token, email, password });
      setDone(true);
    } catch {
      setError(tr(EXPIRED));
    } finally {
      setSubmitting(false);
    }
  }

  const unusable = token === "" || email === "";

  return (
    <AuthLayout>
      <div className="flex w-full max-w-md flex-col gap-4 rounded-sm border border-line bg-surface p-8 shadow-card border-b-4 border-b-gold">
        <div className="flex justify-center">
          <LogoMark />
        </div>

        <h1 className="text-center text-lg font-medium text-ink">{tr("Nouveau mot de passe")}</h1>

        {done ? (
          <div className="flex flex-col gap-4 text-sm" role="status">
            <p className="flex items-start gap-2 text-ink">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
              {tr("Votre mot de passe a été changé. Vous pouvez maintenant vous connecter.")}
            </p>
            <Link href="/" className="rounded-sm bg-gold px-4 py-2 text-center font-medium text-on-primary transition-colors hover:bg-gold-bright">
              {tr("Se connecter")}
            </Link>
          </div>
        ) : unusable ? (
          <div className="flex flex-col gap-3 text-sm text-ink-soft">
            <p>{tr("Ce lien est incomplet. Utilisez le lien reçu par e-mail, ou demandez-en un nouveau.")}</p>
            <Link href="/mot-de-passe-oublie" className="text-gold-bright underline-offset-4 hover:underline">
              {tr("Demander un nouveau lien")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-ink-soft">{email}</p>

            <PasswordInput name="password" required minLength={8} autoComplete="new-password" label={tr("Nouveau mot de passe")} />
            <p className="-mt-2 text-xs text-ink-soft">{tr("8 caractères minimum, avec au moins une lettre et un chiffre.")}</p>
            <PasswordInput name="confirmation" required minLength={8} autoComplete="new-password" label={tr("Confirmer le mot de passe")} />

            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}{" "}
                {error === tr(EXPIRED) ? (
                  <Link href="/mot-de-passe-oublie" className="underline underline-offset-4">
                    {tr("Demander un nouveau lien")}
                  </Link>
                ) : null}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-sm bg-gold px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <ActionLabel text={tr("Un instant…")} /> : <ActionLabel text={tr("Changer le mot de passe")} />}
            </button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
