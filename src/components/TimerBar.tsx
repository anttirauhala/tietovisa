"use client";

import { Timer } from "lucide-react";

/**
 * Animoitu ajastin ja kysymyksen etenemispalkki.
 * Aika lasketaan palvelimen määräajasta (question_ends_at).
 */
export function TimerBar({
  seconds,
  ratio,
  label = "Aikaa jäljellä",
}: {
  seconds: number;
  ratio: number;
  label?: string;
}) {
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const remainingRatio = 1 - clampedRatio;

  const toneClass =
    clampedRatio >= 0.8
      ? "bg-rose-500"
      : clampedRatio >= 0.5
        ? "bg-amber-400"
        : "bg-emerald-400";

  const isUrgent = clampedRatio >= 0.8 && seconds > 0;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-end justify-between gap-4">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white/75 uppercase">
          <Timer className="size-4" />
          {label}
        </span>
        <span
          className={`font-black tabular-nums ${isUrgent ? "animate-pulse-soft text-rose-200" : "text-white"} text-4xl sm:text-5xl`}
          aria-live="off"
        >
          {seconds}
        </span>
      </div>
      <div className="tv-progress-track" role="presentation">
        <div
          className={`tv-progress-fill ${toneClass}`}
          style={{ width: `${remainingRatio * 100}%` }}
        />
      </div>
    </div>
  );
}
