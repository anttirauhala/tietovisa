"use client";

import { useMemo } from "react";

const COLORS = ["#ef4444", "#2563eb", "#f59e0b", "#16a34a", "#a78bfa", "#f472b6", "#ffffff"];

type Piece = {
  left: number;
  delay: number;
  duration: number;
  color: string;
  drift: number;
  size: number;
};

/**
 * Deterministinen näennäissatunnaislukugeneraattori (mulberry32).
 * Konfettikappaleet lasketaan puhtaasti indeksin perusteella, joten
 * palvelimen ja selaimen renderöinti ovat identtisiä eikä hydration-virhettä
 * synny. Efekti näyttää samalta kuin satunnaisesti arvottu.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPieces(count: number): Piece[] {
  const random = createRandom(20261224);

  return Array.from({ length: count }, () => ({
    left: random() * 100,
    delay: random() * 1.6,
    duration: 2.6 + random() * 2.4,
    color: COLORS[Math.floor(random() * COLORS.length)],
    drift: (random() - 0.5) * 220,
    size: 6 + random() * 10,
  }));
}

/**
 * Konfettiefekti. Käytetään vain pelin lopussa voittajan juhlistamiseen.
 */
export function Confetti({ pieces = 80 }: { pieces?: number }) {
  const generated = useMemo(() => buildPieces(pieces), [pieces]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {generated.map((piece, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            width: `${piece.size}px`,
            height: `${piece.size * 1.6}px`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            ["--tv-drift" as string]: `${piece.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
