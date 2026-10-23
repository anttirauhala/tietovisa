"use client";

import { Crown, Medal } from "lucide-react";

import type { RankedPlayer } from "@/lib/game/types";

const PODIUM_STYLES: Record<number, string> = {
  1: "border-amber-300/60 bg-amber-400/20",
  2: "border-slate-200/50 bg-slate-200/15",
  3: "border-orange-300/50 bg-orange-400/15",
};

/**
 * Tulostaulu. Sijoitukset erottuvat visuaalisesti, ja jaettu sijoitus
 * näytetään selvästi. Pelaajan oma rivi korostetaan.
 */
export function LeaderboardList({
  players,
  highlightPlayerId = null,
  limit,
  emptyMessage = "Ei pelaajia vielä.",
  size = "md",
}: {
  players: RankedPlayer[];
  highlightPlayerId?: string | null;
  limit?: number;
  emptyMessage?: string;
  size?: "sm" | "md" | "lg";
}) {
  const visible = typeof limit === "number" ? players.slice(0, limit) : players;

  if (visible.length === 0) {
    return <p className="text-white/70">{emptyMessage}</p>;
  }

  const textSize = size === "lg" ? "text-xl sm:text-2xl" : size === "sm" ? "text-sm" : "text-base";
  const rowPadding = size === "lg" ? "px-5 py-4" : "px-4 py-3";

  return (
    <ol className="flex flex-col gap-2">
      {visible.map((player) => {
        const isHighlighted = highlightPlayerId !== null && player.id === highlightPlayerId;
        const podium = PODIUM_STYLES[player.rank];

        return (
          <li
            key={player.id}
            className={`flex items-center gap-3 rounded-2xl border ${rowPadding} ${
              podium ?? "border-white/15 bg-white/8"
            } ${isHighlighted ? "ring-2 ring-fuchsia-300" : ""}`}
          >
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-black/25 font-black ${textSize}`}
            >
              {player.rank === 1 ? (
                <Crown className="size-5 text-amber-200" />
              ) : player.rank <= 3 ? (
                <Medal className="size-5 text-white/85" />
              ) : (
                player.rank
              )}
            </span>

            <span className={`min-w-0 flex-1 truncate font-bold ${textSize}`}>
              {player.nickname}
              {isHighlighted ? (
                <span className="ml-2 rounded-full bg-fuchsia-400/25 px-2 py-0.5 text-xs font-semibold text-fuchsia-100 align-middle">
                  sinä
                </span>
              ) : null}
              {player.isTied ? (
                <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white/80 align-middle">
                  jaettu sija
                </span>
              ) : null}
            </span>

            <span className={`shrink-0 font-black tabular-nums ${textSize}`}>
              {player.score.toLocaleString("fi-FI")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
