"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tikittävä kello Reactin ulkoisena lähteenä.
 *
 * Aika on ulkoinen järjestelmä: sen lukeminen suoraan renderöinnin aikana
 * (Date.now) ei ole puhdasta eikä setStatein kutsuminen efektin alussa ole
 * suositeltavaa. Siksi kelloa pidetään useSyncExternalStore-tallennuksena,
 * jota päivitetään 100 ms välein vain kun jokin komponentti kuuntelee sitä.
 *
 * Palvelinsnapshot on 0, joten palvelimella ei koskaan näytetä kellonaikaa.
 */

const TICK_MS = 100;

let currentNow = 0;
let timerId: number | null = null;
const listeners = new Set<() => void>();

function tick(): void {
  currentNow = Date.now();
  for (const listener of listeners) {
    listener();
  }
}

function subscribeToClock(listener: () => void): () => void {
  if (listeners.size === 0) {
    currentNow = Date.now();
    timerId = window.setInterval(tick, TICK_MS);
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  };
}

function getSnapshot(): number {
  return currentNow;
}

function getServerSnapshot(): number {
  return 0;
}

const noopSubscribe = (): (() => void) => () => {};

/**
 * Palauttaa kellonajan millisekunteina. Kun `active` on false, kello ei tiki
 * eikä aiheuta uudelleenrenderöintejä.
 */
export function useNow(active: boolean): number {
  const subscribe = useCallback(
    (listener: () => void) => (active ? subscribeToClock(listener) : noopSubscribe()),
    [active],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
