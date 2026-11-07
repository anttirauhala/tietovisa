"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiConditionalRequest } from "@/lib/api/client";
import { nextPollDelayMs } from "@/lib/polling";
import { computeClockOffset } from "@/lib/time";

/**
 * Hakee palvelimelta roolikohtaisen pelitilan ja pitää sen ajan tasalla.
 *
 * Reaaliaikaisuus toteutetaan palvelinvälitteisellä tilakyselyllä:
 * selain ei kosketa Supabaseen suoraan eikä tilaa taulukohtaisia
 * Realtime-kanavia, jotta anon-rooli ei tarvitsisi lukuokeuksia
 * pelaajiin, vastauksiin tai oikeisiin vastauksiin.
 *
 * Kysely hidastuu, kun välilehti on piilossa, ja palaa normaaliin vauhtiin
 * heti, kun välilehti palaa näkyviin tai verkkoyhteys palautuu. Peli päättyy
 * terminaaliseen tilaan, joten sen jälkeen kysely lopetetaan kokonaan.
 *
 * Kysely on ehdollinen (ETag + If-None-Match): jos tila on ennallaan,
 * palvelin vastaa 304 Not Modified ilman runkoa. Silloin uutta tilaa ei
 * aseteta, joten sekunnin välein toistuva kysely ei siirrä eikä renderöi
 * turhaan pelaajalistoja eikä kysymyssisältöä.
 *
 * Kyselyväli ei ole vakio: `nextPollDelayMs` valitsee sen tilan mukaan.
 * Pelaajalla on kysymysvaiheessa hiljainen ikkuna (ks. lib/polling.ts),
 * koska pelaajan näkymä ei voi muuttua kesken kysymyksen. Juontajalla
 * ikkunaa ei ole: se näyttää vastausmäärän reaaliajassa.
 */

type StateShape = {
  serverNow: string;
  room: { status: string; questionEndsAt: string | null };
};

export type UseRoomStateOptions = {
  roomId: string | null;
  token: string | null;
  role: "host" | "player";
  /** Kyselyväli millisekunteina. */
  intervalMs?: number;
};

export type RoomStateResult<T> = {
  state: T | null;
  error: string | null;
  errorCode: string | null;
  isLoading: boolean;
  clockOffsetMs: number;
  lastUpdatedAt: number | null;
  refresh: () => Promise<void>;
};

export function useRoomState<T extends StateShape>({
  roomId,
  token,
  role,
  intervalMs = 1000,
}: UseRoomStateOptions): RoomStateResult<T> {
  const [state, setState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [hasSettled, setHasSettled] = useState(false);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const statusRef = useRef<string | null>(null);
  const disposedRef = useRef(false);
  /** Viimeksi saatu ETag: lähetetään seuraavassa kyselyssä If-None-Match-otsikkona. */
  const etagRef = useRef<string | null>(null);
  /** Kysymyksen määräaika palvelimen kellona; hiljaisen ikkunan laskentaan. */
  const questionEndsAtRef = useRef<number | null>(null);
  /**
   * Kelloarvio refissä, jotta kyselysilmukka ei käynnisty uudelleen joka
   * tilavastauksen jälkeen (effectin riippuvuudet pysyvät vakioina).
   */
  const clockOffsetRef = useRef(0);

  const fetchOnce = useCallback(
    async (signal?: AbortSignal) => {
      if (!roomId || !token) {
        return;
      }

      const receivedAt = Date.now();
      const result = await apiConditionalRequest<T>(`/api/rooms/${roomId}/state`, {
        hostToken: role === "host" ? token : null,
        playerToken: role === "player" ? token : null,
        etag: etagRef.current,
        signal,
      });

      if (signal?.aborted || disposedRef.current) {
        return;
      }

      if (result.ok) {
        if (result.notModified) {
          /*
           * 304 Not Modified: tila on ennallaan. Aiempaa tilaa ei aseteta
           * uudelleen, joten React ei renderöi turhaan. Palvelin ei lähettänyt
           * serverNow-kelloa, joten kelloarviota ei päivitetä – seuraava
           * oikea tilanmuutos palauttaa koko tilan ja korjaa sen.
           */
          setError(null);
          setErrorCode(null);
        } else {
          etagRef.current = result.etag;
          statusRef.current = result.data.room.status;
          questionEndsAtRef.current = parseDeadline(result.data.room.questionEndsAt);

          const offset = computeClockOffset(result.data.serverNow, receivedAt);
          clockOffsetRef.current = offset;

          setState(result.data);
          setError(null);
          setErrorCode(null);
          setClockOffsetMs(offset);
        }
        setLastUpdatedAt(Date.now());
      } else if (result.code !== "aborted") {
        setError(result.message);
        setErrorCode(result.code);
      }

      setHasSettled(true);
    },
    [roomId, role, token],
  );

  useEffect(() => {
    disposedRef.current = false;
    // Uusi istunto tai huone: edellisen istunnon ETag ei ole enää voimassa.
    etagRef.current = null;
    questionEndsAtRef.current = null;

    if (!roomId || !token) {
      return;
    }

    let timeoutId: number | undefined;

    const tick = () => {
      // Päättynyt peli on terminaalinen tila: kun lopullinen tila on saatu,
      // uutta tietoa ei ole eikä tule, joten kyselyä ei enää jatketa.
      if (disposedRef.current || statusRef.current === "finished") {
        return;
      }

      // Kyselyä ei pysäytetä piilotetussa välilehdessä, vain hidastetaan:
      // juontajan pitää nähdä uudet pelaajat myös, jos ikkuna ei ole näkyvissä.
      const delay = nextPollDelayMs({
        hidden: document.visibilityState === "hidden",
        status: statusRef.current,
        intervalMs,
        role,
        questionEndsAtMs: questionEndsAtRef.current,
        clockOffsetMs: clockOffsetRef.current,
        nowMs: Date.now(),
      });

      void fetchOnce();

      // null = älä ajasta uutta kyselyä (peli päättynyt).
      if (delay === null) {
        return;
      }

      timeoutId = window.setTimeout(tick, delay);
    };

    timeoutId = window.setTimeout(tick, 0);

    const resume = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(tick, 0);
      }
    };

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);

    return () => {
      disposedRef.current = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [fetchOnce, intervalMs, role, roomId, token]);

  const refresh = useCallback(async () => {
    await fetchOnce();
  }, [fetchOnce]);

  // Ladataan vain, kun istunto on olemassa eikä vastausta ole vielä saatu.
  const isLoading = Boolean(roomId && token) && !hasSettled;

  return { state, error, errorCode, isLoading, clockOffsetMs, lastUpdatedAt, refresh };
}

/**
 * Määräaika millisekunteina palvelimen kellona. Puuttuva tai virheellinen
 * arvo tulkitaan "ei tiedossa" -tilaksi, jolloin kyselyväli on normaali.
 */
function parseDeadline(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}
