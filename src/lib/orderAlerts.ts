/**
 * Alerts for orders placed on the storefront: finding the new ones between two
 * polls of the order list, and the chime that announces them.
 */

import type { Order } from "./orders";

/** The online orders of `current` that were not in `known`, oldest first. */
export function newOrders(current: readonly Order[], known: ReadonlySet<string>): Order[] {
  return current.filter((order) => !known.has(order.order_number)).reverse();
}

export const ALERT_SOUND_KEY = "techlium.orderAlerts.sound";

export function readSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(ALERT_SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(ALERT_SOUND_KEY, enabled ? "on" : "off");
  } catch {
    // the choice just does not outlive the tab
  }
}

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return null;
  context ??= new Constructor();
  return context;
}

/** Browsers keep audio locked until the page has had a click or key press: call this from one. */
export function unlockAlertSound(): void {
  void audioContext()?.resume().catch(() => undefined);
}

/** A short two-note chime, played twice so it is noticed from across the room. */
export async function playAlertSound(): Promise<void> {
  const audio = audioContext();
  if (!audio) return;

  try {
    if (audio.state === "suspended") await audio.resume();
  } catch {
    return;
  }
  if (audio.state !== "running") return;

  const notes: [number, number][] = [
    [880, 0],
    [1175, 0.18],
    [880, 0.7],
    [1175, 0.88],
  ];
  for (const [frequency, offset] of notes) {
    const start = audio.currentTime + offset;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.35);
  }
}
