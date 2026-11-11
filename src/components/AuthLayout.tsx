"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useAppearance } from "./AppearanceProvider";
import { LogoMark } from "./LogoMark";

/**
 * The sign-in screens (login, forgotten and reset password): a picture on the
 * left, 7/12 of the width, and the form card on the right, 5/12. Under the
 * `lg` breakpoint the picture goes away and the card fills the screen.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { tr } = useAppearance();

  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-12">
      <aside className="relative hidden overflow-hidden bg-chrome lg:col-span-7 lg:block" aria-hidden>
        <Image
          src="/login-hero.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 58vw, 0px"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-br from-gold/25 via-transparent to-transparent mix-blend-multiply" />

        <div className="absolute inset-x-0 bottom-0 flex max-w-xl flex-col gap-3 p-10 text-white">
          <h2 className="font-display text-3xl font-semibold leading-tight xl:text-4xl">{tr("Pilotez votre marché tech en toute simplicité")}</h2>
          <p className="text-sm text-white/85 xl:text-base">{tr("Commandes, stock, livraisons et finances : tout votre commerce au même endroit.")}</p>
        </div>
      </aside>

      <section className="flex flex-col items-center justify-center gap-8 bg-bg px-4 py-12 sm:px-8 lg:col-span-5">
        <div className="lg:hidden">
          <LogoMark />
        </div>
        {children}
      </section>
    </main>
  );
}
