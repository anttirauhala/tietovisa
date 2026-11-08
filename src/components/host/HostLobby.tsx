"use client";

import { Play, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { QrJoinPanel, useJoinUrl } from "@/components/QrJoinPanel";
import { Button, Card, Notice } from "@/components/ui";
import type { RankedPlayer } from "@/lib/game/types";

/**
 * Kauanko tähtieffekti näkyy. Vastaa `.animate-star-glow`-animaation kestoa
 * (ks. globals.css), joten tähti poistetaan vasta animaation päätyttyä.
 */
const STAR_LIFETIME_MS = 1_100;

type Star = {
  id: string;
  /** Sijainti prosentteina koko ruudusta. */
  left: number;
  top: number;
};

/**
 * Juontajan odotushuone: liittymiskoodi, QR-koodi ja osallistujalista.
 * Suunniteltu projektorille: suuri PIN-koodi ja helposti luettava QR.
 *
 * Kun pelaaja liittyy, ruudulle ilmestyy hetkeksi tähtieffekti. Tähdet
 * piirretään koko ruudun kattavalle tasolle, mutta QR-koodin valkoinen paneli
 * on niiden yläpuolella (ks. QrJoinPanel), joten QR-koodi ei koskaan peity.
 */
export function HostLobby({
  pin,
  players,
  playerCount,
  onStart,
  busy,
  error,
}: {
  pin: string;
  players: RankedPlayer[];
  playerCount: number;
  onStart: () => void;
  busy: boolean;
  error: string | null;
}) {
  const joinUrl = useJoinUrl(pin);

  const [stars, setStars] = useState<Star[]>([]);
  /**
   * Pelaajat, joille tähti on jo näytetty. `null` tarkoittaa ensimmäistä
   * renderöintiä: silloin nykyiset pelaajat merkitään nähdyiksi eikä tähtiä
   * näytetä heille (esim. juontajan avatessa näkymän kesken pelin).
   * Ref estää myös React Strict Moden aiheuttaman tuplanäytön.
   */
  const knownPlayerIdsRef = useRef<Set<string> | null>(null);
  const removalTimeoutsRef = useRef<number[]>([]);

  // Siivoa kesken olevat poistoajastimet, jos näkymä puretaan.
  useEffect(() => {
    return () => {
      removalTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      removalTimeoutsRef.current = [];
    };
  }, []);

  // Uusi pelaaja pelaajalistassa -> tähtieffekti satunnaiseen kohtaan ruutua.
  useEffect(() => {
    const currentIds = players.map((player) => player.id);

    if (knownPlayerIdsRef.current === null) {
      knownPlayerIdsRef.current = new Set(currentIds);
      return;
    }

    const known = knownPlayerIdsRef.current;
    const joinedIds = currentIds.filter((id) => !known.has(id));
    currentIds.forEach((id) => known.add(id));

    if (joinedIds.length === 0) {
      return;
    }

    const newStars: Star[] = joinedIds.map((playerId) => ({
      id: `star-${playerId}-${Math.random().toString(36).slice(2, 8)}`,
      left: 3 + Math.random() * 94,
      top: 3 + Math.random() * 94,
    }));

    setStars((prev) => [...prev, ...newStars]);

    const removalId = window.setTimeout(() => {
      const expired = new Set(newStars.map((star) => star.id));
      setStars((prev) => prev.filter((star) => !expired.has(star.id)));
    }, STAR_LIFETIME_MS);

    removalTimeoutsRef.current.push(removalId);
  }, [players]);

  return (
    <div className="flex flex-col gap-6">
      {/*
        QR-kortilta poistetaan taustan blur. `backdrop-filter` muodostaa aina
        oman pinoutumiskontekstinsa, jolloin kortin sisällä oleva QR-koodi ei
        voisi nousta tähtieffektien (z-10) yläpuolelle. Ilman bluria kortti ei
        ole pinoutumiskonteksti ja QR-koodin oma z-20 riittää.
      */}
      <Card
        className="flex flex-col items-center gap-8"
        style={{ backdropFilter: "none", WebkitBackdropFilter: "none" }}
      >
        <div className="text-center">
          <h1 className="text-3xl font-black sm:text-4xl">Liity peliin</h1>
          <p className="mt-1 text-white/70">
            Pelaajat liittyvät puhelimellaan – ei sovellusta, ei tunnuksia.
          </p>
        </div>

        <QrJoinPanel pin={pin} joinUrl={joinUrl} />
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="size-6" />
            Pelaajat
          </h2>
          <span
            className="tv-chip px-5 py-2 text-3xl font-black leading-none tabular-nums sm:px-7 sm:py-3 sm:text-5xl"
            data-testid="player-count"
          >
            {playerCount}
          </span>
        </div>

        {players.length === 0 ? (
          <p className="text-white/70">
            Odotetaan ensimmäistä pelaajaa… Näytä PIN-koodi tai QR-koodi osallistujille.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {players.map((player) => (
              <li
                key={player.id}
                className="animate-pop rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-lg font-semibold"
              >
                {player.nickname}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/*
        Tähtieffektit pelaajan liittyessä: koko ruudun kiinteä taso, joka ei vie
        tilaa asettelusta (fixed) eikä ota klikkauksia vastaan
        (pointer-events-none). Taso on z-10; vain QR-koodin valkoinen paneli
        (z-20) on sen yläpuolella, joten QR-koodi ei koskaan peity.
      */}
      {stars.length > 0 ? (
        <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
          {stars.map((star) => (
            <span
              key={star.id}
              className="animate-star-glow absolute select-none text-3xl"
              style={{ left: `${star.left}%`, top: `${star.top}%` }}
              aria-hidden="true"
            >
              ⭐
            </span>
          ))}
        </div>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="flex flex-col items-center gap-3">
        <Button
          onClick={onStart}
          disabled={busy || playerCount === 0}
          className="w-full max-w-xl py-6 text-2xl"
        >
          <Play className="size-7" />
          {playerCount === 0 ? "Odotetaan pelaajia" : "Aloita peli"}
        </Button>
        <p className="text-sm text-white/60">
          Pikakomento juontajalle: Ctrl + Enter (tai Cmd + Enter) suorittaa ensisijaisen
          painikkeen.
        </p>
      </div>
    </div>
  );
}
