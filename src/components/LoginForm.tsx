"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAppearance } from "./AppearanceProvider";
import { LogoMark } from "./LogoMark";
import { PasswordInput } from "./PasswordInput";

export interface LoginFormProps {
  onSubmit: (email: string, password: string) => void;
  submitting: boolean;
  error: string | null;
}

export function LoginForm({ onSubmit, submitting, error }: LoginFormProps) {
  const { t, tr } = useAppearance();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(email, password);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-4 rounded-sm border border-line bg-surface p-8 shadow-card border-b-4 border-b-gold"
    >
      <div className="hidden justify-center lg:flex">
        <LogoMark />
      </div>

      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-display text-xl font-semibold text-ink">{t("login.title")}</h1>
        <p className="text-sm text-ink-soft">{t("login.subtitle")}</p>
      </div>

      <label className="field">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-sm border border-line bg-bg px-3 py-2 text-ink focus:border-gold focus:outline-none"
          placeholder="prenom.nom@TechniLium.app"
        />
        <span className="field-label">{t("login.email")}</span>
      </label>

      <PasswordInput
        required
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        label={t("login.password")}
      />

      <Link href="/mot-de-passe-oublie" className="-mt-2 self-end text-xs text-gold-bright underline-offset-4 hover:underline">
        {tr("Mot de passe oublié ?")}
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-sm bg-gold px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? t("login.submitting") : t("login.submit")}
      </button>
    </form>
  );
}
