"use client";

import { BellRing, Check, ShoppingCart, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { newOrders, playAlertSound, readSoundEnabled, saveSoundEnabled, unlockAlertSound } from "@/lib/orderAlerts";
import { listOrders, type Order } from "@/lib/orders";
import { useAppearance } from "./AppearanceProvider";

/** How often the order list is checked for a new storefront order. */
const POLL_MS = 20_000;
const MAX_ALERTS = 20;
const TOAST_MS = 9_000;

interface Alert {
  order: Order;
  read: boolean;
}

const money = (order: Order) => `${order.subtotal.amount.toLocaleString("fr-FR")} ${order.subtotal.currency}`;

/**
 * The top bar's order bell. It checks the storefront orders every few seconds;
 * each new one plays a chime, pops a banner and adds an unread entry to the bell.
 * The orders already there when the page opens are the baseline, never alerts.
 */
export function OrderAlerts({ token }: { token: string }) {
  const { tr } = useAppearance();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Order | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const known = useRef<Set<string> | null>(null);
  const soundRef = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Read once after mount: the choice lives in the browser only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSoundOn(readSoundEnabled());
  }, []);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    // Audio stays locked until the user has interacted with the page.
    const unlock = () => unlockAlertSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const check = useCallback(async () => {
    try {
      const orders = await listOrders(token, undefined, { channel: "online", perPage: 25 });

      if (known.current === null) {
        known.current = new Set(orders.map((order) => order.order_number));
        return;
      }

      const fresh = newOrders(orders, known.current);
      if (fresh.length === 0) return;

      fresh.forEach((order) => known.current?.add(order.order_number));
      const newestFirst = [...fresh].reverse();
      setAlerts((current) => [...newestFirst.map((order) => ({ order, read: false })), ...current].slice(0, MAX_ALERTS));
      setToast(newestFirst[0]);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
      if (soundRef.current) void playAlertSound();
    } catch {
      // a failed poll is retried on the next tick
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, POLL_MS);
    return () => {
      clearInterval(timer);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [check]);

  const unread = alerts.filter((alert) => !alert.read).length;

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    saveSoundEnabled(next);
    if (next) void playAlertSound();
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={`${tr("Nouvelles commandes")}${unread > 0 ? ` - ${unread}` : ""}`}
          aria-expanded={open}
          className="relative rounded-sm p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <BellRing className="h-5 w-5" aria-hidden />
          {unread > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-on-primary">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>

        {open ? (
          <div className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-sm border border-line bg-surface text-ink shadow-lg">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <p className="text-sm font-medium">{tr("Nouvelles commandes")}</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-pressed={soundOn}
                  title={soundOn ? tr("Couper le son") : tr("Activer le son")}
                  aria-label={soundOn ? tr("Couper le son") : tr("Activer le son")}
                  className="rounded-sm p-1.5 text-ink-soft transition-colors hover:text-ink"
                >
                  {soundOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
                </button>
                <button
                  type="button"
                  onClick={() => setAlerts((current) => current.map((alert) => ({ ...alert, read: true })))}
                  disabled={unread === 0}
                  title={tr("Tout marquer comme lu")}
                  aria-label={tr("Tout marquer comme lu")}
                  className="rounded-sm p-1.5 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
                >
                  <Check className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>

            {alerts.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-soft">{tr("Aucune nouvelle commande depuis l'ouverture.")}</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {alerts.map(({ order, read }) => (
                  <li key={order.order_number} className="border-b border-line last:border-b-0">
                    <Link
                      href="/commandes"
                      onClick={() => setOpen(false)}
                      className={`flex items-start gap-2 px-3 py-2 text-sm transition-colors hover:bg-bg ${read ? "opacity-60" : ""}`}
                    >
                      <ShoppingCart className="mt-0.5 h-4 w-4 shrink-0 text-gold-bright" aria-hidden />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium">{order.order_number}</span>
                        <span className="truncate text-xs text-ink-soft">
                          {order.customer_name} - {money(order)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {toast ? (
        <div role="status" aria-live="polite" className="fixed right-4 top-20 z-50 flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-sm border border-line border-l-4 border-l-gold bg-surface p-3 text-ink shadow-lg">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-gold-bright" aria-hidden />
          <Link href="/commandes" onClick={() => setToast(null)} className="min-w-0 flex-1 text-sm">
            <span className="block font-medium">{tr("Nouvelle commande reçue")}</span>
            <span className="block truncate text-ink-soft">
              {toast.order_number} - {toast.customer_name}
            </span>
            <span className="block text-ink-soft">{money(toast)}</span>
          </Link>
          <button type="button" onClick={() => setToast(null)} aria-label={tr("Fermer")} className="rounded-sm p-1 text-ink-soft hover:text-ink">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </>
  );
}
