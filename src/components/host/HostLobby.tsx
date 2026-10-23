"use client";

import { Play, Users } from "lucide-react";

import { QrJoinPanel, useJoinUrl } from "@/components/QrJoinPanel";
import { Button, Card, Notice } from "@/components/ui";
import type { RankedPlayer } from "@/lib/game/types";

/**
 * Juontajan odotushuone: liittymiskoodi, QR-koodi ja osallistujalista.
 * Suunniteltu projektorille: suuri PIN-koodi ja helposti luettava QR.
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

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col items-center gap-8">
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
          <span className="tv-chip px-4 py-1 text-lg font-bold tabular-nums">
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
