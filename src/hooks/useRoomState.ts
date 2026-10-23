"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import { computeClockOffset } from "@/lib/time";

/**
 * Hakee palvelimelta roolikohtaisen pelitilan ja pitää sen ajan tasalla.
 *
 * Reaaliaikaisuus toteutetaan palvelinvälitteisellä tilakyselyllä:
 * selain ei kosketa Supabaseen suoraan eikä tilaa taulukohtaisia
 * Realtime-kanavia, jotta anon-rooli ei tarvitsisi lukuokeuksia
 * pelaajiin, vastauksiin tai oikeisiin vastauksiin.
 *
 * Kysely taukoaa, kun välilehti on piilossa, ja jatkuu heti, kun
 * välilehti palaa näkyviin tai verkkoyhteys palautuu.
 */

type StateShape = {
  serverNow: string;
  room: { status: string };
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

const FINISHED_INTERVAL_MS = 5000;

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

  const fetchOnce = useCallback(
    async (signal?: AbortSignal) => {
      if (!roomId || !token) {
        return;
      }

      const receivedAt = Date.now();
      const result = await apiRequest<T>(`/api/rooms/${roomId}/state`, {
        hostToken: role === "host" ? token : null,
        playerToken: role === "player" ? token : null,
        signal,
      });

      if (signal?.aborted || disposedRef.current) {
        return;
      }

      if (result.ok) {
        statusRef.current = result.data.room.status;
        setState(result.data);
        setError(null);
        setErrorCode(null);
        setClockOffsetMs(computeClockOffset(result.data.serverNow, receivedAt));
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

    if (!roomId || !token) {
      return;
    }

    let timeoutId: number | undefined;

    const tick = () => {
      if (disposedRef.current || document.visibilityState === "hidden") {
        return;
      }

      const delay = statusRef.current === "finished" ? FINISHED_INTERVAL_MS : intervalMs;
      void fetchOnce();
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
  }, [fetchOnce, intervalMs, roomId, token]);

  const refresh = useCallback(async () => {
    await fetchOnce();
  }, [fetchOnce]);

  // Ladataan vain, kun istunto on olemassa eikä vastausta ole vielä saatu.
  const isLoading = Boolean(roomId && token) && !hasSettled;

  return { state, error, errorCode, isLoading, clockOffsetMs, lastUpdatedAt, refresh };
}
