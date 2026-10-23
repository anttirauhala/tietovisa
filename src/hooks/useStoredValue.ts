"use client";

import { useSyncExternalStore } from "react";

import {
  HOST_PASSCODE_STORAGE_KEY,
  HOST_SESSION_STORAGE_KEY,
  loadHostPasscode,
  loadHostSession,
  loadPlayerSession,
  PLAYER_SESSION_STORAGE_KEY,
  type HostSession,
  type PlayerSession,
  type StoredPasscode,
} from "@/lib/session";

/**
 * Selaimen tallennuksessa oleva arvo Reactin ulkoisena lähteenä.
 *
 * localStoragea ei voi lukea palvelimella, joten arvo luetaan
 * useSyncExternalStore-hookilla. Palvelinsnapshot on aina `null`, joten
 * palvelimen ja selaimen ensimmäinen renderöinti ovat identtisiä eikä
 * hydration-virhettä synny.
 *
 * Snapshot välimuistitetaan raakamerkkijonon perusteella, jotta React saa
 * saman viittauksen niin kauan kuin tallennettu arvo ei muutu.
 */
function createStoredValueHook<T>(storageKey: string, read: () => T | null) {
  let cachedRaw: string | null = null;
  let cachedValue: T | null = null;

  const getSnapshot = (): T | null => {
    if (typeof window === "undefined") {
      return null;
    }

    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(storageKey);
    } catch {
      raw = null;
    }

    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedValue = read();
    }

    return cachedValue;
  };

  const subscribe = (onStoreChange: () => void): (() => void) => {
    if (typeof window === "undefined") {
      return () => {};
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === storageKey) {
        onStoreChange();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  };

  const getServerSnapshot = (): T | null => null;

  return (): T | null =>
    useSyncExternalStore<T | null>(subscribe, getSnapshot, getServerSnapshot);
}

export const useHostSession = createStoredValueHook<HostSession>(
  HOST_SESSION_STORAGE_KEY,
  loadHostSession,
);

export const usePlayerSession = createStoredValueHook<PlayerSession>(
  PLAYER_SESSION_STORAGE_KEY,
  loadPlayerSession,
);

export const useHostPasscode = createStoredValueHook<StoredPasscode>(
  HOST_PASSCODE_STORAGE_KEY,
  loadHostPasscode,
);
