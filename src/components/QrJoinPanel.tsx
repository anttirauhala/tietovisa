"use client";

import { QRCodeSVG } from "qrcode.react";
import { useSyncExternalStore } from "react";

/**
 * Liittymiskoodi ja QR-koodi juontajan odotushuoneeseen.
 *
 * QR-koodi osoittaa sovelluksen oikeaan osoitteeseen ja sisältää PIN-koodin
 * URL-parametrina (/join?pin=123456). Osoitetta ei kovakoodata localhostiksi:
 * se otetaan ensisijaisesti NEXT_PUBLIC_APP_URL-ympäristömuuttujasta ja
 * muuten selaimen nykyisestä osoitteesta.
 *
 * Osoite luetaan useSyncExternalStore-hookilla, koska window.location ei ole
 * käytettävissä palvelimella.
 */

const emptySubscribe = (): (() => void) => () => {};

let cachedOrigin: string | null = null;

function readOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured && configured.length > 0) {
    return configured.replace(/\/+$/, "");
  }
  if (typeof window === "undefined") {
    return null;
  }
  if (cachedOrigin === null) {
    cachedOrigin = window.location.origin;
  }
  return cachedOrigin;
}

function getServerOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured && configured.length > 0 ? configured.replace(/\/+$/, "") : null;
}

export function useAppOrigin(): string | null {
  return useSyncExternalStore(emptySubscribe, readOrigin, getServerOrigin);
}

export function useJoinUrl(pin: string): string | null {
  const origin = useAppOrigin();
  return origin ? `${origin}/join?pin=${encodeURIComponent(pin)}` : null;
}

export function QrJoinPanel({ pin, joinUrl }: { pin: string; joinUrl: string | null }) {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
      <div className="rounded-3xl bg-white p-4 shadow-xl">
        {joinUrl ? (
          <QRCodeSVG
            value={joinUrl}
            size={240}
            level="M"
            marginSize={0}
            title="Liity peliin"
          />
        ) : (
          <div className="flex size-[240px] items-center justify-center text-center text-sm text-slate-500">
            QR-koodi muodostetaan…
          </div>
        )}
      </div>

      <div className="text-center sm:text-left">
        <p className="text-sm font-semibold tracking-widest text-white/70 uppercase">
          Liittymiskoodi
        </p>
        <p className="font-black tracking-[0.25em] text-6xl tabular-nums sm:text-7xl">
          {pin}
        </p>
        <p className="mt-3 max-w-xs text-sm text-white/70">
          Skannaa QR-koodi puhelimella tai avaa <span className="font-semibold">/join</span> ja
          syötä koodi käsin.
        </p>
        {joinUrl ? (
          <p className="mt-2 text-xs break-all text-white/50">{joinUrl}</p>
        ) : null}
      </div>
    </div>
  );
}
